from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.xai_service import get_global_explanation, get_local_explanation, get_partial_dependence

router = APIRouter()


class LocalExplainRequest(BaseModel):
    model_id: int
    features: dict
    top_n: int = 10
    class_index: int = 0


class PdpRequest(BaseModel):
    model_id: int
    feature_name: str
    grid_points: int = 20


@router.get("/global/{model_id}")
def global_explain(
    model_id: int,
    sample_size: int = Query(default=2000, ge=50, le=5000),
    top_n: int = Query(default=20, ge=1, le=200),
    class_index: int = Query(default=0, ge=0, le=20),
):
    try:
        return get_global_explanation(
            model_id=model_id,
            sample_size=sample_size,
            top_n=top_n,
            class_index=class_index,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Global XAI 계산 실패: {exc}") from exc


@router.post("/local")
def local_explain(payload: LocalExplainRequest):
    try:
        return get_local_explanation(
            model_id=payload.model_id,
            features=payload.features,
            top_n=payload.top_n,
            class_index=payload.class_index,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Local XAI 계산 실패: {exc}") from exc


@router.post("/pdp")
def partial_dependence_explain(payload: PdpRequest):
    try:
        return get_partial_dependence(
            model_id=payload.model_id,
            feature_name=payload.feature_name,
            grid_points=payload.grid_points,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"PDP 계산 실패: {exc}") from exc


@router.get("/health")
def xai_health():
    return {"router": "xai", "status": "ok"}
