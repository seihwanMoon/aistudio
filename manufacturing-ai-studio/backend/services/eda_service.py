from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from statistics import NormalDist

import numpy as np
import pandas as pd
try:
    from scipy import stats as scipy_stats
except Exception:  # noqa: BLE001
    scipy_stats = None

from services.data_service import load_dataframe

CACHE_DIR = Path("data/cache/eda")
CACHE_DIR.mkdir(parents=True, exist_ok=True)
EDA_CACHE_TTL_SECONDS = int(os.getenv("EDA_CACHE_TTL_SECONDS", "86400"))


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


def _load_cache(key: str, ttl_seconds: int | None = None) -> dict | None:
    path = _cache_path(key)
    if not path.exists():
        return None
    ttl = EDA_CACHE_TTL_SECONDS if ttl_seconds is None else ttl_seconds
    if time.time() - path.stat().st_mtime > ttl:
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


def get_eda_statistics(
    file_id: str,
    top_numeric: int = 12,
    top_categorical: int = 6,
    use_cache: bool = True,
) -> dict:
    schema_version = 4
    clean_top_numeric = max(3, min(int(top_numeric), 20))
    clean_top_categorical = max(2, min(int(top_categorical), 12))
    cache_key = _cache_key(
        "statistics",
        {
            "schema_version": schema_version,
            "file_id": file_id,
            "top_numeric": clean_top_numeric,
            "top_categorical": clean_top_categorical,
        },
    )
    if use_cache:
        cached = _load_cache(cache_key)
        if cached is not None:
            return cached

    df, _ = _read_dataframe(file_id)
    row_count = int(len(df))
    numeric_df = df.select_dtypes(include=["number"]).copy()
    numeric_columns = [str(col) for col in numeric_df.columns.tolist()]
    categorical_columns = [
        str(col)
        for col in df.columns
        if str(df[col].dtype) in {"object", "category", "string", "bool"}
    ]

    numeric_distributions = []
    boxplot_summary = []
    skewness_top = []
    kurtosis_top = []
    outlier_top = []
    normality_tests = []

    if numeric_columns:
        variances = numeric_df.var(numeric_only=True).fillna(0.0).sort_values(ascending=False)
        selected_numeric = [str(col) for col in variances.head(clean_top_numeric).index.tolist()]
        for feature in selected_numeric:
            clean = pd.to_numeric(numeric_df[feature], errors="coerce").dropna().astype(float)
            missing_ratio = float(1.0 - (len(clean) / max(row_count, 1)))
            if clean.empty:
                continue

            q1 = float(clean.quantile(0.25))
            q2 = float(clean.quantile(0.5))
            q3 = float(clean.quantile(0.75))
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            outlier_ratio = float(((clean < lower) | (clean > upper)).mean()) if len(clean) else 0.0
            skewness = float(clean.skew()) if len(clean) > 2 else 0.0
            kurtosis = float(clean.kurt()) if len(clean) > 3 else 0.0

            bin_size = min(24, max(8, int(np.sqrt(len(clean)))))
            hist_counts, hist_bins = np.histogram(clean.values, bins=bin_size)
            hist_max = int(max(hist_counts.tolist() or [0]))

            stats = {
                "count": int(len(clean)),
                "mean": float(clean.mean()),
                "std": float(clean.std(ddof=0)),
                "min": float(clean.min()),
                "q25": q1,
                "q50": q2,
                "q75": q3,
                "max": float(clean.max()),
                "iqr": float(iqr),
                "skew": skewness,
                "kurtosis": kurtosis,
                "outlier_ratio_iqr": outlier_ratio,
                "missing_ratio": missing_ratio,
            }
            histogram = {
                "bins": [float(v) for v in hist_bins.tolist()],
                "counts": [int(v) for v in hist_counts.tolist()],
                "max_count": hist_max,
            }

            qq_points = []
            normality = {
                "feature": feature,
                "sample_size": int(len(clean)),
                "shapiro": None,
                "ks": None,
                "reason": None,
            }
            if len(clean) >= 3 and stats["std"] > 0:
                sorted_values = np.sort(clean.values.astype(float))
                n = len(sorted_values)
                max_points = 120
                if n > max_points:
                    indices = np.linspace(0, n - 1, num=max_points).astype(int)
                    sample_values = sorted_values[indices]
                    probs = (indices + 0.5) / n
                else:
                    sample_values = sorted_values
                    probs = (np.arange(n) + 0.5) / n
                try:
                    normal_dist = NormalDist(mu=stats["mean"], sigma=stats["std"])
                    theoretical = [float(normal_dist.inv_cdf(float(p))) for p in probs.tolist()]
                    qq_points = [
                        {"theoretical": float(tx), "sample": float(sx)}
                        for tx, sx in zip(theoretical, sample_values.tolist())
                    ]
                except Exception:  # noqa: BLE001
                    qq_points = []

                if scipy_stats is not None:
                    try:
                        shapiro_sample = clean
                        if len(shapiro_sample) > 5000:
                            shapiro_sample = shapiro_sample.sample(n=5000, random_state=42)
                        shapiro_stat, shapiro_p = scipy_stats.shapiro(shapiro_sample.values.astype(float))
                        normality["shapiro"] = {
                            "statistic": float(shapiro_stat),
                            "p_value": float(shapiro_p),
                            "is_normal_p05": bool(float(shapiro_p) >= 0.05),
                        }
                    except Exception:  # noqa: BLE001
                        normality["shapiro"] = None

                    try:
                        z = (clean.values.astype(float) - stats["mean"]) / max(stats["std"], 1e-12)
                        ks_stat, ks_p = scipy_stats.kstest(z, "norm")
                        normality["ks"] = {
                            "statistic": float(ks_stat),
                            "p_value": float(ks_p),
                            "is_normal_p05": bool(float(ks_p) >= 0.05),
                        }
                    except Exception:  # noqa: BLE001
                        normality["ks"] = None
                else:
                    normality["reason"] = "scipy_unavailable"
            elif len(clean) < 3:
                normality["reason"] = "insufficient_samples"
            elif stats["std"] <= 0:
                normality["reason"] = "zero_variance"

            if normality["reason"] is None and normality["shapiro"] is None and normality["ks"] is None:
                normality["reason"] = "test_failed"

            normality_tests.append(normality)

            numeric_distributions.append(
                {
                    "feature": feature,
                    "stats": stats,
                    "histogram": histogram,
                    "qq_plot": qq_points,
                    "normality": normality,
                }
            )
            boxplot_summary.append(
                {
                    "feature": feature,
                    "min": stats["min"],
                    "q25": q1,
                    "q50": q2,
                    "q75": q3,
                    "max": stats["max"],
                    "outlier_ratio_iqr": outlier_ratio,
                }
            )
            skewness_top.append({"feature": feature, "value": skewness})
            kurtosis_top.append({"feature": feature, "value": kurtosis})
            outlier_top.append({"feature": feature, "value": outlier_ratio})

    skewness_top.sort(key=lambda item: abs(float(item["value"])), reverse=True)
    kurtosis_top.sort(key=lambda item: abs(float(item["value"])), reverse=True)
    outlier_top.sort(key=lambda item: float(item["value"]), reverse=True)

    categorical_distributions = []
    if categorical_columns:
        missing_by_col = df[categorical_columns].isna().mean().sort_values(ascending=False)
        selected_categorical = [str(col) for col in missing_by_col.head(clean_top_categorical).index.tolist()]
        for feature in selected_categorical:
            series = df[feature].fillna("<<MISSING>>").astype(str)
            counts = series.value_counts()
            total = max(int(counts.sum()), 1)
            categorical_distributions.append(
                {
                    "feature": feature,
                    "unique_count": int(series.nunique()),
                    "top_values": [
                        {
                            "label": str(label),
                            "count": int(count),
                            "ratio": float(int(count) / total),
                        }
                        for label, count in counts.head(8).items()
                    ],
                }
            )

    payload = {
        "file_id": file_id,
        "rows": row_count,
        "numeric_feature_count": len(numeric_columns),
        "numeric_features": numeric_columns,
        "categorical_feature_count": len(categorical_columns),
        "numeric_distributions": numeric_distributions,
        "boxplot_summary": boxplot_summary,
        "skewness_top": skewness_top[:10],
        "kurtosis_top": kurtosis_top[:10],
        "outlier_top": outlier_top[:10],
        "normality_tests": normality_tests,
        "categorical_distributions": categorical_distributions,
    }
    _save_cache(cache_key, payload)
    return _to_builtin(payload)


