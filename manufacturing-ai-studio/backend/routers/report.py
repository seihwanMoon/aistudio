from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from services.report_service import build_report

router = APIRouter()


@router.get("/{model_id}")
def download_report(model_id: int):
    try:
        pdf_path = build_report(model_id)
        return FileResponse(pdf_path, filename=f"report_{model_id}.pdf", media_type="application/pdf")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"리포트 생성 실패: {exc}") from exc
