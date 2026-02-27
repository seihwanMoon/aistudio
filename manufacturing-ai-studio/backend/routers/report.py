from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def health():
    return {"router": "report", "status": "ok"}
