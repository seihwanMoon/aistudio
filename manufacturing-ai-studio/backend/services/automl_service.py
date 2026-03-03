from __future__ import annotations

import json
import os
import re
import threading
import time
from pathlib import Path

import joblib
try:
    import mlflow
    import mlflow.sklearn
    from mlflow.models import infer_signature
except Exception:  # noqa: BLE001
    mlflow = None
    infer_signature = None
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from database import SessionLocal
from models import Experiment, Model
from services.data_service import get_upload_metadata, load_dataframe, set_upload_display_name
from services.drift_service import save_baseline_from_training
from services.eda_service import get_eda_correlation, get_eda_summary
from services.mlflow_utils import EXPERIMENT_NAME, ensure_experiment

MODEL_DIR = Path("data/models")
MODEL_DIR.mkdir(parents=True, exist_ok=True)
SESSION_STATE_PATH = Path("data/cache/training_sessions.json")
SESSION_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
MAX_TRAIN_ROWS = int(os.getenv("MAX_TRAIN_ROWS", "50000"))

TRAINING_SESSIONS: dict[str, dict] = {}
_SESSIONS_LOCK = threading.Lock()


def _metadata_path(model_path: Path) -> Path:
    return model_path.with_suffix(".meta.json")


def _save_model_metadata(model_path: Path, payload: dict) -> None:
    _metadata_path(model_path).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _load_model_metadata(model_path: Path) -> dict:
    meta_path = _metadata_path(model_path)
    if not meta_path.exists():
        return {}
    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def _find_file_by_id(file_id: str) -> Path:
    for ext in (".csv", ".xlsx"):
        path = Path("data/uploads") / f"{file_id}{ext}"
        if path.exists():
            return path
    raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_id}")


def _build_feature_importance(model, feature_columns: list[str]) -> dict[str, float]:
    if not hasattr(model, "feature_importances_"):
        return {col: 0.0 for col in feature_columns}
    values = model.feature_importances_.tolist()
    return {col: float(score) for col, score in zip(feature_columns, values)}


def _serializable_sessions() -> dict:
    snapshot = {}
    for session_id, payload in TRAINING_SESSIONS.items():
        snapshot[session_id] = {
            "status": payload.get("status"),
            "progress": payload.get("progress", 0),
            "logs": payload.get("logs", []),
            "created_at": payload.get("created_at"),
            "payload": payload.get("payload"),
            "result": payload.get("result"),
            "error": payload.get("error"),
        }
    return {"sessions": snapshot}


def _persist_training_sessions() -> None:
    with _SESSIONS_LOCK:
        SESSION_STATE_PATH.write_text(
            json.dumps(_serializable_sessions(), ensure_ascii=False),
            encoding="utf-8",
        )


