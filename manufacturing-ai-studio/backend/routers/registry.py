from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.mlflow_utils import get_client

router = APIRouter()


class RegisterPayload(BaseModel):
    model_name: str
    run_id: str
    artifact_path: str = "model"


class StagePayload(BaseModel):
    stage: str


@router.post("/register")
def register_model(payload: RegisterPayload):
    client = get_client()
    try:
        model_uri = f"runs:/{payload.run_id}/{payload.artifact_path}"

        try:
            registered = client.get_registered_model(payload.model_name)
        except Exception:
            registered = client.create_registered_model(payload.model_name)

        run = client.get_run(payload.run_id)
        run_params = run.data.params or {}
        run_metrics = run.data.metrics or {}

        primary_metric = run_metrics.get("primary_metric")
        primary_metric_text = f"{primary_metric:.6f}" if primary_metric is not None else "N/A"
        now_utc = datetime.now(timezone.utc).isoformat()

        model_description = "\n".join(
            [
                "Manufacturing AI Studio 자동 등록 모델",
                f"- 최근 등록 시각(UTC): {now_utc}",
                f"- 최근 Run ID: {payload.run_id}",
                f"- Task: {run_params.get('task_type', 'N/A')}",
                f"- Target: {run_params.get('target_column', 'N/A')}",
                f"- Primary Metric: {primary_metric_text}",
            ]
        )
        client.update_registered_model(name=payload.model_name, description=model_description)

        version = client.create_model_version(name=payload.model_name, source=model_uri, run_id=payload.run_id)
        version_description = "\n".join(
            [
                "Manufacturing AI Studio 자동 등록 버전",
                f"- Registered At (UTC): {now_utc}",
                f"- Run ID: {payload.run_id}",
                f"- Task: {run_params.get('task_type', 'N/A')}",
                f"- Target: {run_params.get('target_column', 'N/A')}",
                f"- Feature Count: {run_params.get('feature_count', 'N/A')}",
                f"- Primary Metric: {primary_metric_text}",
            ]
        )
        client.update_model_version(name=payload.model_name, version=version.version, description=version_description)

        model_tags = {
            "source_system": "manufacturing_ai_studio",
            "task_type": str(run_params.get("task_type", "N/A")),
            "target_column": str(run_params.get("target_column", "N/A")),
            "feature_count": str(run_params.get("feature_count", "N/A")),
            "experiment_name": str(run_params.get("experiment_name", "N/A")),
            "latest_run_id": payload.run_id,
        }
        for key, value in model_tags.items():
            client.set_registered_model_tag(name=payload.model_name, key=key, value=value)

        version_tags = {
            "run_id": payload.run_id,
            "artifact_path": payload.artifact_path,
            "primary_metric": primary_metric_text,
            "registered_at_utc": now_utc,
        }
        for metric_key, metric_value in run_metrics.items():
            version_tags[f"metric_{metric_key}"] = f"{metric_value:.6f}"
        for key, value in version_tags.items():
            client.set_model_version_tag(name=payload.model_name, version=version.version, key=key, value=value)

        try:
            client.set_registered_model_alias(name=payload.model_name, alias="champion", version=version.version)
        except Exception:
            pass

        return {
            "registered_model": registered.name,
            "version": version.version,
            "run_id": payload.run_id,
            "primary_metric": primary_metric_text,
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"모델 등록 실패: {exc}") from exc


@router.put("/{model_name}/stage")
def transition_stage(model_name: str, payload: StagePayload):
    client = get_client()
    try:
        versions = client.search_model_versions(f"name='{model_name}'")
        if not versions:
            raise HTTPException(status_code=404, detail="등록된 모델 버전이 없습니다.")
        latest = sorted(versions, key=lambda v: int(v.version))[-1]
        client.transition_model_version_stage(name=model_name, version=latest.version, stage=payload.stage)
        return {"model_name": model_name, "version": latest.version, "stage": payload.stage}
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"스테이지 변경 실패: {exc}") from exc


@router.get("")
def list_registry():
    client = get_client()
    try:
        models = client.search_registered_models()
        payload = []
        for model in models:
            versions = client.search_model_versions(f"name='{model.name}'")
            payload.append(
                {
                    "name": model.name,
                    "description": model.description,
                    "versions": [
                        {
                            "version": v.version,
                            "run_id": v.run_id,
                            "stage": v.current_stage,
                            "status": v.status,
                        }
                        for v in versions
                    ],
                }
            )
        return {"models": payload}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"레지스트리 조회 실패: {exc}") from exc
