import json
from pathlib import Path

import joblib
import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from database import SessionLocal
from models import Model, Prediction

router = APIRouter()


class SinglePredictRequest(BaseModel):
    model_id: int
    features: dict


def _load_model_bundle(model_id: int):
    db = SessionLocal()
    try:
        model = db.query(Model).filter(Model.id == model_id).first()
        if not model:
            raise KeyError("모델을 찾을 수 없습니다.")
        artifact = joblib.load(model.model_path)
        return model, artifact
    finally:
        db.close()


def _save_prediction(model_id: int, input_data: dict, output_data: dict, source: str):
    db = SessionLocal()
    try:
        record = Prediction(
            model_id=model_id,
            input_data=json.dumps(input_data, ensure_ascii=False),
            output_data=json.dumps(output_data, ensure_ascii=False),
            source=source,
        )
        db.add(record)
        db.commit()
    finally:
        db.close()


@router.post("/single")
def predict_single(payload: SinglePredictRequest):
    try:
        _, artifact = _load_model_bundle(payload.model_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    model = artifact["model"]
    feature_columns = artifact["feature_columns"]

    row = {col: payload.features.get(col, 0) for col in feature_columns}
    df = pd.DataFrame([row])
    pred = model.predict(df)[0]

    probability = None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(df)[0]
        probability = float(max(proba))

    output = {"prediction": str(pred), "probability": probability}
    _save_prediction(payload.model_id, row, output, "manual")
    return output


@router.post("/batch")
async def predict_batch(model_id: int, file: UploadFile = File(...)):
    try:
        _, artifact = _load_model_bundle(model_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    content = await file.read()
    suffix = Path(file.filename or "uploaded.csv").suffix.lower()
    if suffix not in {".csv", ".xlsx"}:
        raise HTTPException(status_code=400, detail="CSV 또는 XLSX 파일만 지원합니다.")

    tmp = Path("data/uploads") / f"batch_{model_id}{suffix}"
    tmp.write_bytes(content)

    if suffix == ".csv":
        df = pd.read_csv(tmp)
    else:
        df = pd.read_excel(tmp)

    model = artifact["model"]
    feature_columns = artifact["feature_columns"]
    x = df[feature_columns].fillna(0)
    preds = model.predict(x).tolist()

    probabilities = [None] * len(preds)
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(x)
        probabilities = [float(max(p)) for p in proba]

    results = []
    for row, pred, prob in zip(df.to_dict(orient="records"), preds, probabilities):
        output = {"prediction": str(pred), "probability": prob}
        _save_prediction(model_id, row, output, "batch")
        results.append(output)

    return {"rows": len(results), "predictions": results}


class ABCompareRequest(BaseModel):
    model_a_id: int
    model_b_id: int
    features: dict


@router.post("/ab-compare")
def ab_compare(payload: ABCompareRequest):
    try:
        _, art_a = _load_model_bundle(payload.model_a_id)
        _, art_b = _load_model_bundle(payload.model_b_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    row_a = {col: payload.features.get(col, 0) for col in art_a["feature_columns"]}
    row_b = {col: payload.features.get(col, 0) for col in art_b["feature_columns"]}

    pred_a = art_a["model"].predict(pd.DataFrame([row_a]))[0]
    pred_b = art_b["model"].predict(pd.DataFrame([row_b]))[0]

    return {
        "model_a": {"model_id": payload.model_a_id, "prediction": str(pred_a)},
        "model_b": {"model_id": payload.model_b_id, "prediction": str(pred_b)},
        "same": str(pred_a) == str(pred_b),
    }


@router.get("/{prediction_id}/detail")
def prediction_detail(prediction_id: int):
    db = SessionLocal()
    try:
        record = db.query(Prediction).filter(Prediction.id == prediction_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="예측 기록을 찾을 수 없습니다.")
        return {
            "id": record.id,
            "model_id": record.model_id,
            "input_data": json.loads(record.input_data),
            "output_data": json.loads(record.output_data),
            "source": record.source,
            "created_at": str(record.created_at),
            "local_shap": [
                {"feature": k, "impact": float(v) if isinstance(v, (int, float)) else 0.0}
                for k, v in json.loads(record.input_data).items()
            ],
        }
    finally:
        db.close()
