from __future__ import annotations

import asyncio
import json
import time
import uuid
from pathlib import Path

import pandas as pd

from routers import predict as predict_router

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer
except Exception:  # noqa: BLE001
    FileSystemEventHandler = object
    Observer = None

_broadcast_fn = None
_watchers: dict[str, object] = {}
_watcher_configs: dict[str, dict] = {}

WATCHER_STATE_DIR = Path("data/watcher")
WATCHER_STATE_DIR.mkdir(parents=True, exist_ok=True)
WATCHER_STATE_PATH = WATCHER_STATE_DIR / "active_watchers.json"


def _save_watcher_configs() -> None:
    payload = {"watchers": _watcher_configs}
    WATCHER_STATE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_watcher_configs() -> dict[str, dict]:
    if not WATCHER_STATE_PATH.exists():
        return {}
    try:
        payload = json.loads(WATCHER_STATE_PATH.read_text(encoding="utf-8"))
        watchers = payload.get("watchers", {})
        if isinstance(watchers, dict):
            return watchers
        return {}
    except Exception:  # noqa: BLE001
        return {}


def set_broadcast_fn(fn):
    global _broadcast_fn
    _broadcast_fn = fn


class CSVHandler(FileSystemEventHandler):
    def __init__(self, model_id: int, threshold: float = 0.7):
        self.model_id = model_id
        self.threshold = threshold

    def on_created(self, event):
        if getattr(event, "is_directory", False) or not str(getattr(event, "src_path", "")).endswith(".csv"):
            return
        time.sleep(0.3)
        asyncio.run(self._process(event.src_path))

    async def _process(self, filepath: str):
        df = pd.read_csv(filepath)
        results = []
        for row in df.to_dict(orient="records"):
            payload = predict_router.SinglePredictRequest(model_id=self.model_id, features=row)
            pred = predict_router.predict_single(payload)
            results.append({"input": row, **pred})

        high_risk_count = sum(1 for r in results if (r.get("probability") or 0) >= self.threshold)
        if high_risk_count > 0:
            try:
                from services.alert_service import notify_high_risk_batch

                notify_high_risk_batch(
                    model_id=self.model_id,
                    source_file=Path(filepath).name,
                    total_count=len(results),
                    high_risk_count=high_risk_count,
                    threshold=self.threshold,
                )
            except Exception:
                pass

        if _broadcast_fn:
            await _broadcast_fn(
                {
                    "type": "batch_prediction",
                    "file": Path(filepath).name,
                    "total": len(results),
                    "high_risk_count": high_risk_count,
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "predictions": results,
                    "alert_level": "danger" if high_risk_count > 0 else "ok",
                }
            )


def start_watching(watch_dir: str, model_id: int, threshold: float = 0.7, watcher_id: str | None = None) -> str:
    resolved_watcher_id = watcher_id or str(uuid.uuid4())[:8]
    if Observer is None:
        _watchers[resolved_watcher_id] = {"alive": False, "reason": "watchdog not installed"}
        _watcher_configs[resolved_watcher_id] = {
            "watch_dir": watch_dir,
            "model_id": int(model_id),
            "threshold": float(threshold),
        }
        _save_watcher_configs()
        return resolved_watcher_id

    observer = Observer()
    observer.schedule(CSVHandler(model_id=model_id, threshold=threshold), path=watch_dir, recursive=False)
    observer.start()
    _watchers[resolved_watcher_id] = observer
    _watcher_configs[resolved_watcher_id] = {
        "watch_dir": watch_dir,
        "model_id": int(model_id),
        "threshold": float(threshold),
    }
    _save_watcher_configs()
    return resolved_watcher_id


def stop_watching(watcher_id: str):
    observer = _watchers.get(watcher_id)
    if observer is not None and hasattr(observer, "stop"):
        observer.stop()
        observer.join()
    _watchers.pop(watcher_id, None)
    _watcher_configs.pop(watcher_id, None)
    _save_watcher_configs()


def get_watcher_status() -> dict:
    status = {}
    for watcher_id, observer in _watchers.items():
        if hasattr(observer, "is_alive"):
            alive = bool(observer.is_alive())
        elif isinstance(observer, dict):
            alive = bool(observer.get("alive", False))
        else:
            alive = False
        status[watcher_id] = {
            "alive": alive,
            "config": _watcher_configs.get(watcher_id),
        }
    return status


def restore_watchers() -> dict:
    restored = {}
    configs = _load_watcher_configs()
    for watcher_id, cfg in configs.items():
        watch_dir = str(cfg.get("watch_dir", ""))
        model_id = int(cfg.get("model_id", 0))
        threshold = float(cfg.get("threshold", 0.7))
        if not watch_dir or model_id <= 0:
            continue
        if not Path(watch_dir).exists():
            continue
        if watcher_id in _watchers:
            continue
        resolved_id = start_watching(
            watch_dir=watch_dir,
            model_id=model_id,
            threshold=threshold,
            watcher_id=watcher_id,
        )
        restored[resolved_id] = _watcher_configs.get(resolved_id)
    return restored
