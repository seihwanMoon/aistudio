from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from services.data_service import build_preview, get_upload_metadata, load_dataframe, save_upload

router = APIRouter()


@router.post("/upload")
async def upload_data(file: UploadFile = File(...)):
    content = await file.read()
    try:
        file_id, saved_path = save_upload(file.filename or "uploaded.csv", content)
        meta = get_upload_metadata(file_id)
        return {
            "data_id": file_id,
            "data_key": meta.get("data_key"),
            "data_name": meta.get("original_filename"),
            "file_id": file_id,
            "filename": file.filename,
            "saved_path": str(saved_path),
            "message": "업로드 완료",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/{file_id}/preview")
def preview_data(file_id: str):
    candidates = [Path("data/uploads") / f"{file_id}.csv", Path("data/uploads") / f"{file_id}.xlsx"]
    file_path = next((path for path in candidates if path.exists()), None)

    if not file_path:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    try:
        df, encoding = load_dataframe(file_path)
        payload = build_preview(df)
        meta = get_upload_metadata(file_id)
        payload["encoding"] = encoding
        payload["data_id"] = file_id
        payload["data_key"] = meta.get("data_key")
        payload["data_name"] = meta.get("original_filename")
        payload["file_id"] = file_id
        return payload
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"미리보기 생성 실패: {e}") from e


@router.get("/health")
def health():
    return {"router": "data", "status": "ok"}
