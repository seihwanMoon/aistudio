from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.inspection import partial_dependence

from database import SessionLocal
from models import Model
from services.data_service import load_dataframe


def _load_model_bundle(model_id: int) -> tuple[Model, dict]:
    db = SessionLocal()
    try:
        model_row = db.query(Model).filter(Model.id == model_id).first()
        if not model_row:
            raise KeyError("모델을 찾을 수 없습니다.")
        artifact = joblib.load(model_row.model_path)
        return model_row, artifact
    finally:
        db.close()


def _coerce_numeric_frame(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in out.columns:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    return out.fillna(0)


def _select_reference_data(feature_columns: list[str], target_column: str | None = None, sample_size: int = 2000) -> tuple[pd.DataFrame, dict]:
    upload_dir = Path("data/uploads")
    candidates = sorted(
        [p for p in upload_dir.glob("*") if p.suffix.lower() in {".csv", ".xlsx"}],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    for file_path in candidates:
        try:
            df, _ = load_dataframe(file_path)
        except Exception:  # noqa: BLE001
            continue

        missing = [col for col in feature_columns if col not in df.columns]
        if missing:
            continue

        x = df[feature_columns].copy()
        x = _coerce_numeric_frame(x)
        if len(x) == 0:
            continue

        if len(x) > sample_size:
            x = x.sample(n=sample_size, random_state=42)

        info = {
            "source_file": file_path.name,
            "rows_used": int(len(x)),
            "target_column": target_column,
        }
        return x, info

    raise FileNotFoundError("설명 계산에 사용할 참조 데이터를 찾을 수 없습니다.")


def _resolve_shap_matrix(shap_values: Any, class_index: int = 0) -> np.ndarray:
    if isinstance(shap_values, list):
        idx = class_index if 0 <= class_index < len(shap_values) else 0
        return np.asarray(shap_values[idx])

    arr = np.asarray(shap_values)
    if arr.ndim == 3:
        idx = class_index if 0 <= class_index < arr.shape[2] else 0
        return arr[:, :, idx]
    if arr.ndim == 2:
        return arr
    if arr.ndim == 1:
        return arr.reshape(1, -1)
    raise ValueError("지원하지 않는 SHAP 출력 형태입니다.")


def _resolve_base_value(expected_value: Any, class_index: int = 0) -> float:
    if isinstance(expected_value, list):
        idx = class_index if 0 <= class_index < len(expected_value) else 0
        return float(expected_value[idx])

    arr = np.asarray(expected_value)
    if arr.ndim == 0:
        return float(arr)
    if arr.ndim == 1:
        idx = class_index if 0 <= class_index < arr.shape[0] else 0
        return float(arr[idx])
    return float(arr.reshape(-1)[0])


def _coerce_feature_row(features: dict, feature_columns: list[str]) -> dict[str, float]:
    row: dict[str, float] = {}
    for col in feature_columns:
        value = features.get(col, 0)
        if value is None or value == "":
            row[col] = 0.0
            continue
        try:
            row[col] = float(value)
        except Exception:  # noqa: BLE001
            row[col] = 0.0
    return row


def _model_feature_importance(model, feature_columns: list[str]) -> list[dict]:
    if not hasattr(model, "feature_importances_"):
        return []
    values = getattr(model, "feature_importances_")
    pairs = sorted(zip(feature_columns, values), key=lambda item: abs(float(item[1])), reverse=True)
    return [{"feature": str(name), "importance": float(score)} for name, score in pairs]


def get_global_explanation(model_id: int, sample_size: int = 2000, top_n: int = 20, class_index: int = 0) -> dict:
    _, artifact = _load_model_bundle(model_id)
    model = artifact["model"]
    feature_columns = artifact["feature_columns"]
    target_column = artifact.get("target_column")

    x_ref, ref_info = _select_reference_data(
        feature_columns=feature_columns,
        target_column=target_column,
        sample_size=max(50, min(sample_size, 5000)),
    )

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(x_ref)
    shap_matrix = _resolve_shap_matrix(shap_values, class_index=class_index)
    mean_abs = np.abs(shap_matrix).mean(axis=0)

    pairs = sorted(zip(feature_columns, mean_abs), key=lambda item: abs(float(item[1])), reverse=True)
    top_features = [
        {"feature": str(name), "mean_abs_shap": float(score)}
        for name, score in pairs[: max(1, min(top_n, len(pairs)))]
    ]

    return {
        "model_id": model_id,
        "mode": "global",
        "sample_size": int(len(x_ref)),
        "reference": ref_info,
        "base_value": _resolve_base_value(explainer.expected_value, class_index=class_index),
        "top_features": top_features,
        "model_feature_importance": _model_feature_importance(model, feature_columns)[: max(1, min(top_n, len(feature_columns)))],
        "shap_output_space": "raw",
    }


def get_local_explanation(model_id: int, features: dict, top_n: int = 10, class_index: int = 0) -> dict:
    _, artifact = _load_model_bundle(model_id)
    model = artifact["model"]
    feature_columns = artifact["feature_columns"]

    row = _coerce_feature_row(features=features, feature_columns=feature_columns)
    x = pd.DataFrame([row], columns=feature_columns)

    prediction = model.predict(x)[0]
    probability = None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(x)[0]
        probability = float(max(proba))

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(x)
    shap_vector = _resolve_shap_matrix(shap_values, class_index=class_index)[0]
    base_value = _resolve_base_value(explainer.expected_value, class_index=class_index)
    shap_sum = float(np.sum(shap_vector))

    pairs = sorted(zip(feature_columns, shap_vector), key=lambda item: abs(float(item[1])), reverse=True)
    contributions = [
        {"feature": str(name), "shap_value": float(value), "abs_shap_value": float(abs(value))}
        for name, value in pairs[: max(1, min(top_n, len(pairs)))]
    ]

    return {
        "model_id": model_id,
        "mode": "local",
        "prediction": str(prediction),
        "probability": probability,
        "base_value": base_value,
        "shap_sum": shap_sum,
        "approx_raw_output": float(base_value + shap_sum),
        "contributions": contributions,
        "input_row": row,
        "shap_output_space": "raw",
    }


def get_partial_dependence(model_id: int, feature_name: str, grid_points: int = 20) -> dict:
    _, artifact = _load_model_bundle(model_id)
    model = artifact["model"]
    feature_columns = artifact["feature_columns"]
    target_column = artifact.get("target_column")

    if feature_name not in feature_columns:
        raise KeyError("요청한 feature가 모델 입력 컬럼에 없습니다.")

    x_ref, ref_info = _select_reference_data(
        feature_columns=feature_columns,
        target_column=target_column,
        sample_size=2000,
    )

    result = partial_dependence(model, x_ref, [feature_name], grid_resolution=max(10, min(grid_points, 80)))
    grid = result["grid_values"][0]
    avg = result["average"]

    y_values = np.asarray(avg)[0]
    if np.asarray(y_values).ndim > 1:
        y_values = np.asarray(y_values)[0]

    points = [{"x": float(xv), "y": float(yv)} for xv, yv in zip(grid.tolist(), np.asarray(y_values).tolist())]
    return {
        "model_id": model_id,
        "feature_name": feature_name,
        "mode": "pdp",
        "reference": ref_info,
        "points": points,
    }


def export_xai_artifact_for_mlflow(model_id: int, artifact_path: Path) -> Path:
    payload = get_global_explanation(model_id=model_id, sample_size=1000, top_n=15)
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    artifact_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return artifact_path