def get_eda_multivariate(
    file_id: str,
    features: list[str],
    max_points: int = 1500,
    use_cache: bool = True,
) -> dict:
    schema_version = 1
    clean_features = [str(f).strip() for f in features if str(f).strip()]
    dedup_features: list[str] = []
    for feature in clean_features:
        if feature not in dedup_features:
            dedup_features.append(feature)
    clean_features = dedup_features[:3]
    if len(clean_features) < 2:
        raise ValueError("2개 이상의 numeric 피처를 선택해 주세요.")

    clean_max_points = max(300, min(int(max_points), 5000))
    cache_key = _cache_key(
        "multivariate",
        {
            "schema_version": schema_version,
            "file_id": file_id,
            "features": clean_features,
            "max_points": clean_max_points,
        },
    )
    if use_cache:
        cached = _load_cache(cache_key)
        if cached is not None:
            return cached

    df, _ = _read_dataframe(file_id)
    for feature in clean_features:
        if feature not in df.columns:
            raise KeyError(f"피처를 찾을 수 없습니다: {feature}")

    selected = df[clean_features].copy()
    for feature in clean_features:
        selected[feature] = pd.to_numeric(selected[feature], errors="coerce")
    selected = selected.dropna()
    if selected.empty:
        raise ValueError("선택한 피처 조합에 유효한 numeric 데이터가 없습니다.")

    total_rows = int(len(selected))
    if len(selected) > clean_max_points:
        sampled = selected.sample(n=clean_max_points, random_state=42)
    else:
        sampled = selected

    axes = {
        "x": clean_features[0],
        "y": clean_features[1],
        "z": clean_features[2] if len(clean_features) >= 3 else None,
    }

    points = []
    for _, row in sampled.iterrows():
        item = {
            "x": float(row[axes["x"]]),
            "y": float(row[axes["y"]]),
        }
        if axes["z"] is not None:
            item["z"] = float(row[axes["z"]])
        points.append(item)

    axis_stats = {}
    for key, col in axes.items():
        if col is None:
            continue
        series = selected[col]
        axis_stats[key] = {
            "feature": col,
            "min": float(series.min()),
            "max": float(series.max()),
            "mean": float(series.mean()),
            "std": float(series.std(ddof=0)),
        }

    payload = {
        "file_id": file_id,
        "mode": "3d" if axes["z"] else "2d",
        "axes": axes,
        "points": points,
        "rows_total": int(len(df)),
        "rows_valid": total_rows,
        "rows_sampled": int(len(points)),
        "stats": axis_stats,
    }
    _save_cache(cache_key, payload)
    return _to_builtin(payload)


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


