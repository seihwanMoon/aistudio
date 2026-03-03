from __future__ import annotations

import logging

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except Exception:  # noqa: BLE001
    BackgroundScheduler = None

from database import SessionLocal
from models import Model
from services.drift_service import calculate_drift

scheduler = BackgroundScheduler() if BackgroundScheduler is not None else None
logger = logging.getLogger(__name__)


def _run_weekly_drift_check():
    logger.info("weekly drift check started")
    print("[scheduler] weekly drift check started", flush=True)
    db = SessionLocal()
    try:
        model_ids = [m.id for m in db.query(Model).all()]
    finally:
        db.close()

    for model_id in model_ids:
        try:
            calculate_drift(model_id)
            logger.info("weekly drift check model_id=%s done", model_id)
            print(f"[scheduler] weekly drift check model_id={model_id} done", flush=True)
        except Exception:  # noqa: BLE001
            logger.exception("weekly drift check model_id=%s failed", model_id)
            print(f"[scheduler] weekly drift check model_id={model_id} failed", flush=True)
            continue


def start_scheduler():
    if scheduler is None:
        logger.info("scheduler disabled: apscheduler not available")
        print("[scheduler] disabled: apscheduler not available", flush=True)
        return
    if scheduler.running:
        logger.info("scheduler already running")
        print("[scheduler] already running", flush=True)
        return
    scheduler.add_job(_run_weekly_drift_check, "cron", day_of_week="mon", hour=3, minute=0, id="weekly_drift", replace_existing=True)
    scheduler.start()
    logger.info("scheduler started: weekly_drift cron=mon 03:00")
    print("[scheduler] started: weekly_drift cron=mon 03:00", flush=True)
