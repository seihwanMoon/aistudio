from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from services.data_service import load_dataframe

CACHE_DIR = Path("data/cache/eda")
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _find_file_by_id(file_id: str) -> Path:
    for ext in (".csv", ".xlsx"):
        path = Path("data/uploads") / f"{file_id}{ext}"
        if path.exists():
            return path
    raise FileNotFoundError("파일을 찾을 수 없습니다.")


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
    return CACHE_DIR / f"{key}.json"


def _load_cache(key: str, ttl_seconds: int = 60 * 60 * 24) -> dict | None:
    path = _cache_path(key)
    if not path.exists():
        return None
    if time.time() - path.stat().st_mtime > ttl_seconds:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def _save_cache(key: str, payload: dict) -> None:
    _cache_path(key).write_text(json.dumps(_to_builtin(payload), ensure_ascii=False), encoding="utf-8")


def _apply_flaml_dtype_conversion(df: pd.DataFrame) -> tuple[pd.DataFrame, list[dict], list[str]]:
    converted_df = df
    dtype_changes: list[dict] = []
    warnings: list[str] = []

    try:
        from flaml.automl.data import auto_convert_dtypes_pandas

        result = auto_convert_dtypes_pandas(df.copy())
        if isinstance(result, tuple):
            candidate = result[0]
        else:
            candidate = result
        if isinstance(candidate, pd.DataFrame):
            converted_df = candidate
    except Exception:
        # FLAML 버전에 따라 dtype auto-convert API가 없을 수 있어 pandas 변환으로 안전하게 대체
        converted_df = df.convert_dtypes()

    before = {col: str(dtype) for col, dtype in df.dtypes.items()}
    after = {col: str(dtype) for col, dtype in converted_df.dtypes.items()}
    for col in converted_df.columns:
        if before.get(col) != after.get(col):
            dtype_changes.append({"column": col, "before": before.get(col), "after": after.get(col)})

    return converted_df, dtype_changes, warnings


def _read_dataframe(file_id: str) -> tuple[pd.DataFrame, str | None]:
    file_path = _find_file_by_id(file_id)
    return load_dataframe(file_path)


def get_eda_summary(file_id: str, use_cache: bool = True) -> dict:
    cache_key = _cache_key("summary", {"file_id": file_id})
    if use_cache:
        cached = _load_cache(cache_key)
        if cached is not None:
            return cached

    df_raw, encoding = _read_dataframe(file_id)
    df, dtype_changes, conversion_warnings = _apply_flaml_dtype_conversion(df_raw)

    total_rows = len(df)
    total_columns = len(df.columns)
    total_cells = max(total_rows * max(total_columns, 1), 1)

    missing_counts = df.isna().sum().sort_values(ascending=False)
    missing_ratio = (missing_counts / max(total_rows, 1)).fillna(0.0)
    missing_top = [
        {"column": str(col), "missing_count": int(cnt), "missing_ratio": float(missing_ratio[col])}
        for col, cnt in missing_counts.head(10).items()
    ]

    duplicated_ratio = float(df.duplicated().mean()) if total_rows > 0 else 0.0
    total_missing_ratio = float(df.isna().sum().sum() / total_cells)

    constant_columns = [str(col) for col in df.columns if df[col].nunique(dropna=False) <= 1]
    near_constant_columns = []
    for col in df.columns:
        series = df[col]
        vc = series.value_counts(dropna=False, normalize=True)
        if not vc.empty and vc.iloc[0] >= 0.98 and series.nunique(dropna=False) > 1:
            near_constant_columns.append(str(col))

    numeric_cols = [str(col) for col in df.select_dtypes(include=["number"]).columns.tolist()]
    datetime_cols = [str(col) for col in df.select_dtypes(include=["datetime", "datetimetz"]).columns.tolist()]
    categorical_cols = [
        str(col)
        for col in df.columns
        if str(df[col].dtype) in {"object", "category", "string", "bool"}
    ]
    other_cols = sorted(
        list(set([str(col) for col in df.columns]) - set(numeric_cols) - set(datetime_cols) - set(categorical_cols))
    )

    score = 100.0
    score -= min(40.0, total_missing_ratio * 100.0)
    score -= min(20.0, duplicated_ratio * 100.0)
    score -= min(20.0, float(len(constant_columns) * 2))
    high_missing_count = int((missing_ratio >= 0.3).sum())
    score -= min(20.0, float(high_missing_count * 2))
    quality_score = round(max(0.0, min(100.0, score)), 2)

    warnings = []
    if total_missing_ratio >= 0.1:
        warnings.append(f"결측 비율이 높습니다: {total_missing_ratio:.2%}")
    if duplicated_ratio > 0:
        warnings.append(f"중복 행이 존재합니다: {duplicated_ratio:.2%}")
    if constant_columns:
        warnings.append(f"상수 컬럼 {len(constant_columns)}개 감지")
    if near_constant_columns:
        warnings.append(f"준상수 컬럼 {len(near_constant_columns)}개 감지")
    warnings.extend(conversion_warnings)

    payload = {
        "file_id": file_id,
        "encoding": encoding,
        "rows": total_rows,
        "columns": total_columns,
        "quality_score": quality_score,
        "type_counts": {
            "numeric": len(numeric_cols),
            "categorical": len(categorical_cols),
            "datetime": len(datetime_cols),
            "other": len(other_cols),
        },
        "missing_overall_ratio": round(total_missing_ratio, 6),
        "duplicate_ratio": round(duplicated_ratio, 6),
        "missing_top": missing_top,
        "constant_columns": constant_columns[:30],
        "near_constant_columns": near_constant_columns[:30],
        "dtype_changes": dtype_changes,
        "warnings": warnings,
    }
    _save_cache(cache_key, payload)
    return payload


