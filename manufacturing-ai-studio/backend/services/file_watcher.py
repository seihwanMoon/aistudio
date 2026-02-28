from __future__ import annotations

import asyncio
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


def set_broadcast_fn(fn):
    global _broadcast_fn
    _broadcast_fn = fn


class CSVHandler(FileSystemEventHandler):
    def __init__(self, model_id: int, threshold: float = 0.7):
        self.model_id = model_id
        self.threshold = threshold

    def on_created(self, event):
        if getattr(event, 'is_directory', False) or not str(getattr(event, 'src_path', '')).endswith('.csv'):
            return
        time.sleep(0.3)
        asyncio.run(self._process(event.src_path))

    async def _process(self, filepath: str):
        df = pd.read_csv(filepath)
        results = []
        for row in df.to_dict(orient='records'):
            payload = predict_router.SinglePredictRequest(model_id=self.model_id, features=row)
            pred = predict_router.predict_single(payload)
            results.append({"input": row, **pred})

        if _broadcast_fn:
            await _broadcast_fn(
                {
                    "type": "batch_prediction",
                    "file": Path(filepath).name,
                    "total": len(results),
                    "high_risk_count": sum(1 for r in results if (r.get('probability') or 0) >= self.threshold),
                    "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
                    "predictions": results,
                    "alert_level": "danger" if any((r.get('probability') or 0) >= self.threshold for r in results) else "ok",
                }
            )


def start_watching(watch_dir: str, model_id: int, threshold: float = 0.7) -> str:
    watcher_id = str(uuid.uuid4())[:8]
    if Observer is None:
        _watchers[watcher_id] = {'alive': False, 'reason': 'watchdog not installed'}
        return watcher_id

    observer = Observer()
    observer.schedule(CSVHandler(model_id=model_id, threshold=threshold), path=watch_dir, recursive=False)
    observer.start()
    _watchers[watcher_id] = observer
    return watcher_id


def stop_watching(watcher_id: str):
    observer = _watchers.get(watcher_id)
    if observer is None:
        return
    if hasattr(observer, 'stop'):
        observer.stop()
        observer.join()
    del _watchers[watcher_id]


def get_watcher_status() -> dict:
    status = {}
    for watcher_id, observer in _watchers.items():
        if hasattr(observer, 'is_alive'):
            status[watcher_id] = observer.is_alive()
        else:
            status[watcher_id] = False
    return status
