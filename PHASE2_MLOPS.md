# 📦 PHASE2_MLOPS — 모델 생명주기 관리 시스템

> **담당 PROGRESS 항목**: P2-01 ~ P2-22
> **선행 조건**: Phase 1 완료 (`PROGRESS.md` P1-01 ~ P1-28 전체 체크)
> **목표 기간**: 8주
> **완료 기준**: 6개월 이상 모델 성능 유지 + 드리프트 자동 감지 + 알림

---

## 📋 이번 Phase에서 만들 것

```
MLflow 연동 → 모델 히스토리 UI → 운영 모델 등록/전환
    → 주간 드리프트 자동 체크 → 경고 알림 → 원클릭 재학습
```

---

## [W1-W2] MLflow 도커 추가 & 연동

### `docker-compose.phase2.yml` (기존 docker-compose.yml 을 이것으로 교체)
```yaml
version: "3.9"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./backend/data:/app/data
      - ./backend/templates:/app/templates
    environment:
      - DATABASE_URL=sqlite:///./data/manufacturing_ai.db
      - MLFLOW_TRACKING_URI=http://mlflow:5000
    depends_on:
      - mlflow
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

  mlflow:
    image: ghcr.io/mlflow/mlflow:v2.11.0
    ports:
      - "5000:5000"
    volumes:
      - ./mlflow-data:/mlflow
    command: >
      mlflow server
      --backend-store-uri sqlite:///mlflow/mlflow.db
      --default-artifact-root /mlflow/artifacts
      --host 0.0.0.0
      --port 5000
    restart: unless-stopped
```

### `backend/requirements.txt` — Phase 2 주석 해제
```
# Phase 2 — 아래 3줄 주석 해제
mlflow==2.11.0
evidently==0.4.22
apscheduler==3.10.4
```

### `backend/services/automl_service.py` — MLflow 로깅 추가
```python
# 기존 train_model 함수 아래에 추가

import os
import mlflow
import mlflow.sklearn

MLFLOW_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")


def train_model_with_mlflow(
    file_id: str,
    target_col: str,
    feature_cols: list,
    experiment_name: str = "manufacturing_ai",
    time_budget: int = 120,
    task: str = "auto",
    progress_callback=None,
) -> dict:
    """MLflow 자동 기록이 포함된 학습"""
    mlflow.set_tracking_uri(MLFLOW_URI)
    mlflow.set_experiment(experiment_name)

    with mlflow.start_run() as run:
        # 파라미터 기록
        mlflow.log_params({
            "target_col": target_col,
            "feature_count": len(feature_cols),
            "feature_cols": str(feature_cols),
            "time_budget": time_budget,
            "task": task,
        })

        # 학습 실행 (기존 함수 재사용)
        result = train_model(
            file_id, target_col, feature_cols,
            time_budget, task, progress_callback
        )

        # 메트릭 기록
        metrics = result["metrics"]
        mlflow.log_metrics({
            "accuracy": metrics.get("accuracy") or metrics.get("r2_score", 0),
            "training_time": result["training_time"],
            **({"f1_score": metrics["f1_score"]} if "f1_score" in metrics else {}),
        })

        # 피처 중요도 기록
        for feat, imp in result["feature_importance"].items():
            mlflow.log_metric(f"fi_{feat}", imp)

        # 모델 아티팩트 저장
        import joblib
        model = joblib.load(result["model_path"])
        mlflow.sklearn.log_model(model.model.estimator, "model")

        result["mlflow_run_id"] = run.info.run_id
        return result
```

---

## [W3-W4] 모델 레지스트리 API

