from __future__ import annotations

import json
from pathlib import Path

from services.email_notifier import send_email_report
from services.kakao_notifier import send_kakao_alert

ALERT_DIR = Path("data/alerts")
ALERT_DIR.mkdir(parents=True, exist_ok=True)

SETTINGS_PATH = ALERT_DIR / "settings.json"
LOG_PATH = ALERT_DIR / "notify_log.jsonl"

DEFAULT_SETTINGS = {
    "threshold": 0.7,
    "email": "qa@example.com",
    "phone": "010-0000-0000",
    "enable_email": True,
    "enable_kakao": True,
}


def get_alert_settings() -> dict:
    if not SETTINGS_PATH.exists():
        save_alert_settings(DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS.copy()
    try:
        payload = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        return {
            "threshold": float(payload.get("threshold", DEFAULT_SETTINGS["threshold"])),
            "email": str(payload.get("email", DEFAULT_SETTINGS["email"])),
            "phone": str(payload.get("phone", DEFAULT_SETTINGS["phone"])),
            "enable_email": bool(payload.get("enable_email", True)),
            "enable_kakao": bool(payload.get("enable_kakao", True)),
        }
    except Exception:  # noqa: BLE001
        save_alert_settings(DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS.copy()


def save_alert_settings(settings: dict) -> dict:
    normalized = {
        "threshold": float(settings.get("threshold", DEFAULT_SETTINGS["threshold"])),
        "email": str(settings.get("email", DEFAULT_SETTINGS["email"])),
        "phone": str(settings.get("phone", DEFAULT_SETTINGS["phone"])),
        "enable_email": bool(settings.get("enable_email", True)),
        "enable_kakao": bool(settings.get("enable_kakao", True)),
    }
    SETTINGS_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    return normalized


def _append_notify_log(payload: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def notify_high_risk_batch(
    model_id: int,
    source_file: str,
    total_count: int,
    high_risk_count: int,
    threshold: float,
) -> dict:
    settings = get_alert_settings()
    message = (
        f"[Manufacturing AI Studio] 고위험 예측 감지\n"
        f"- model_id: {model_id}\n"
        f"- file: {source_file}\n"
        f"- total: {total_count}\n"
        f"- high_risk_count: {high_risk_count}\n"
        f"- threshold: {threshold:.2f}"
    )
    result = {
        "model_id": model_id,
        "source_file": source_file,
        "total_count": total_count,
        "high_risk_count": high_risk_count,
        "threshold": threshold,
        "email": None,
        "kakao": None,
    }

    if settings.get("enable_email"):
        result["email"] = send_email_report(
            recipient=settings["email"],
            subject="[MAS] 고위험 예측 알림",
            body=message,
        )
    if settings.get("enable_kakao"):
        result["kakao"] = send_kakao_alert(phone=settings["phone"], message=message)

    _append_notify_log({"type": "high_risk_batch", **result})
    return result


def send_test_notifications(channel: str = "both") -> dict:
    settings = get_alert_settings()
    result = {"channel": channel, "email": None, "kakao": None}
    if channel in {"email", "both"} and settings.get("enable_email"):
        result["email"] = send_email_report(
            recipient=settings["email"],
            subject="[MAS] 테스트 알림",
            body="이 메시지는 알림 설정 테스트입니다.",
        )
    if channel in {"kakao", "both"} and settings.get("enable_kakao"):
        result["kakao"] = send_kakao_alert(
            phone=settings["phone"],
            message="[MAS] 테스트 알림",
        )
    _append_notify_log({"type": "test", **result})
    return result


def read_notify_logs(limit: int = 50) -> list[dict]:
    if not LOG_PATH.exists():
        return []
    lines = LOG_PATH.read_text(encoding="utf-8").splitlines()
    out = []
    for line in lines[-max(1, min(limit, 500)):]:
        try:
            out.append(json.loads(line))
        except Exception:  # noqa: BLE001
            continue
    return out
