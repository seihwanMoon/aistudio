from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models  # noqa: F401

# 라우터 임포트 (단계별로 주석 해제)
from routers import data, train, predict, report
# Phase 2: from routers import experiments, registry, drift
# Phase 3: from routers import realtime, watcher, auth

# DB 테이블 초기화
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Manufacturing AI Studio",
    description="중소제조기업 로컬 AutoML+MLOps 플랫폼",
    version="1.0.0"
)

# CORS 설정 (로컬 개발)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(data.router,    prefix="/api/data",    tags=["데이터"])
app.include_router(train.router,   prefix="/api/train",   tags=["학습"])
app.include_router(predict.router, prefix="/api/predict", tags=["예측"])
app.include_router(report.router,  prefix="/api/report",  tags=["리포트"])

# Phase 2
# app.include_router(experiments.router, prefix="/api/experiments", tags=["실험"])
# app.include_router(registry.router,    prefix="/api/registry",    tags=["레지스트리"])
# app.include_router(drift.router,       prefix="/api/drift",       tags=["드리프트"])

# Phase 3
# app.include_router(realtime.router, prefix="",            tags=["실시간"])
# app.include_router(watcher.router,  prefix="/api/watcher", tags=["파일감시"])
# app.include_router(auth.router,     prefix="/api/auth",    tags=["인증"])

@app.get("/")
def root():
    return {"message": "Manufacturing AI Studio API v1.0", "status": "running"}
