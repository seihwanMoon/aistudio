from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import SessionLocal
from models import Experiment, Model
from services.mlflow_utils import get_client

router = APIRouter()


class ComparePayload(BaseModel):
    run_ids: list[str]


@router.get("")
def list_experiments():
    try:
        client = get_client()
        experiments = client.search_experiments()
        rows = []
        for exp in experiments:
            runs = client.search_runs([exp.experiment_id], max_results=20, order_by=["start_time DESC"])
            for run in runs:
                rows.append(
                    {
                        "experiment_id": exp.experiment_id,
                        "experiment_name": exp.name,
                        "run_id": run.info.run_id,
                        "status": run.info.status,
                        "metrics": run.data.metrics,
                        "params": run.data.params,
                        "start_time": run.info.start_time,
                    }
                )
        return {"experiments": rows}
    except Exception:  # noqa: BLE001
        db = SessionLocal()
        try:
            experiments = db.query(Experiment).all()
            payload = []
            for exp in experiments:
                models = db.query(Model).filter(Model.experiment_id == exp.id).all()
                for model in models:
                    payload.append(
                        {
                            "experiment_id": exp.id,
                            "experiment_name": exp.name,
                            "run_id": f"local-{model.id}",
                            "status": exp.status,
                            "metrics": {model.metric_name or "metric": model.metric_value or 0.0},
                            "params": {"task_type": exp.task_type or model.model_type},
                            "start_time": str(exp.created_at),
                        }
                    )
            return {"experiments": payload}
        finally:
            db.close()


@router.get("/{run_id}")
def get_experiment_detail(run_id: str):
    try:
        client = get_client()
        run = client.get_run(run_id)
        return {
            "run_id": run.info.run_id,
            "status": run.info.status,
            "metrics": run.data.metrics,
            "params": run.data.params,
            "tags": run.data.tags,
            "start_time": run.info.start_time,
            "end_time": run.info.end_time,
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=f"실험 상세 조회 실패: {exc}") from exc


@router.post("/compare")
def compare_runs(payload: ComparePayload):
    client = get_client()
    compared = []
    for run_id in payload.run_ids:
        try:
            run = client.get_run(run_id)
            compared.append(
                {
                    "run_id": run_id,
                    "metrics": run.data.metrics,
                    "params": run.data.params,
                }
            )
        except Exception:  # noqa: BLE001
            compared.append({"run_id": run_id, "error": "조회 실패"})

    return {"compared": compared}
