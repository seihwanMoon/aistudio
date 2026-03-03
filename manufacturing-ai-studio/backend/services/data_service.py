from __future__ import annotations

import json
import re
import time
from pathlib import Path
from uuid import uuid4

import chardet
import pandas as pd

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".csv", ".xlsx"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def _safe_filename(filename: str | None) -> str:
    name = Path(filename or "uploaded.csv").name
    return name or "uploaded.csv"


def _build_data_slug(filename: str | None) -> str:
    stem = Path(_safe_filename(filename)).stem
    normalized = re.sub(r"[^A-Za-z0-9_-]+", "_", stem).strip("_").lower()
    if not normalized:
        return "dataset"
    return normalized[:60]


def build_data_key(file_id: str, filename: str | None = None) -> str:
    # Keep data_key as a backward-compatible alias of the single data identifier.
    return str(file_id)


def _meta_path(file_id: str) -> Path:
    return UPLOAD_DIR / f"{file_id}.meta.json"


def set_upload_display_name(file_id: str, data_name: str | None) -> dict:
    if not data_name:
        return get_upload_metadata(file_id)
    meta = get_upload_metadata(file_id)
    normalized_name = _safe_filename(data_name)
    meta["original_filename"] = normalized_name
    meta["data_slug"] = _build_data_slug(normalized_name)
    _meta_path(file_id).write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return meta


def _normalize_meta_payload(file_id: str, payload: dict) -> dict:
    normalized = dict(payload or {})
    data_ref = str(normalized.get("data_id") or normalized.get("file_id") or file_id)
    normalized["data_id"] = data_ref
    normalized["file_id"] = data_ref
    normalized["data_key"] = data_ref
    original_filename = normalized.get("original_filename")
    if not original_filename:
        original_filename = normalized.get("saved_filename") or f"{file_id}.csv"
    normalized["original_filename"] = str(original_filename)
    normalized["data_slug"] = str(normalized.get("data_slug") or _build_data_slug(original_filename))
    return normalized


def get_upload_metadata(file_id: str) -> dict:
    path = _meta_path(file_id)
    if path.exists():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                normalized = _normalize_meta_payload(file_id=file_id, payload=payload)
                if normalized != payload:
                    path.write_text(
                        json.dumps(normalized, ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )
                return normalized
        except Exception:  # noqa: BLE001
            pass

    original_filename = f"{file_id}.csv"
    for ext in (".csv", ".xlsx"):
        if (UPLOAD_DIR / f"{file_id}{ext}").exists():
            original_filename = f"{file_id}{ext}"
            break
    fallback = {
        "data_id": file_id,
        "file_id": file_id,
        "original_filename": original_filename,
        "data_key": build_data_key(file_id=file_id, filename=original_filename),
        "data_slug": _build_data_slug(original_filename),
    }
    path.write_text(json.dumps(fallback, ensure_ascii=False, indent=2), encoding="utf-8")
    return fallback


def _detect_encoding(file_path: Path) -> str:
    with file_path.open("rb") as f:
        sample = f.read(1024 * 1024)
    detected = chardet.detect(sample)
    return detected.get("encoding") or "utf-8"


def save_upload(filename: str, content: bytes) -> tuple[str, Path]:
    safe_filename = _safe_filename(filename)
    ext = Path(safe_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("지원하지 않는 파일 형식입니다. CSV 또는 XLSX만 업로드 가능합니다.")
    if len(content) > MAX_FILE_SIZE:
        raise ValueError("파일 크기가 50MB를 초과했습니다.")

    file_id = uuid4().hex
    saved_path = UPLOAD_DIR / f"{file_id}{ext}"
    saved_path.write_bytes(content)
    _meta_path(file_id).write_text(
        json.dumps(
            {
                "data_id": file_id,
                "file_id": file_id,
                "original_filename": safe_filename,
                "saved_filename": saved_path.name,
                "data_key": build_data_key(file_id=file_id, filename=safe_filename),
                "data_slug": _build_data_slug(safe_filename),
                "uploaded_at": time.time(),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return file_id, saved_path


def load_dataframe(file_path: Path) -> tuple[pd.DataFrame, str | None]:
    ext = file_path.suffix.lower()
    if ext == ".csv":
        encoding = _detect_encoding(file_path)
        df = pd.read_csv(file_path, encoding=encoding)
        return df, encoding

    if ext == ".xlsx":
        df = pd.read_excel(file_path)
        return df, None

    raise ValueError("지원하지 않는 파일 형식입니다.")


def build_preview(df: pd.DataFrame, max_rows: int = 100) -> dict:
    preview = df.head(max_rows).replace({float("nan"): None})
    missing_counts = df.isna().sum().to_dict()
    dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}

    return {
        "rows": min(len(df), max_rows),
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "columns": list(df.columns),
        "dtypes": dtypes,
        "missing_counts": missing_counts,
        "data": preview.where(pd.notna(preview), None).to_dict(orient="records"),
    }
