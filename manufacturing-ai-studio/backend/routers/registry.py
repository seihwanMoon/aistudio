from __future__ import annotations

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
        registered = client.create_registered_model(payload.model_name)
        version = client.create_model_version(name=payload.model_name, source=model_uri, run_id=payload.run_id)
        return {
            "registered_model": registered.name,
            "version": version.version,
            "run_id": payload.run_id,
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
