from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.inspection import partial_dependence

from database import SessionLocal
from models import Model
from services.data_service import get_upload_metadata, load_dataframe

XAI_CACHE_DIR = Path("data/cache/xai")
XAI_CACHE_DIR.mkdir(parents=True, exist_ok=True)
XAI_CACHE_TTL_SECONDS = int(os.getenv("XAI_CACHE_TTL_SECONDS", "86400"))
XAI_MAX_REFERENCE_ROWS = int(os.getenv("XAI_MAX_REFERENCE_ROWS", "3000"))
XAI_SHAP_CELL_CAP = int(os.getenv("XAI_SHAP_CELL_CAP", "50000"))


def _to_builtin(value):
    if isinstance(value, dict):
        return {str(k): _to_builtin(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_builtin(v) for v in value]
    if isinstance(value, tuple):
        return [_to_builtin(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if pd.isna(value):
        return None
    return value


def _cache_key(name: str, payload: dict) -> str:
    source = json.dumps({"name": name, "payload": payload}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def _cache_path(key: str) -> Path:
    return XAI_CACHE_DIR / f"{key}.json"


def _load_cache(key: str, ttl_seconds: int | None = None) -> dict | None:
    path = _cache_path(key)
    if not path.exists():
        return None
    ttl = XAI_CACHE_TTL_SECONDS if ttl_seconds is None else ttl_seconds
    if time.time() - path.stat().st_mtime > ttl:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def _save_cache(key: str, payload: dict) -> None:
    _cache_path(key).write_text(json.dumps(_to_builtin(payload), ensure_ascii=False), encoding="utf-8")


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


def _effective_sample_size(sample_size: int, feature_count: int) -> tuple[int, bool]:
    clean_sample = max(50, min(int(sample_size), max(50, XAI_MAX_REFERENCE_ROWS)))
    if feature_count <= 0:
        return clean_sample, False

    cap_rows = max(50, XAI_SHAP_CELL_CAP // max(feature_count, 1))
    capped_sample = min(clean_sample, cap_rows)
    return max(50, capped_sample), capped_sample < clean_sample


def _select_reference_data(
    feature_columns: list[str],
    target_column: str | None = None,
    sample_size: int = 2000,
) -> tuple[pd.DataFrame, dict]:
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

        x = _coerce_numeric_frame(df[feature_columns].copy())
        if len(x) == 0:
            continue

        if len(x) > sample_size:
            x = x.sample(n=sample_size, random_state=42)

        ref_file_id = file_path.stem
        meta = get_upload_metadata(ref_file_id)
        source_file_name = meta.get("original_filename") or file_path.name
        return x, {
            "file_id": ref_file_id,
            "source_file": file_path.name,
            "source_file_name": source_file_name,
            "rows_used": int(len(x)),
            "target_column": target_column,
        }

    raise FileNotFoundError("설명 계산에 사용할 참조 데이터를 찾을 수 없습니다.")


def _normalize_reference_payload(reference: dict | None) -> dict:
    ref = dict(reference or {})
    source_file = ref.get("source_file")
    file_id = ref.get("file_id")
    if not file_id and source_file:
        file_id = Path(str(source_file)).stem
    if file_id:
        meta = get_upload_metadata(str(file_id))
        ref["file_id"] = str(file_id)
        ref["source_file_name"] = ref.get("source_file_name") or meta.get("original_filename") or source_file
    elif source_file:
        ref["source_file_name"] = ref.get("source_file_name") or str(source_file)
    return ref


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


def get_global_explanation(
    model_id: int,
    sample_size: int = 2000,
    top_n: int = 20,
    class_index: int = 0,
    use_cache: bool = True,
) -> dict:
    clean_top_n = max(1, min(top_n, 200))
    clean_class_index = max(0, class_index)
    cache_key = _cache_key(
        "global",
        {
            "model_id": model_id,
            "sample_size": sample_size,
            "top_n": clean_top_n,
            "class_index": clean_class_index,
        },
    )
    if use_cache:
        cached = _load_cache(cache_key)
        if cached is not None:
            cached["reference"] = _normalize_reference_payload(cached.get("reference"))
            cached["cache_hit"] = True
            return cached

    start_time = time.perf_counter()
    _, artifact = _load_model_bundle(model_id)
    model = artifact["model"]
    feature_columns = artifact["feature_columns"]
    target_column = artifact.get("target_column")

    requested_sample_size = max(50, sample_size)
    effective_sample_size, sample_capped = _effective_sample_size(requested_sample_size, len(feature_columns))
    x_ref, ref_info = _select_reference_data(
        feature_columns=feature_columns,
        target_column=target_column,
        sample_size=effective_sample_size,
    )

    model_importance = _model_feature_importance(model, feature_columns)
    explanation_method = "shap_tree"
    fallback_reason = None

    try:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(x_ref)
        shap_matrix = _resolve_shap_matrix(shap_values, class_index=clean_class_index)
        mean_abs = np.abs(shap_matrix).mean(axis=0)
        pairs = sorted(zip(feature_columns, mean_abs), key=lambda item: abs(float(item[1])), reverse=True)
        top_features = [
            {"feature": str(name), "mean_abs_shap": float(score)}
            for name, score in pairs[: max(1, min(clean_top_n, len(pairs)))]
        ]
        base_value = _resolve_base_value(explainer.expected_value, class_index=clean_class_index)
    except Exception as exc:  # noqa: BLE001
        explanation_method = "model_feature_importance_fallback"
        fallback_reason = str(exc)
        ranked = model_importance[: max(1, min(clean_top_n, len(model_importance)))]
        top_features = [{"feature": item["feature"], "mean_abs_shap": float(item["importance"])} for item in ranked]
        base_value = 0.0

    if sample_capped:
        capped_reason = (
            f"sample size capped by XAI_SHAP_CELL_CAP={XAI_SHAP_CELL_CAP}, "
            f"feature_count={len(feature_columns)}, effective_sample={effective_sample_size}"
        )
        fallback_reason = f"{fallback_reason}; {capped_reason}" if fallback_reason else capped_reason

    payload = {
        "model_id": model_id,
        "mode": "global",
        "sample_size_requested": int(requested_sample_size),
        "sample_size_effective": int(effective_sample_size),
        "sample_size": int(len(x_ref)),
        "reference": _normalize_reference_payload(ref_info),
        "base_value": base_value,
        "top_features": top_features,
        "model_feature_importance": model_importance[: max(1, min(clean_top_n, len(feature_columns)))],
        "shap_output_space": "raw",
        "explanation_method": explanation_method,
        "fallback_reason": fallback_reason,
        "limits": {
            "xai_max_reference_rows": XAI_MAX_REFERENCE_ROWS,
            "xai_shap_cell_cap": XAI_SHAP_CELL_CAP,
        },
        "runtime_ms": round((time.perf_counter() - start_time) * 1000.0, 2),
        "cache_hit": False,
    }
    if use_cache:
        _save_cache(cache_key, payload)
    return _to_builtin(payload)


def get_local_explanation(model_id: int, features: dict, top_n: int = 10, class_index: int = 0) -> dict:
    start_time = time.perf_counter()
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

    explanation_method = "shap_tree"
    fallback_reason = None
    try:
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(x)
        shap_vector = _resolve_shap_matrix(shap_values, class_index=max(0, class_index))[0]
        base_value = _resolve_base_value(explainer.expected_value, class_index=max(0, class_index))
        shap_sum = float(np.sum(shap_vector))
        pairs = sorted(zip(feature_columns, shap_vector), key=lambda item: abs(float(item[1])), reverse=True)
        contributions = [
            {"feature": str(name), "shap_value": float(value), "abs_shap_value": float(abs(value))}
            for name, value in pairs[: max(1, min(top_n, len(pairs)))]
        ]
    except Exception as exc:  # noqa: BLE001
        explanation_method = "model_feature_importance_fallback"
        fallback_reason = str(exc)
        base_value = 0.0
        shap_sum = 0.0
        ranked = _model_feature_importance(model, feature_columns)[: max(1, min(top_n, len(feature_columns)))]
        contributions = [{"feature": item["feature"], "shap_value": 0.0, "abs_shap_value": float(item["importance"])} for item in ranked]

    return _to_builtin(
        {
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
            "explanation_method": explanation_method,
            "fallback_reason": fallback_reason,
            "runtime_ms": round((time.perf_counter() - start_time) * 1000.0, 2),
        }
    )


def get_partial_dependence(
    model_id: int,
    feature_name: str,
    grid_points: int = 20,
    sample_size: int = 2000,
    use_cache: bool = True,
) -> dict:
    clean_grid_points = max(10, min(grid_points, 80))
    cache_key = _cache_key(
        "pdp",
        {
            "model_id": model_id,
            "feature_name": feature_name,
            "grid_points": clean_grid_points,
            "sample_size": sample_size,
        },
    )
    if use_cache:
        cached = _load_cache(cache_key)
        if cached is not None:
            cached["reference"] = _normalize_reference_payload(cached.get("reference"))
            cached["cache_hit"] = True
            return cached

    start_time = time.perf_counter()
    _, artifact = _load_model_bundle(model_id)
    model = artifact["model"]
    feature_columns = artifact["feature_columns"]
    target_column = artifact.get("target_column")

    if feature_name not in feature_columns:
        raise KeyError("요청한 feature가 모델 입력 컬럼에 없습니다.")

    requested_sample_size = max(50, sample_size)
    effective_sample_size, sample_capped = _effective_sample_size(requested_sample_size, len(feature_columns))
    x_ref, ref_info = _select_reference_data(
        feature_columns=feature_columns,
        target_column=target_column,
        sample_size=effective_sample_size,
    )

    result = partial_dependence(model, x_ref, [feature_name], grid_resolution=clean_grid_points)
    grid = result["grid_values"][0]
    avg = result["average"]
    y_values = np.asarray(avg)[0]
    if np.asarray(y_values).ndim > 1:
        y_values = np.asarray(y_values)[0]

    payload = {
        "model_id": model_id,
        "feature_name": feature_name,
        "mode": "pdp",
        "sample_size_requested": int(requested_sample_size),
        "sample_size_effective": int(effective_sample_size),
        "reference": _normalize_reference_payload(ref_info),
        "grid_points": int(clean_grid_points),
        "points": [{"x": float(xv), "y": float(yv)} for xv, yv in zip(grid.tolist(), np.asarray(y_values).tolist())],
        "fallback_reason": (
            f"sample size capped by XAI_SHAP_CELL_CAP={XAI_SHAP_CELL_CAP}" if sample_capped else None
        ),
        "runtime_ms": round((time.perf_counter() - start_time) * 1000.0, 2),
        "cache_hit": False,
    }
    if use_cache:
        _save_cache(cache_key, payload)
    return _to_builtin(payload)


def export_xai_artifact_for_mlflow(model_id: int, artifact_path: Path) -> Path:
    payload = get_global_explanation(model_id=model_id, sample_size=1000, top_n=15, use_cache=True)
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    artifact_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return artifact_path
