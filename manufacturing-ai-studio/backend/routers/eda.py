from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from services.eda_service import get_eda_correlation, get_eda_summary, get_feature_profile

router = APIRouter()


@router.get("/{file_id}/summary")
def eda_summary(file_id: str, use_cache: bool = Query(default=True)):
    try:
        return get_eda_summary(file_id=file_id, use_cache=use_cache)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"EDA summary 생성 실패: {exc}") from exc


@router.get("/{file_id}/correlation")
def eda_correlation(
    file_id: str,
    method: str = Query(default="pearson"),
    max_features: int = Query(default=30, ge=2, le=60),
    threshold: float = Query(default=0.8, ge=0.0, le=1.0),
    use_cache: bool = Query(default=True),
):
    try:
        return get_eda_correlation(
            file_id=file_id,
            method=method,
            max_features=max_features,
            threshold=threshold,
            use_cache=use_cache,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"EDA correlation 생성 실패: {exc}") from exc


@router.get("/{file_id}/feature/{feature_name}")
def eda_feature_profile(file_id: str, feature_name: str, target_column: str | None = Query(default=None)):
    try:
        return get_feature_profile(file_id=file_id, feature_name=feature_name, target_column=target_column)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"EDA feature profile 생성 실패: {exc}") from exc


@router.get("/health")
def eda_health():
    return {"router": "eda", "status": "ok"}
