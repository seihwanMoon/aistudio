from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
from sqlalchemy import desc

from database import SessionLocal
from models import Alert, Model, Prediction

BASELINE_DIR = Path("data/drift")
BASELINE_DIR.mkdir(parents=True, exist_ok=True)


def save_baseline_from_training(model_id: int, x_train) -> None:
    means = {col: float(x_train[col].mean()) for col in x_train.columns}
    stds = {col: float(x_train[col].std() or 1.0) for col in x_train.columns}
    payload = {"means": means, "stds": stds}
    (BASELINE_DIR / f"model_{model_id}.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _load_baseline(model_id: int) -> dict:
    path = BASELINE_DIR / f"model_{model_id}.json"
    if not path.exists():
        return {"means": {}, "stds": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def calculate_drift(model_id: int, sample_size: int = 200) -> dict:
    db = SessionLocal()
    try:
        model_row = db.query(Model).filter(Model.id == model_id).first()
        if not model_row:
            raise KeyError("모델을 찾을 수 없습니다.")

        baseline = _load_baseline(model_id)
        preds = (
            db.query(Prediction)
            .filter(Prediction.model_id == model_id)
            .order_by(desc(Prediction.created_at))
            .limit(sample_size)
            .all()
        )
        if not preds:
            drift_score = 0.0
        else:
            records = [json.loads(p.input_data) for p in preds]
            numeric_keys = set()
            for row in records:
                for k, v in row.items():
                    if isinstance(v, (int, float)):
                        numeric_keys.add(k)
            z_scores = []
            for key in numeric_keys:
                values = np.array([float(r.get(key, 0) or 0) for r in records], dtype=float)
                mean_now = float(values.mean())
                mean_base = float(baseline["means"].get(key, mean_now))
                std_base = float(baseline["stds"].get(key, 1.0) or 1.0)
                z_scores.append(abs(mean_now - mean_base) / std_base)
            drift_score = float(np.mean(z_scores)) if z_scores else 0.0

        if drift_score >= 1.5:
            level = "danger"
            message = "기준 데이터 대비 큰 분포 변화가 감지되었습니다. 재학습을 권장합니다."
        elif drift_score >= 0.75:
            level = "warning"
            message = "데이터 분포가 변하고 있습니다. 성능 저하를 모니터링하세요."
        else:
            level = "ok"
            message = "드리프트가 안정 범위입니다."

        alert = Alert(model_id=model_id, drift_score=drift_score, level=level, message=message)
        db.add(alert)
        db.commit()
        db.refresh(alert)

        return {
            "model_id": model_id,
            "drift_score": drift_score,
            "level": level,
            "message": message,
            "last_checked": str(alert.created_at),
        }
    finally:
        db.close()


def list_alerts(model_id: int | None = None, limit: int = 100) -> list[dict]:
    db = SessionLocal()
    try:
        query = db.query(Alert).order_by(desc(Alert.created_at))
        if model_id is not None:
            query = query.filter(Alert.model_id == model_id)
        alerts = query.limit(limit).all()
        return [
            {
                "id": a.id,
                "model_id": a.model_id,
                "drift_score": a.drift_score,
                "level": a.level,
                "message": a.message,
                "created_at": str(a.created_at),
            }
            for a in alerts
        ]
    finally:
        db.close()