def _detect_target_task_type(target: pd.Series) -> str:
    non_null = target.dropna()
    if non_null.empty:
        return "unknown"
    if not pd.api.types.is_numeric_dtype(non_null):
        return "classification"

    unique_count = int(non_null.nunique())
    dynamic_threshold = max(2, min(20, int(len(non_null) * 0.05)))
    if unique_count <= dynamic_threshold:
        return "classification"
    return "regression"


def _eta_squared(numeric_feature: pd.Series, target: pd.Series) -> float:
    frame = pd.DataFrame({"feature": numeric_feature, "target": target}).dropna()
    if len(frame) < 3 or frame["target"].nunique() <= 1:
        return 0.0

    mean_total = float(frame["feature"].mean())
    ss_total = float(((frame["feature"] - mean_total) ** 2).sum())
    if ss_total <= 0:
        return 0.0

    ss_between = float(
        frame.groupby("target")["feature"]
        .apply(lambda group: len(group) * float((group.mean() - mean_total) ** 2))
        .sum()
    )
    return max(0.0, min(1.0, ss_between / ss_total))


def get_target_insight(file_id: str, target_column: str, top_n: int = 10) -> dict:
    df, _ = _read_dataframe(file_id)
    if target_column not in df.columns:
        raise KeyError("요청한 target_column을 찾을 수 없습니다.")

    target = df[target_column]
    task_type = _detect_target_task_type(target)
    numeric_features = [str(col) for col in df.select_dtypes(include=["number"]).columns if col != target_column]

    if task_type == "regression":
        target_numeric = pd.to_numeric(target, errors="coerce")
        non_null_target = target_numeric.dropna()
        if non_null_target.empty:
            target_summary = {"type": "regression", "count": 0}
        else:
            target_summary = {
                "type": "regression",
                "count": int(non_null_target.shape[0]),
                "min": float(non_null_target.min()),
                "max": float(non_null_target.max()),
                "mean": float(non_null_target.mean()),
                "std": float(non_null_target.std(ddof=0)),
                "q25": float(non_null_target.quantile(0.25)),
                "q50": float(non_null_target.quantile(0.5)),
                "q75": float(non_null_target.quantile(0.75)),
            }
    else:
        vc = target.fillna("<<MISSING>>").astype(str).value_counts()
        total = max(int(vc.sum()), 1)
        target_summary = {
            "type": "classification",
            "count": total,
            "class_distribution": [
                {"label": str(label), "count": int(count), "ratio": float(count / total)}
                for label, count in vc.head(20).items()
            ],
        }

    scores = []
    for feature in numeric_features:
        series = pd.to_numeric(df[feature], errors="coerce")
        if task_type == "regression":
            target_numeric = pd.to_numeric(target, errors="coerce")
            joined = pd.concat([series, target_numeric], axis=1).dropna()
            if len(joined) < 3:
                continue
            score = float(joined.iloc[:, 0].corr(joined.iloc[:, 1], method="pearson"))
            method = "pearson_corr"
            direction = "positive" if score >= 0 else "negative"
        else:
            score = _eta_squared(series, target)
            method = "eta_squared"
            direction = "positive"

        if pd.isna(score):
            continue
        scores.append(
            {
                "feature": feature,
                "score": float(score),
                "abs_score": float(abs(score)),
                "method": method,
                "direction": direction,
            }
        )

    scores.sort(key=lambda item: item["abs_score"], reverse=True)
    capped_top_n = max(1, min(int(top_n), 30))

    warnings = []
    if not scores:
        warnings.append("타겟 인사이트 계산 가능한 numeric feature가 부족합니다.")
    if task_type == "unknown":
        warnings.append("타겟 컬럼의 유효한 값이 부족합니다.")

    return _to_builtin(
        {
            "file_id": file_id,
            "target_column": target_column,
            "task_type": task_type,
            "target_summary": target_summary,
            "numeric_feature_count": len(numeric_features),
            "top_related_features": scores[:capped_top_n],
            "warnings": warnings,
        }
    )
