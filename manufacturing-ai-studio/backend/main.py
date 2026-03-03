from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from database import Base, engine
import models  # noqa: F401
from routers import auth, data, drift, experiments, predict, realtime, registry, report, train, watcher
from scheduler import start_scheduler

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Manufacturing AI Studio",
    description="중소제조기업 로컬 AutoML+MLOps 플랫폼",
    version="1.0.0",
)

DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:43000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:43000",
]
_cors_env = os.getenv("CORS_ALLOW_ORIGINS", "")
allow_origins = [origin.strip() for origin in _cors_env.split(",") if origin.strip()] or DEFAULT_CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    # 로컬 실행 시 프론트 포트가 바뀌어도 CORS 차단이 나지 않도록 허용
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["인증"])
app.include_router(data.router, prefix="/api/data", tags=["데이터"])
app.include_router(train.router, prefix="/api/train", tags=["학습"])
app.include_router(predict.router, prefix="/api/predict", tags=["예측"])
app.include_router(report.router, prefix="/api/report", tags=["리포트"])

# Phase 2
app.include_router(experiments.router, prefix="/api/experiments", tags=["실험"])
app.include_router(registry.router, prefix="/api/registry", tags=["레지스트리"])
app.include_router(drift.router, prefix="/api/drift", tags=["드리프트"])

# Phase 3
app.include_router(realtime.router, prefix="", tags=["실시간"])
app.include_router(watcher.router, prefix="/api/watcher", tags=["파일감시"])


@app.on_event("startup")
def _on_startup():
    start_scheduler()


@app.get("/")
def root():
    return {"message": "Manufacturing AI Studio API v1.0", "status": "running"}
