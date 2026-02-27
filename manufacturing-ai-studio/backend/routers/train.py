from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def health():
    return {"router": "train", "status": "ok"}
