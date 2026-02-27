from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import chardet
import pandas as pd

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".csv", ".xlsx"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def _detect_encoding(file_path: Path) -> str:
    with file_path.open("rb") as f:
        sample = f.read(1024 * 1024)
    detected = chardet.detect(sample)
    return detected.get("encoding") or "utf-8"


def save_upload(filename: str, content: bytes) -> tuple[str, Path]:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("지원하지 않는 파일 형식입니다. CSV 또는 XLSX만 업로드 가능합니다.")
    if len(content) > MAX_FILE_SIZE:
        raise ValueError("파일 크기가 50MB를 초과했습니다.")

    file_id = uuid4().hex
    saved_path = UPLOAD_DIR / f"{file_id}{ext}"
    saved_path.write_bytes(content)
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