### `backend/routers/experiments.py`
```python
from fastapi import APIRouter, HTTPException
from mlflow import MlflowClient
import mlflow, os

router = APIRouter()
client = MlflowClient(os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000"))


@router.get("")
def list_experiments():
    """모든 실험 목록 반환"""
    try:
        experiments = mlflow.search_experiments()
        results = []
        for exp in experiments:
            runs = mlflow.search_runs(
                experiment_ids=[exp.experiment_id],
                order_by=["start_time DESC"],
                max_results=50,
            )
            results.append({
                "experiment_id": exp.experiment_id,
                "name": exp.name,
                "run_count": len(runs),
                "runs": [
                    {
                        "run_id": r["run_id"],
                        "accuracy": r.get("metrics.accuracy", 0),
                        "training_time": r.get("metrics.training_time", 0),
                        "target_col": r.get("params.target_col", ""),
                        "best_estimator": r.get("tags.mlflow.runName", ""),
                        "start_time": r["start_time"],
                        "status": r["status"],
                    }
                    for _, r in runs.iterrows()
                ],
            })
        return results
    except Exception as e:
        raise HTTPException(503, f"MLflow 서버에 연결할 수 없습니다: {str(e)}")


@router.get("/{run_id}")
def get_experiment_detail(run_id: str):
    try:
        run = mlflow.get_run(run_id)
        return {
            "run_id": run_id,
            "params": run.data.params,
            "metrics": run.data.metrics,
            "tags": run.data.tags,
            "status": run.info.status,
            "start_time": run.info.start_time,
            "end_time": run.info.end_time,
        }
    except Exception as e:
        raise HTTPException(404, str(e))


@router.post("/compare")
def compare_experiments(run_ids: list[str]):
    """두 실험 비교"""
    results = []
    for run_id in run_ids[:2]:
        try:
            run = mlflow.get_run(run_id)
            results.append({
                "run_id": run_id,
                "metrics": run.data.metrics,
                "params": run.data.params,
            })
        except:
            results.append({"run_id": run_id, "error": "조회 실패"})
    return results
```

### `backend/routers/registry.py`
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from mlflow import MlflowClient
import mlflow, os
from database import SessionLocal
from models import TrainedModel