def _load_persisted_sessions() -> dict:
    if not SESSION_STATE_PATH.exists():
        return {}
    try:
        payload = json.loads(SESSION_STATE_PATH.read_text(encoding="utf-8"))
        sessions = payload.get("sessions", {})
        return sessions if isinstance(sessions, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def _slugify_data_name(data_name: str | None) -> str:
    stem = Path(str(data_name or "dataset")).stem
    normalized = re.sub(r"[^A-Za-z0-9_-]+", "_", stem).strip("_").lower()
    return normalized[:60] or "dataset"


def _build_mlflow_run_name(session_id: str, data_name: str | None = None) -> str:
    ts = str(int(time.time() * 1000))
    if session_id:
        last = session_id.rsplit("-", 1)[-1]
        if last.isdigit():
            ts = last
    if data_name:
        base = Path(str(data_name)).stem or "dataset"
    elif session_id.startswith("session-"):
        base = session_id.removeprefix("session-")
    else:
        base = session_id
    run_label = re.sub(r"[^0-9A-Za-z가-힣._-]+", "_", str(base)).strip("_") or "dataset"
    return f"train-{run_label}-{ts}"


def _log_eda_xai_artifacts_to_mlflow(mlflow_run_id: str | None, file_id: str, model_id: int) -> dict:
    status = {
        "eda_summary_logged": False,
        "eda_correlation_logged": False,
        "xai_global_logged": False,
    }
    if mlflow is None or not mlflow_run_id:
        return status

    eda_summary = None
    eda_correlation = None
    xai_global = None

    try:
        eda_summary = get_eda_summary(file_id=file_id, use_cache=True)
    except Exception:
        eda_summary = None
    try:
        eda_correlation = get_eda_correlation(file_id=file_id, method="pearson", max_features=30, threshold=0.8, use_cache=True)
    except Exception:
        eda_correlation = None
    try:
        from services.xai_service import get_global_explanation

        xai_global = get_global_explanation(model_id=model_id, sample_size=1000, top_n=15)
    except Exception:
        xai_global = None

    try:
        with mlflow.start_run(run_id=mlflow_run_id):
            if eda_summary is not None:
                mlflow.log_dict(eda_summary, "eda/summary.json")
                status["eda_summary_logged"] = True
            if eda_correlation is not None:
                mlflow.log_dict(eda_correlation, "eda/correlation.json")
                status["eda_correlation_logged"] = True
            if xai_global is not None:
                mlflow.log_dict(xai_global, "xai/global_shap.json")
                status["xai_global_logged"] = True

            tags = {}
            if eda_summary is not None:
                tags["eda_quality_score"] = str(eda_summary.get("quality_score", ""))
            if xai_global is not None:
                top_features = xai_global.get("top_features", [])
                if top_features:
                    tags["xai_top_feature"] = str(top_features[0].get("feature", ""))
                tags["xai_sample_size"] = str(xai_global.get("sample_size", 0))
            if tags:
                mlflow.set_tags(tags)
    except Exception:
        return status

    return status


def _run_training(session_id: str, file_id: str, target_column: str, feature_columns: list[str], time_budget: int, task_type: str):
    session = TRAINING_SESSIONS[session_id]
    db = SessionLocal()
    mlflow_run_id = None
    preferred_data_name = (session.get("payload") or {}).get("data_name")
    if preferred_data_name:
        upload_meta = set_upload_display_name(file_id=file_id, data_name=str(preferred_data_name))
    else:
        upload_meta = get_upload_metadata(file_id)
    data_ref = str(upload_meta.get("data_id", file_id))
    data_name = str(upload_meta.get("original_filename", f"{file_id}.csv"))
    try:
        session.update({"status": "running", "progress": 10, "logs": ["학습 세션 시작"]})
        _persist_training_sessions()

        data_path = _find_file_by_id(file_id)
        df, _ = load_dataframe(data_path)
        df = df.dropna(subset=[target_column]).fillna(0)
        if len(df) > MAX_TRAIN_ROWS:
            df = df.sample(n=MAX_TRAIN_ROWS, random_state=42)
            session["logs"].append(f"학습 샘플링 적용: {MAX_TRAIN_ROWS}행")

        X = df[feature_columns]
        y = df[target_column]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        session["progress"] = 35
        session["logs"].append("학습/검증 데이터 분할 완료")
        _persist_training_sessions()

        estimator = RandomForestRegressor(n_estimators=120, random_state=42) if task_type == "regression" else RandomForestClassifier(n_estimators=120, random_state=42)

        ensure_experiment()
        start = time.time()
        estimator.fit(X_train, y_train)
        elapsed = time.time() - start

        predictions = estimator.predict(X_test)
        if task_type == "regression":
            metrics = {"r2_score": float(r2_score(y_test, predictions)), "mae": float(mean_absolute_error(y_test, predictions))}
            metric_name = "r2_score"
            metric_value = metrics["r2_score"]
            confusion = []
        else:
            metrics = {
                "accuracy": float(accuracy_score(y_test, predictions)),
                "f1_score": float(f1_score(y_test, predictions, average="weighted")),
            }
            metric_name = "accuracy"
            metric_value = metrics["accuracy"]
            confusion = confusion_matrix(y_test, predictions).tolist()

        feature_importance = _build_feature_importance(estimator, feature_columns)

        if mlflow is not None:
            try:
                with mlflow.start_run(run_name=_build_mlflow_run_name(session_id=session_id, data_name=data_name)) as run:
                    mlflow_run_id = run.info.run_id
                    mlflow.log_params({
                        "task_type": task_type,
                        "target_column": target_column,
                        "feature_count": len(feature_columns),
                        "feature_columns": ",".join(feature_columns),
                        "time_budget": time_budget,
                        "experiment_name": EXPERIMENT_NAME,
                    })
                    mlflow.log_metrics(metrics)
                    mlflow.log_metric("primary_metric", metric_value)
                    mlflow.set_tags({
                        "project": "manufacturing_ai_studio",
                        "pipeline": "automl_training",
                        "session": session_id,
                        "data_ref": data_name,
                        "data_name": data_name,
                        "file_id": file_id,
                        "task_type": task_type,
                        "target_column": target_column,
                        "model_family": "random_forest",
                    })

                    mlflow.log_dict(
                        {
                            "metric_name": metric_name,
                            "metric_value": metric_value,
                            "metrics": metrics,
                            "feature_importance": feature_importance,
                            "training_time_sec": elapsed,
                            "feature_columns": feature_columns,
                            "target_column": target_column,
                            "task_type": task_type,
                        },
                        "training_summary.json",
                    )

                    input_example = X_train.head(min(5, len(X_train))).copy()
                    signature = None
                    if infer_signature is not None and not input_example.empty:
                        sample_prediction = estimator.predict(input_example)
                        signature = infer_signature(input_example, sample_prediction)

                    if signature is not None:
                        mlflow.sklearn.log_model(
                            estimator,
                            artifact_path="model",
                            signature=signature,
                            input_example=input_example,
                        )
                    else:
                        mlflow.sklearn.log_model(estimator, artifact_path="model")
            except Exception:
                mlflow_run_id = None

        session["progress"] = 70
        session["logs"].append("모델 학습 완료")
        _persist_training_sessions()

        session["progress"] = 90
        session["logs"].append("평가 지표 계산 완료")
        _persist_training_sessions()

        experiment = Experiment(name=f"auto-experiment-{session_id[:8]}", status="done", task_type=task_type, target_column=target_column)
        db.add(experiment)
        db.flush()

        model_path = MODEL_DIR / f"{session_id}.joblib"
        joblib.dump({"model": estimator, "feature_columns": feature_columns, "target_column": target_column, "task_type": task_type}, model_path)

        trained_model = Model(
            experiment_id=experiment.id,
            model_name=f"rf_{task_type}",
            model_type=task_type,
            metric_name=metric_name,
            metric_value=metric_value,
            model_path=str(model_path),
        )
        db.add(trained_model)
        db.commit()
        db.refresh(trained_model)

        _save_model_metadata(
            model_path=model_path,
            payload={
                "session_id": session_id,
                "model_id": trained_model.id,
                "experiment_id": experiment.id,
                "file_id": file_id,
                "data_ref": data_ref,
                "data_key": data_ref,
                "data_name": data_name,
                "target_column": target_column,
                "feature_columns": feature_columns,
                "task_type": task_type,
                "time_budget": int(time_budget),
                "train_rows": int(len(X_train)),
                "test_rows": int(len(X_test)),
                "metric_name": metric_name,
                "metric_value": float(metric_value),
                "metrics": metrics,
                "training_time": float(elapsed),
                "created_at": time.time(),
                "mlflow_run_id": mlflow_run_id,
            },
        )

        save_baseline_from_training(trained_model.id, X_train)
        artifact_log_status = _log_eda_xai_artifacts_to_mlflow(
            mlflow_run_id=mlflow_run_id,
            file_id=file_id,
            model_id=trained_model.id,
        )

        result_payload = {
            "mlflow_run_id": mlflow_run_id,
            "model_id": trained_model.id,
            "metrics": metrics,
            "feature_importance": feature_importance,
            "confusion_matrix": confusion,
            "training_time": elapsed,
            "task_type": task_type,
            "target_column": target_column,
            "feature_columns": feature_columns,
            "file_id": file_id,
            "data_ref": data_ref,
            "data_key": data_ref,
            "data_name": data_name,
            "mlflow_artifacts": artifact_log_status,
        }

        session.update({"status": "done", "progress": 100, "logs": session["logs"] + ["학습 세션 완료"], "result": result_payload})
        _persist_training_sessions()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        session.update({"status": "failed", "progress": 100, "logs": session.get("logs", []) + [f"오류: {exc}"], "error": str(exc)})
        _persist_training_sessions()
    finally:
        db.close()


def _start_worker(session_id: str, file_id: str, target_column: str, feature_columns: list[str], time_budget: int, task_type: str) -> None:
    worker = threading.Thread(target=_run_training, args=(session_id, file_id, target_column, feature_columns, time_budget, task_type), daemon=True)
    worker.start()


def start_training(
    file_id: str,
    target_column: str,
    feature_columns: list[str],
    time_budget: int,
    task_type: str,
    data_name: str | None = None,
    session_id: str | None = None,
    resumed: bool = False,
) -> str:
    if data_name:
        upload_meta = set_upload_display_name(file_id=file_id, data_name=data_name)
    else:
        upload_meta = get_upload_metadata(file_id)
    if session_id:
        resolved_session_id = session_id
    else:
        data_slug = str(upload_meta.get("data_slug", _slugify_data_name(data_name)))
        resolved_session_id = f"session-{data_slug}-{int(time.time() * 1000)}"
    TRAINING_SESSIONS[resolved_session_id] = {
        "status": "queued",
        "progress": 0,
        "logs": ["작업 대기 중"] if not resumed else ["재시작 후 학습 재개"],
        "created_at": time.time(),
        "payload": {
            "file_id": file_id,
            "target_column": target_column,
            "feature_columns": feature_columns,
            "time_budget": time_budget,
            "task_type": task_type,
            "data_name": str(upload_meta.get("original_filename") or data_name or f"{file_id}.csv"),
        },
    }
    _persist_training_sessions()
    _start_worker(
        session_id=resolved_session_id,
        file_id=file_id,
        target_column=target_column,
        feature_columns=feature_columns,
        time_budget=time_budget,
        task_type=task_type,
    )
    return resolved_session_id


def restore_incomplete_training_sessions() -> list[str]:
    persisted = _load_persisted_sessions()
    resumed = []
    for session_id, state in persisted.items():
        status = state.get("status")
        payload = state.get("payload") or {}
        if status not in {"queued", "running", "starting"}:
            continue
        required_keys = {"file_id", "target_column", "feature_columns", "time_budget", "task_type"}
        if not required_keys.issubset(payload.keys()):
            continue
        if session_id in TRAINING_SESSIONS:
            continue

        start_training(
            file_id=payload["file_id"],
            target_column=payload["target_column"],
            feature_columns=list(payload["feature_columns"]),
            time_budget=int(payload["time_budget"]),
            task_type=str(payload["task_type"]),
            data_name=payload.get("data_name"),
            session_id=session_id,
            resumed=True,
        )
        resumed.append(session_id)
    return resumed


def get_session_status(session_id: str) -> dict:
    if session_id not in TRAINING_SESSIONS:
        raise KeyError("세션을 찾을 수 없습니다.")
    return TRAINING_SESSIONS[session_id]


def get_model_result(model_id: int) -> dict:
    db = SessionLocal()
    try:
        model = db.query(Model).filter(Model.id == model_id).first()
        if not model:
            raise KeyError("모델을 찾을 수 없습니다.")
        experiment = db.query(Experiment).filter(Experiment.id == model.experiment_id).first()
        artifact = joblib.load(model.model_path)
        model_obj = artifact["model"]
        feature_columns = artifact["feature_columns"]
        importances = _build_feature_importance(model_obj, feature_columns)
        metadata = _load_model_metadata(Path(model.model_path))
        file_id = metadata.get("file_id")
        upload_meta = get_upload_metadata(str(file_id)) if file_id else {}
        data_ref = metadata.get("data_ref") or metadata.get("data_id") or file_id or upload_meta.get("data_id")
        return {
            "model_id": model.id,
            "model_name": model.model_name,
            "task_type": model.model_type,
            "metric_name": model.metric_name,
            "metric_value": model.metric_value,
            "feature_importance": importances,
            "target_column": artifact["target_column"],
            "feature_columns": feature_columns,
            "file_id": file_id,
            "data_ref": data_ref,
            "data_id": data_ref,
            "data_key": data_ref,
            "data_name": metadata.get("data_name") or upload_meta.get("original_filename"),
            "mlflow_run_id": metadata.get("mlflow_run_id"),
            "training_time": metadata.get("training_time"),
            "experiment_name": experiment.name if experiment else None,
            "created_at": str(model.created_at),
        }
    finally:
        db.close()
