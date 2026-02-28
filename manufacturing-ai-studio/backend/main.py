from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
import models  # noqa: F401
from routers import data, drift, experiments, predict, registry, report, train
from scheduler import start_scheduler

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Manufacturing AI Studio",
    description="중소제조기업 로컬 AutoML+MLOps 플랫폼",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data.router, prefix="/api/data", tags=["데이터"])
app.include_router(train.router, prefix="/api/train", tags=["학습"])
app.include_router(predict.router, prefix="/api/predict", tags=["예측"])
app.include_router(report.router, prefix="/api/report", tags=["리포트"])

# Phase 2
app.include_router(experiments.router, prefix="/api/experiments", tags=["실험"])
app.include_router(registry.router, prefix="/api/registry", tags=["레지스트리"])
app.include_router(drift.router, prefix="/api/drift", tags=["드리프트"])


@app.on_event("startup")
def _on_startup():
    start_scheduler()


@app.get("/")
def root():
    return {"message": "Manufacturing AI Studio API v1.0", "status": "running"}
