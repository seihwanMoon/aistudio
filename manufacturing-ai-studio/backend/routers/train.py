import json
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import SessionLocal
from models import Experiment, Model
from services.automl_service import get_model_result, get_session_status, start_training

router = APIRouter()


class TrainStartRequest(BaseModel):
    file_id: str
    target_column: str
    feature_columns: list[str]
    time_budget: int = 120
    task_type: str = "classification"
    data_name: str | None = None


def _sanitize_feature_columns(target_column: str, feature_columns: list[str]) -> list[str]:
    normalized = []
    for col in feature_columns:
        if col == target_column:
            continue
        if col not in normalized:
            normalized.append(col)
    return normalized


@router.post("/start")
def start_train(payload: TrainStartRequest):
    sanitized_features = _sanitize_feature_columns(payload.target_column, payload.feature_columns)
    if not sanitized_features:
        raise HTTPException(status_code=400, detail="feature_columns는 최소 1개 이상이어야 합니다.")

    session_id = start_training(
        file_id=payload.file_id,
        target_column=payload.target_column,
        feature_columns=sanitized_features,
        time_budget=payload.time_budget,
        task_type=payload.task_type,
        data_name=payload.data_name,
    )
    return {"session_id": session_id, "message": "학습을 시작했습니다."}


@router.get("/progress/{session_id}")
def stream_progress(session_id: str):
    def event_stream():
        while True:
            try:
                status = get_session_status(session_id)
            except KeyError:
                yield "event: error\ndata: 세션이 존재하지 않습니다.\n\n"
                break

            yield f"data: {json.dumps(status, ensure_ascii=False)}\n\n"
            if status.get("status") in {"done", "failed"}:
                break
            time.sleep(1)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/status/{session_id}")
def get_progress_status(session_id: str):
    try:
        return get_session_status(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/results/{model_id}")
def get_results(model_id: int):
    try:
        return get_model_result(model_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc




@router.get("/flaml-health")
def flaml_health():
    try:
        import flaml
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail={
                "status": "error",
                "message": "FLAML import 실패",
                "error": str(exc),
            },
        ) from exc

    dtype_converter_available = True
    helper_name = "auto_convert_dtypes_pandas"
    try:
        from flaml.automl import data as flaml_data

        if not hasattr(flaml_data, helper_name):
            dtype_converter_available = False
    except Exception:
        dtype_converter_available = False

    return {
        "status": "ok",
        "flaml_version": getattr(flaml, "__version__", "unknown"),
        "dtype_converter_available": dtype_converter_available,
        "dtype_converter_name": helper_name,
    }


class RetrainRequest(BaseModel):
    file_id: str
    target_column: str
    feature_columns: list[str]
    task_type: str = "classification"
    time_budget: int = 120
    data_name: str | None = None


@router.post("/retrain/{model_id}")
def retrain_model(model_id: int, payload: RetrainRequest):
    db = SessionLocal()
    try:
        model = db.query(Model).filter(Model.id == model_id).first()
        if not model:
            raise HTTPException(status_code=404, detail="모델을 찾을 수 없습니다.")

        sanitized_features = _sanitize_feature_columns(payload.target_column, payload.feature_columns)
        if not sanitized_features:
            raise HTTPException(status_code=400, detail="feature_columns는 최소 1개 이상이어야 합니다.")

        session_id = start_training(
            file_id=payload.file_id,
            target_column=payload.target_column,
            feature_columns=sanitized_features,
            time_budget=payload.time_budget,
            task_type=payload.task_type,
            data_name=payload.data_name,
        )
        return {"message": "재학습을 시작했습니다.", "session_id": session_id, "base_model_id": model_id}
    finally:
        db.close()
