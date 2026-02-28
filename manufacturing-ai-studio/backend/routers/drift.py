from __future__ import annotations

from fastapi import APIRouter, HTTPException

from services.drift_service import calculate_drift, list_alerts

router = APIRouter()


@router.post("/check/{model_id}")
def check_drift(model_id: int):
    try:
        return calculate_drift(model_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/status/{model_id}")
def drift_status(model_id: int):
    alerts = list_alerts(model_id=model_id, limit=1)
    if not alerts:
        return {
            "model_id": model_id,
            "drift_score": 0.0,
            "level": "ok",
            "message": "아직 드리프트 체크 이력이 없습니다.",
            "last_checked": None,
        }
    latest = alerts[0]
    return {
        "model_id": model_id,
        "drift_score": latest["drift_score"],
        "level": latest["level"],
        "message": latest["message"],
        "last_checked": latest["created_at"],
    }


@router.get("/alerts")
def get_alerts(model_id: int | None = None):
    return {"alerts": list_alerts(model_id=model_id)}
