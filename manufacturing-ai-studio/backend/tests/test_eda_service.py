from __future__ import annotations

from pathlib import Path

import pandas as pd

from services import eda_service


def _prepare_csv(monkeypatch, tmp_path: Path, df: pd.DataFrame, file_id: str = "test-file") -> Path:
    csv_path = tmp_path / f"{file_id}.csv"
    df.to_csv(csv_path, index=False)
    monkeypatch.setattr(eda_service, "_find_file_by_id", lambda _file_id: csv_path)
    return csv_path


def test_summary_cache_hit_and_miss(monkeypatch, tmp_path: Path):
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(eda_service, "CACHE_DIR", cache_dir)

    initial = pd.DataFrame(
        {
            "feature_a": [1.0, 2.0, 3.0],
            "feature_b": [10.0, None, 30.0],
            "target": [100.0, 200.0, 300.0],
        }
    )
    csv_path = _prepare_csv(monkeypatch, tmp_path, initial)

    summary_1 = eda_service.get_eda_summary(file_id="any", use_cache=True)
    assert summary_1["rows"] == 3
    assert summary_1["columns"] == 3
    assert len(list(cache_dir.glob("*.json"))) == 1

    updated = pd.DataFrame(
        {
            "feature_a": [1.0, 2.0, 3.0, 4.0],
            "feature_b": [10.0, 20.0, 30.0, 40.0],
            "target": [100.0, 200.0, 300.0, 400.0],
        }
    )
    updated.to_csv(csv_path, index=False)

    summary_cached = eda_service.get_eda_summary(file_id="any", use_cache=True)
    assert summary_cached["rows"] == 3

    summary_fresh = eda_service.get_eda_summary(file_id="any", use_cache=False)
    assert summary_fresh["rows"] == 4


def test_correlation_high_pairs(monkeypatch, tmp_path: Path):
    df = pd.DataFrame(
        {
            "x1": [1, 2, 3, 4, 5, 6],
            "x2": [2, 4, 6, 8, 10, 12],
            "x3": [10, 9, 8, 7, 6, 5],
        }
    )
    _prepare_csv(monkeypatch, tmp_path, df)

    payload = eda_service.get_eda_correlation(
        file_id="any",
        method="pearson",
        max_features=10,
        threshold=0.95,
        use_cache=False,
    )
    pairs = {(item["left"], item["right"]) for item in payload["high_correlation_pairs"]}
    assert ("x1", "x2") in pairs or ("x2", "x1") in pairs


def test_target_insight_regression(monkeypatch, tmp_path: Path):
    df = pd.DataFrame(
        {
            "x_strong": [1, 2, 3, 4, 5, 6],
            "x_weak": [5, 5, 6, 6, 5, 6],
            "target": [3, 6, 9, 12, 15, 18],
        }
    )
    _prepare_csv(monkeypatch, tmp_path, df)

    insight = eda_service.get_target_insight(file_id="any", target_column="target", top_n=2)
    assert insight["task_type"] == "regression"
    assert insight["top_related_features"][0]["feature"] == "x_strong"
    assert insight["top_related_features"][0]["method"] == "pearson_corr"


def test_target_insight_classification(monkeypatch, tmp_path: Path):
    df = pd.DataFrame(
        {
            "x_temp": [100, 110, 120, 200, 210, 220],
            "x_noise": [1, 1, 1, 1, 2, 2],
            "target": ["A", "A", "A", "B", "B", "B"],
        }
    )
    _prepare_csv(monkeypatch, tmp_path, df)

    insight = eda_service.get_target_insight(file_id="any", target_column="target", top_n=3)
    assert insight["task_type"] == "classification"
    assert insight["target_summary"]["type"] == "classification"
    assert all(item["method"] == "eta_squared" for item in insight["top_related_features"])