def get_eda_correlation(
    file_id: str,
    method: str = "pearson",
    max_features: int = 30,
    threshold: float = 0.8,
    use_cache: bool = True,
) -> dict:
    clean_method = method if method in {"pearson", "spearman"} else "pearson"
    clean_max = max(2, min(max_features, 60))
    clean_threshold = max(0.0, min(threshold, 1.0))
    cache_key = _cache_key(
        "correlation",
        {
            "file_id": file_id,
            "method": clean_method,
            "max_features": clean_max,
            "threshold": clean_threshold,
        },
    )
    if use_cache:
        cached = _load_cache(cache_key)
        if cached is not None:
            return cached

    df, _ = _read_dataframe(file_id)
    numeric_df = df.select_dtypes(include=["number"]).copy()
    if numeric_df.shape[1] < 2:
        return {
            "file_id": file_id,
            "method": clean_method,
            "features": [],
            "matrix": [],
            "high_correlation_pairs": [],
            "message": "상관관계를 계산할 numeric 컬럼이 부족합니다.",
        }

    if numeric_df.shape[1] > clean_max:
        variances = numeric_df.var(numeric_only=True).sort_values(ascending=False)
        selected = variances.head(clean_max).index.tolist()
        numeric_df = numeric_df[selected]

    corr = numeric_df.corr(method=clean_method).fillna(0.0)
    features = [str(c) for c in corr.columns.tolist()]
    matrix = [[float(v) for v in row] for row in corr.values]

    high_pairs = []
    cols = corr.columns.tolist()
    for i, left in enumerate(cols):
        for j in range(i + 1, len(cols)):
            right = cols[j]
            value = float(corr.iloc[i, j])
            if abs(value) >= clean_threshold:
                high_pairs.append({"left": str(left), "right": str(right), "corr": value})
    high_pairs.sort(key=lambda x: abs(x["corr"]), reverse=True)

    payload = {
        "file_id": file_id,
        "method": clean_method,
        "features": features,
        "matrix": matrix,
        "high_correlation_pairs": high_pairs[:100],
    }
    _save_cache(cache_key, payload)
    return payload


def get_feature_profile(file_id: str, feature_name: str, target_column: str | None = None) -> dict:
    df, _ = _read_dataframe(file_id)
    if feature_name not in df.columns:
        raise KeyError("요청한 feature를 찾을 수 없습니다.")

    series = df[feature_name]
    dtype_name = str(series.dtype)
    missing_count = int(series.isna().sum())
    missing_ratio = float(series.isna().mean()) if len(series) else 0.0
    unique_count = int(series.nunique(dropna=True))

    payload = {
        "file_id": file_id,
        "feature_name": feature_name,
        "dtype": dtype_name,
        "missing_count": missing_count,
        "missing_ratio": missing_ratio,
        "unique_count": unique_count,
        "sample_values": [None if pd.isna(v) else _to_builtin(v) for v in series.dropna().head(10).tolist()],
    }

    if pd.api.types.is_numeric_dtype(series):
        clean = series.dropna().astype(float)
        if not clean.empty:
            q1 = float(clean.quantile(0.25))
            q3 = float(clean.quantile(0.75))
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            outlier_ratio = float(((clean < lower) | (clean > upper)).mean())
            hist_counts, bin_edges = np.histogram(clean.values, bins=min(20, max(5, int(np.sqrt(len(clean))))))
            payload["numeric_stats"] = {
                "min": float(clean.min()),
                "max": float(clean.max()),
                "mean": float(clean.mean()),
                "std": float(clean.std(ddof=0)),
                "q25": q1,
                "q50": float(clean.quantile(0.5)),
                "q75": q3,
                "skew": float(clean.skew()) if len(clean) > 2 else 0.0,
                "outlier_ratio_iqr": outlier_ratio,
            }
            payload["histogram"] = {
                "bins": [float(v) for v in bin_edges.tolist()],
                "counts": [int(v) for v in hist_counts.tolist()],
            }
    else:
        counts = series.fillna("<<MISSING>>").astype(str).value_counts()
        payload["top_values"] = [{"value": str(v), "count": int(c)} for v, c in counts.head(20).items()]

    if target_column and target_column in df.columns and target_column != feature_name:
        target = df[target_column]
        if pd.api.types.is_numeric_dtype(series) and pd.api.types.is_numeric_dtype(target):
            joined = pd.concat([series, target], axis=1).dropna()
            if len(joined) >= 3:
                payload["target_relation"] = {
                    "type": "numeric_numeric",
                    "pearson_corr": float(joined.iloc[:, 0].corr(joined.iloc[:, 1], method="pearson")),
                    "spearman_corr": float(joined.iloc[:, 0].corr(joined.iloc[:, 1], method="spearman")),
                }
        else:
            frame = pd.concat([series, target], axis=1).dropna()
            frame.columns = ["feature", "target"]
            grouped = frame.groupby("feature")["target"].agg(["count"]).sort_values("count", ascending=False)
            payload["target_relation"] = {
                "type": "categorical_summary",
                "top_feature_groups": [
                    {"feature": str(idx), "count": int(row["count"])}
                    for idx, row in grouped.head(15).iterrows()
                ],
            }

    return _to_builtin(payload)
