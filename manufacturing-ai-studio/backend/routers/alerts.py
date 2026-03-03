from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.alert_service import (
    get_alert_settings,
    read_notify_logs,
    save_alert_settings,
    send_test_notifications,
)

router = APIRouter()


class AlertSettingsPayload(BaseModel):
    threshold: float
    email: str
    phone: str
    enable_email: bool = True
    enable_kakao: bool = True


class AlertTestPayload(BaseModel):
    channel: str = "both"


@router.get("/settings")
def get_settings():
    return get_alert_settings()


@router.put("/settings")
def update_settings(payload: AlertSettingsPayload):
    if not (0.0 <= payload.threshold <= 1.0):
        raise HTTPException(status_code=400, detail="threshold는 0~1 범위여야 합니다.")
    return save_alert_settings(payload.model_dump())


@router.post("/test")
def test_alert(payload: AlertTestPayload):
    if payload.channel not in {"email", "kakao", "both"}:
        raise HTTPException(status_code=400, detail="channel은 email|kakao|both 중 하나여야 합니다.")
    return send_test_notifications(channel=payload.channel)


@router.get("/logs")
def logs(limit: int = Query(default=50, ge=1, le=500)):
    return {"logs": read_notify_logs(limit=limit)}
