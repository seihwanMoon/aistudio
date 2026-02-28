from __future__ import annotations

import os

MLFLOW_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
EXPERIMENT_NAME = os.getenv("MLFLOW_EXPERIMENT_NAME", "manufacturing_ai")

try:
    import mlflow
    from mlflow.exceptions import MlflowException
    from mlflow.tracking import MlflowClient
except Exception:  # noqa: BLE001
    mlflow = None
    MlflowException = Exception
    MlflowClient = None


def get_client():
    if mlflow is None or MlflowClient is None:
        raise RuntimeError("mlflow가 설치되지 않았거나 초기화에 실패했습니다.")
    mlflow.set_tracking_uri(MLFLOW_URI)
    return MlflowClient(tracking_uri=MLFLOW_URI)


def ensure_experiment() -> str:
    if mlflow is None:
        return "0"
    mlflow.set_tracking_uri(MLFLOW_URI)
    try:
        exp = mlflow.get_experiment_by_name(EXPERIMENT_NAME)
        if exp:
            return exp.experiment_id
        return mlflow.create_experiment(EXPERIMENT_NAME)
    except MlflowException:
        return "0"