router = APIRouter()
client = MlflowClient(os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000"))


class RegisterRequest(BaseModel):
    run_id: str
    model_name: str
    local_model_id: str  # SQLite TrainedModel.id


@router.post("/register")
def register_model(req: RegisterRequest):
    """MLflow 모델 레지스트리에 등록 + 운영 모델로 승격"""
    try:
        # MLflow에 모델 등록
        mv = mlflow.register_model(f"runs:/{req.run_id}/model", req.model_name)

        # 운영(Production) 단계로 승격
        client.transition_model_version_stage(
            name=req.model_name,
            version=mv.version,
            stage="Production",
            archive_existing_versions=True,  # 기존 운영 모델은 자동 Archived
        )

        # 로컬 DB 업데이트
        db = SessionLocal()
        try:
            model = db.query(TrainedModel).filter(
                TrainedModel.id == req.local_model_id
            ).first()
            if model:
                model.stage = "production"
                model.mlflow_version = mv.version
                db.commit()
        finally:
            db.close()

        return {
            "message": f"'{req.model_name}' v{mv.version} 이 운영 모델로 등록되었습니다",
            "version": mv.version,
        }
    except Exception as e:
        raise HTTPException(500, f"모델 등록 실패: {str(e)}")


@router.put("/{model_name}/rollback")
def rollback_model(model_name: str, version: int):
    """이전 버전으로 롤백"""
    client.transition_model_version_stage(
        name=model_name, version=version, stage="Production",
        archive_existing_versions=True,
    )
    return {"message": f"v{version} 으로 롤백되었습니다"}
```

---

## [W5-W6] 드리프트 감지 시스템

### `backend/services/drift_service.py`
```python
import pandas as pd
import json
from pathlib import Path
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset
from evidently.metrics import DatasetMissingValuesSummaryMetric


def check_data_drift(
    reference_data: pd.DataFrame,
    current_data: pd.DataFrame,
) -> dict:
    """
    기준 데이터 vs 현재 데이터 드리프트 감지
    returns: {
        drift_detected: bool,
        drift_score: float (0~1),
        alert_level: 'ok' | 'warning' | 'danger',
        column_drifts: {...}
    }
    """
    # 공통 컬럼만 사용
    common_cols = [c for c in reference_data.columns if c in current_data.columns]
    ref = reference_data[common_cols].copy()
    cur = current_data[common_cols].copy()

    report = Report(metrics=[
        DataDriftPreset(drift_share_threshold=0.2),
        DatasetMissingValuesSummaryMetric(),
    ])
    report.run(reference_data=ref, current_data=cur)
    result = report.as_dict()

    # 결과 파싱
    drift_result = result["metrics"][0]["result"]
    drift_score = drift_result.get("drift_share", 0)
    drift_detected = drift_result.get("dataset_drift", False)

    column_drifts = {}
    for col_result in drift_result.get("drift_by_columns", {}).values():
        column_drifts[col_result["column_name"]] = {
            "drifted": col_result["drift_detected"],
            "p_value": col_result.get("p_value", 1.0),
        }

    return {
        "drift_detected": drift_detected,
        "drift_score": round(drift_score, 4),
        "alert_level": (
            "danger"  if drift_score > 0.4 else
            "warning" if drift_score > 0.2 else
            "ok"
        ),
        "column_drifts": column_drifts,
        "drifted_columns": [k for k, v in column_drifts.items() if v["drifted"]],
    }
```

### `backend/models/alert.py`
```python
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Alert(Base):
    __tablename__ = "alerts"

    id         = Column(String, primary_key=True)
    model_id   = Column(String, nullable=False)
    alert_type = Column(String, nullable=False)  # drift | threshold | error
    level      = Column(String, nullable=False)  # info | warning | danger
    message    = Column(String, nullable=False)
    payload    = Column(Text)                    # JSON
    is_read    = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
```

### `backend/routers/drift.py`
```python
import uuid, json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import SessionLocal
from models import TrainedModel, Alert
from services.drift_service import check_data_drift
import pandas as pd

router = APIRouter()


@router.get("/{model_id}")
def get_drift_status(model_id: str):
    """모델의 드리프트 알림 이력 반환"""
    db = SessionLocal()
    try:
        alerts = (
            db.query(Alert)
            .filter(Alert.model_id == model_id, Alert.alert_type == "drift")
            .order_by(Alert.created_at.desc())
            .limit(30)
            .all()
        )
        return [
            {
                "id": a.id,
                "level": a.level,
                "message": a.message,
                "payload": json.loads(a.payload or "{}"),
                "is_read": bool(a.is_read),
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts
        ]
    finally:
        db.close()


@router.post("/check")
def manual_drift_check(model_id: str, reference_file_id: str, current_file_id: str):
    """수동 드리프트 체크 실행"""
    ref_df = pd.read_parquet(f"data/uploads/{reference_file_id}.parquet")
    cur_df = pd.read_parquet(f"data/uploads/{current_file_id}.parquet")

    result = check_data_drift(ref_df, cur_df)

    # 알림 저장
    if result["alert_level"] != "ok":
        db = SessionLocal()
        try:
            alert = Alert(
                id=str(uuid.uuid4()),
                model_id=model_id,
                alert_type="drift",
                level=result["alert_level"],
                message=f"데이터 드리프트 감지: {len(result['drifted_columns'])}개 컬럼 변화",
                payload=json.dumps(result, ensure_ascii=False),
            )
            db.add(alert)
            db.commit()
        finally:
            db.close()

    return result
```

### `backend/scheduler.py` — 주간 자동 드리프트 체크
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import uuid, json, pandas as pd
from database import SessionLocal
from models import TrainedModel, Alert
from services.drift_service import check_data_drift

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


@scheduler.scheduled_job(CronTrigger(day_of_week="mon", hour=9, minute=0))
async def weekly_drift_check():
    """매주 월요일 오전 9시 자동 드리프트 체크"""
    print("[스케줄러] 주간 드리프트 체크 시작")
    db = SessionLocal()
    try:
        production_models = (
            db.query(TrainedModel)
            .filter(TrainedModel.stage == "production")
            .all()
        )
        for model in production_models:
            try:
                # 실제 환경에서는 기준 데이터와 최근 데이터를 별도 저장 필요
                # 여기서는 예시 로직
                print(f"[스케줄러] 모델 {model.id} 드리프트 체크 중...")
            except Exception as e:
                print(f"[스케줄러] 오류 {model.id}: {e}")
    finally:
        db.close()


def start_scheduler():
    scheduler.start()
    print("[스케줄러] 시작됨 — 매주 월 09:00 드리프트 체크")
```

### `backend/main.py` — 스케줄러 등록 (Phase 2)
```python
# main.py 아래에 추가
from contextlib import asynccontextmanager
from scheduler import start_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()    # 앱 시작 시 스케줄러 기동
    yield

app = FastAPI(lifespan=lifespan, ...)  # lifespan 파라미터 추가
```

---

## [W7] 프론트엔드 — 모델 히스토리 & 비교

### `frontend/src/pages/ModelHistoryPage.jsx` 구조
```jsx
// 구현할 컴포넌트 목록
// 1. 실험 목록 테이블 — 날짜, 정확도, 알고리즘, 스테이지 배지
// 2. 스테이지 배지 색상: production=green, staging=blue, archived=gray
// 3. [운영 모델로 등록] 버튼 — staging 모델에만 표시
// 4. [비교하기] 체크박스 — 최대 2개 선택 후 비교 페이지로 이동
// 5. [롤백] 버튼 — archived 모델에 표시

// API 호출: GET /api/experiments
// 운영 등록: POST /api/registry/register
```

### `frontend/src/pages/DriftPage.jsx` 구조
```jsx
// 구현할 컴포넌트 목록
// 1. 드리프트 점수 게이지 (0~100%, 0~20=ok, 20~40=warning, 40+=danger)
// 2. 알림 타임라인 — 날짜별 드리프트 이벤트
// 3. 컬럼별 드리프트 현황 테이블
// 4. [지금 재학습] 버튼 — danger 레벨일 때 빨간색 강조
// 5. 마지막 체크 시간 표시

// 게이지 차트: Recharts RadialBarChart 사용
// API 호출: GET /api/drift/{model_id}
// 수동 체크: POST /api/drift/check
```

---

## [W8] 재학습 자동화

### `backend/routers/train.py` — retrain 엔드포인트 추가
```python
@router.post("/retrain/{model_id}")
def retrain_model(model_id: str, background_tasks: BackgroundTasks):
    """기존 모델 설정으로 재학습"""
    db = SessionLocal()
    try:
        model = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
        if not model:
            raise HTTPException(404, "모델을 찾을 수 없습니다")

        experiment = db.query(Experiment).filter(
            Experiment.id == model.experiment_id
        ).first()

        if not experiment:
            raise HTTPException(404, "실험 정보를 찾을 수 없습니다")

        # 동일한 설정으로 재학습 시작
        request = TrainRequest(
            file_id=experiment.file_id,
            target_col=experiment.target_col,
            feature_cols=json.loads(experiment.feature_cols),
            task=experiment.task,
            time_budget=120,
            experiment_name=f"{experiment.name} (재학습)",
        )
        session_id = str(uuid.uuid4())
        background_tasks.add_task(run_training, session_id, request)

        return {
            "session_id": session_id,
            "message": "재학습이 시작되었습니다",
        }
    finally:
        db.close()
```

---

## ✅ Phase 2 완료 체크리스트

- [ ] http://localhost:5000 MLflow UI 접속 및 실험 목록 확인
- [ ] 학습 후 MLflow에 자동으로 실험이 기록되는지 확인
- [ ] 모델 히스토리 페이지에서 버전 전환 테스트
- [ ] 드리프트 수동 체크 실행 및 알림 저장 확인
- [ ] 재학습 버튼 동작 확인
- [ ] 스케줄러 로그 출력 확인 (`docker logs backend`)
