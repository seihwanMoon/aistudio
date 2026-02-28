from __future__ import annotations

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except Exception:  # noqa: BLE001
    BackgroundScheduler = None

from database import SessionLocal
from models import Model
from services.drift_service import calculate_drift

scheduler = BackgroundScheduler() if BackgroundScheduler is not None else None


def _run_weekly_drift_check():
    db = SessionLocal()
    try:
        model_ids = [m.id for m in db.query(Model).all()]
    finally:
        db.close()

    for model_id in model_ids:
        try:
            calculate_drift(model_id)
        except Exception:  # noqa: BLE001
            continue


def start_scheduler():
    if scheduler is None:
        return
    if scheduler.running:
        return
    scheduler.add_job(_run_weekly_drift_check, "cron", day_of_week="mon", hour=3, minute=0, id="weekly_drift", replace_existing=True)
    scheduler.start()
