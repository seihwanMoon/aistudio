# 🚀 PHASE1_MVP — 불량예측 AI 기본 시스템

> **담당 PROGRESS 항목**: P1-01 ~ P1-28
> **목표 기간**: 8주
> **완료 기준**: 비개발자가 혼자 불량예측 모델을 만들고 예측값 확인 가능

---

## 📋 이번 Phase에서 만들 것

```
CSV 업로드 → 데이터 확인 → 타겟/피처 선택 → AutoML 학습
     → 결과 대시보드 (정확도 + SHAP) → 새 데이터 예측 → PDF 리포트 다운로드
```

---

## [W1-W2] DB 모델 & 기반 구조

### `backend/models/experiment.py`
```python
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from database import Base

class Experiment(Base):
    __tablename__ = "experiments"

    id           = Column(String, primary_key=True)
    name         = Column(String, nullable=False)
    file_id      = Column(String, nullable=False)
    target_col   = Column(String, nullable=False)
    feature_cols = Column(Text, nullable=False)   # JSON 문자열
    task         = Column(String, nullable=False)  # classification | regression
    status       = Column(String, default="pending")
    mlflow_run_id = Column(String, nullable=True)
    created_at   = Column(DateTime, default=func.now())
    updated_at   = Column(DateTime, default=func.now(), onupdate=func.now())
```

### `backend/models/trained_model.py`
```python
from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from database import Base

class TrainedModel(Base):
    __tablename__ = "trained_models"

    id                 = Column(String, primary_key=True)
    experiment_id      = Column(String, ForeignKey("experiments.id"), nullable=False)
    model_path         = Column(String, nullable=False)
    best_estimator     = Column(String)
    accuracy           = Column(Float)
    training_time      = Column(Float)
    feature_importance = Column(Text)   # JSON 문자열
    stage              = Column(String, default="staging")
    mlflow_version     = Column(Integer, nullable=True)
    created_at         = Column(DateTime, default=func.now())
```

### `backend/models/prediction.py`
```python
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Prediction(Base):
    __tablename__ = "predictions"

    id          = Column(String, primary_key=True)
    model_id    = Column(String, ForeignKey("trained_models.id"), nullable=False)
    input_data  = Column(Text, nullable=False)   # JSON
    output_data = Column(Text, nullable=False)   # JSON
    source      = Column(String, default="manual")  # manual | batch | auto
    created_at  = Column(DateTime, default=func.now())
```

### `backend/models/__init__.py`
```python
from .experiment import Experiment
from .trained_model import TrainedModel
from .prediction import Prediction
```

---

## [W3-W4] 데이터 업로드 API

### `backend/routers/data.py`
```python
import io, uuid, json
import pandas as pd
import chardet
from fastapi import APIRouter, UploadFile, HTTPException, File
from fastapi.responses import JSONResponse
from pathlib import Path

router = APIRouter()

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def detect_encoding(raw_bytes: bytes) -> str:
    """CSV 인코딩 자동 감지 (EUC-KR, UTF-8, CP949 등)"""
    result = chardet.detect(raw_bytes)
    encoding = result.get("encoding") or "utf-8"
    # chardet이 EUC-KR을 CP949로 감지하는 경우 대비
    if encoding.upper() in ["CP949", "EUC-KR"]:
        return "euc-kr"
    return encoding


def analyze_dataframe(df: pd.DataFrame) -> dict:
    """데이터 품질 분석"""
    analysis = {}
    for col in df.columns:
        col_data = df[col]
        analysis[col] = {
            "dtype": str(col_data.dtype),
            "missing_count": int(col_data.isnull().sum()),
            "missing_pct": round(col_data.isnull().mean() * 100, 1),
            "unique_count": int(col_data.nunique()),
            # 수치형이면 통계, 범주형이면 상위 값
            "stats": col_data.describe().to_dict() if pd.api.types.is_numeric_dtype(col_data)
                     else col_data.value_counts().head(5).to_dict(),
        }
    return analysis


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # 파일 크기 검사
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(400, "파일 크기가 50MB를 초과합니다")

    # 파일 파싱
    try:
        if file.filename.endswith(".csv"):
            encoding = detect_encoding(contents)
            df = pd.read_csv(io.BytesIO(contents), encoding=encoding)
        elif file.filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(400, "CSV 또는 Excel 파일만 지원합니다 (.csv, .xlsx)")
    except Exception as e:
        raise HTTPException(400, f"파일 읽기 실패: {str(e)}")

    if len(df.columns) < 2:
        raise HTTPException(400, "최소 2개 이상의 컬럼이 필요합니다")

    # Parquet으로 저장 (이후 처리 빠름)
    file_id = str(uuid.uuid4())
    df.to_parquet(UPLOAD_DIR / f"{file_id}.parquet", index=False)

    return {
        "file_id": file_id,
        "filename": file.filename,
        "shape": {"rows": len(df), "cols": len(df.columns)},
        "columns": list(df.columns),
        "column_analysis": analyze_dataframe(df),
        "preview": df.head(100).fillna("").to_dict("records"),
    }


@router.get("/{file_id}/preview")
def get_preview(file_id: str, n: int = 100):
    path = UPLOAD_DIR / f"{file_id}.parquet"
    if not path.exists():
        raise HTTPException(404, "파일을 찾을 수 없습니다")
    df = pd.read_parquet(path)
    return {
        "preview": df.head(n).fillna("").to_dict("records"),
        "total_rows": len(df),
    }
```

---

## [W5-W6] AutoML 학습 엔진

### `backend/services/automl_service.py`
```python
import uuid, json, time, io
import pandas as pd
import numpy as np
import joblib
import shap
import matplotlib
matplotlib.use("Agg")  # GUI 없는 서버 환경
import matplotlib.pyplot as plt
from flaml import AutoML
from pathlib import Path
from typing import Callable

MODEL_DIR = Path("data/models")
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def detect_task_type(y: pd.Series) -> str:
    """타겟 컬럼으로 분류/회귀 자동 판별"""
    n_unique = y.nunique()
    if n_unique == 2:
        return "classification"
    elif n_unique <= 20 and y.dtype in ["object", "bool", "category"]:
        return "classification"
    elif n_unique <= 10:
        return "classification"
    else:
        return "regression"


def train_model(
    file_id: str,
    target_col: str,
    feature_cols: list,
    time_budget: int = 120,
    task: str = "auto",
    progress_callback: Callable = None,
) -> dict:
    """
    FLAML AutoML 학습 실행
    progress_callback: (progress: int, message: str) -> None
    """
    df = pd.read_parquet(f"data/uploads/{file_id}.parquet")

    X = df[feature_cols].copy()
    y = df[target_col].copy()

    # 결측값 기본 처리 (FLAML이 일부 처리하지만 안전을 위해)
    X = X.fillna(X.median() if pd.api.types.is_numeric_dtype(X) else X.mode().iloc[0])

    if task == "auto":
        task = detect_task_type(y)

    if progress_callback:
        progress_callback(5, f"데이터 로드 완료 ({len(df)}행, {len(feature_cols)}개 피처)")

    # FLAML AutoML 실행
    automl = AutoML()

    settings = {
        "task": task,
        "time_budget": time_budget,
        "metric": "accuracy" if task == "classification" else "rmse",
        "estimator_list": ["lgbm", "xgboost", "rf", "extra_tree", "lrl1"],
        "log_file_name": "",       # 로그 파일 비활성화
        "verbose": 0,
    }

    start_time = time.time()

    if progress_callback:
        progress_callback(10, "AutoML 학습 시작...")

    automl.fit(X, y, **settings)

    training_time = time.time() - start_time

    if progress_callback:
        progress_callback(80, f"최적 모델 발견: {automl.best_estimator}")

    # SHAP 피처 중요도 계산
    feature_importance = {}
    try:
        # 학습 데이터 샘플 200행으로 SHAP 계산 (속도)
        X_sample = X.sample(min(200, len(X)), random_state=42)

        # FLAML 내부 모델 추출
        best_model = automl.model.estimator
        explainer = shap.TreeExplainer(best_model)
        shap_values = explainer.shap_values(X_sample)

        if isinstance(shap_values, list):  # 다중 클래스
            shap_arr = np.abs(shap_values[1])
        else:
            shap_arr = np.abs(shap_values)

        importance = np.mean(shap_arr, axis=0)
        feature_importance = dict(zip(feature_cols, importance.tolist()))
        feature_importance = dict(
            sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
        )
    except Exception as e:
        # SHAP 실패 시 FLAML 내장 중요도 사용
        if hasattr(automl.model.estimator, "feature_importances_"):
            imp = automl.model.estimator.feature_importances_
            feature_importance = dict(zip(feature_cols, imp.tolist()))

    if progress_callback:
        progress_callback(90, "모델 저장 중...")

    # 모델 저장
    model_id = str(uuid.uuid4())[:8]
    model_path = str(MODEL_DIR / f"{model_id}.pkl")
    joblib.dump(automl, model_path)

    # 성능 지표 계산
    from sklearn.metrics import (
        accuracy_score, f1_score, confusion_matrix,
        mean_absolute_error, r2_score
    )
    y_pred = automl.predict(X)
    metrics = {}

    if task == "classification":
        metrics = {
            "accuracy": float(accuracy_score(y, y_pred)),
            "f1_score": float(f1_score(y, y_pred, average="weighted")),
            "confusion_matrix": confusion_matrix(y, y_pred).tolist(),
            "classes": sorted(y.unique().tolist()),
        }
    else:
        metrics = {
            "r2_score": float(r2_score(y, y_pred)),
            "mae": float(mean_absolute_error(y, y_pred)),
        }

    if progress_callback:
        progress_callback(100, "학습 완료!")

    return {
        "model_id": model_id,
        "model_path": model_path,
        "task": task,
        "best_estimator": automl.best_estimator,
        "training_time": round(training_time, 1),
        "feature_importance": feature_importance,
        "metrics": metrics,
    }
```

### `backend/routers/train.py`
```python
import uuid, json, asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from database import SessionLocal
from models import Experiment, TrainedModel
from services.automl_service import train_model

router = APIRouter()

# 진행률 저장소 (메모리, 세션 단위)
training_sessions: dict = {}


class TrainRequest(BaseModel):
    file_id: str
    target_col: str
    feature_cols: List[str]
    task: str = "auto"
    time_budget: int = 120
    experiment_name: str = "새 실험"


def run_training(session_id: str, request: TrainRequest):
    """BackgroundTask로 실행되는 학습 함수"""
    training_sessions[session_id] = {
        "progress": 0,
        "message": "학습 준비 중...",
        "status": "running",
        "model_id": None,
        "result": None,
    }

    def update_progress(progress: int, message: str):
        training_sessions[session_id]["progress"] = progress
        training_sessions[session_id]["message"] = message

    try:
        result = train_model(
            file_id=request.file_id,
            target_col=request.target_col,
            feature_cols=request.feature_cols,
            time_budget=request.time_budget,
            task=request.task,
            progress_callback=update_progress,
        )

        # DB 저장
        db = SessionLocal()
        try:
            experiment = Experiment(
                id=str(uuid.uuid4()),
                name=request.experiment_name,
                file_id=request.file_id,
                target_col=request.target_col,
                feature_cols=json.dumps(request.feature_cols),
                task=result["task"],
                status="done",
            )
            db.add(experiment)

            trained_model = TrainedModel(
                id=result["model_id"],
                experiment_id=experiment.id,
                model_path=result["model_path"],
                best_estimator=result["best_estimator"],
                accuracy=result["metrics"].get("accuracy") or result["metrics"].get("r2_score"),
                training_time=result["training_time"],
                feature_importance=json.dumps(result["feature_importance"]),
            )
            db.add(trained_model)
            db.commit()
        finally:
            db.close()

        training_sessions[session_id]["status"] = "done"
        training_sessions[session_id]["model_id"] = result["model_id"]
        training_sessions[session_id]["result"] = result

    except Exception as e:
        training_sessions[session_id]["status"] = "failed"
        training_sessions[session_id]["message"] = f"오류: {str(e)}"


@router.post("/start")
def start_training(request: TrainRequest, background_tasks: BackgroundTasks):
    session_id = str(uuid.uuid4())
    background_tasks.add_task(run_training, session_id, request)
    return {"session_id": session_id, "message": "학습이 시작되었습니다"}


@router.get("/progress/{session_id}")
async def training_progress(session_id: str):
    """SSE — 학습 진행률 실시간 스트리밍"""
    async def event_generator():
        while True:
            session = training_sessions.get(session_id)
            if not session:
                yield f"data: {json.dumps({'error': '세션을 찾을 수 없습니다'})}\n\n"
                break

            yield f"data: {json.dumps(session)}\n\n"

            if session["status"] in ("done", "failed"):
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/results/{model_id}")
def get_results(model_id: str):
    db = SessionLocal()
    try:
        model = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
        if not model:
            raise HTTPException(404, "모델을 찾을 수 없습니다")
        return {
            "model_id": model.id,
            "best_estimator": model.best_estimator,
            "accuracy": model.accuracy,
            "training_time": model.training_time,
            "feature_importance": json.loads(model.feature_importance or "{}"),
            "stage": model.stage,
            "created_at": model.created_at.isoformat(),
        }
    finally:
        db.close()


@router.get("/models")
def list_models():
    db = SessionLocal()
    try:
        models = db.query(TrainedModel).order_by(TrainedModel.created_at.desc()).all()
        return [
            {
                "model_id": m.id,
                "best_estimator": m.best_estimator,
                "accuracy": m.accuracy,
                "stage": m.stage,
                "created_at": m.created_at.isoformat(),
            }
            for m in models
        ]
    finally:
        db.close()
```

---

## [W7] 예측 API

### `backend/routers/predict.py`
```python
import json, uuid, io
import pandas as pd
import joblib
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Any
from database import SessionLocal
from models import TrainedModel, Prediction

router = APIRouter()


def load_model(model_id: str):
    db = SessionLocal()
    try:
        record = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
        if not record:
            raise HTTPException(404, "모델을 찾을 수 없습니다")
        return joblib.load(record.model_path), record
    finally:
        db.close()


class SinglePredictRequest(BaseModel):
    model_id: str
    input_data: dict[str, Any]


@router.post("/single")
def predict_single(request: SinglePredictRequest):
    """단건 예측"""
    automl, model_record = load_model(request.model_id)
    df = pd.DataFrame([request.input_data])

    prediction = automl.predict(df)[0]
    proba = None
    if hasattr(automl, "predict_proba"):
        proba_arr = automl.predict_proba(df)[0]
        proba = {str(cls): round(float(p), 4) for cls, p in
                 zip(automl.classes_ if hasattr(automl, "classes_") else range(len(proba_arr)), proba_arr)}

    # DB 저장
    db = SessionLocal()
    try:
        pred_record = Prediction(
            id=str(uuid.uuid4()),
            model_id=request.model_id,
            input_data=json.dumps(request.input_data, ensure_ascii=False),
            output_data=json.dumps({"prediction": str(prediction), "probability": proba}, ensure_ascii=False),
            source="manual",
        )
        db.add(pred_record)
        db.commit()
    finally:
        db.close()

    return {
        "prediction": str(prediction),
        "probability": proba,
        "prediction_id": pred_record.id,
    }


@router.post("/batch")
async def predict_batch(model_id: str, file: UploadFile = File(...)):
    """CSV 파일 일괄 예측"""
    automl, model_record = load_model(model_id)

    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents), encoding="utf-8-sig")

    predictions = automl.predict(df).tolist()
    result_df = df.copy()
    result_df["예측결과"] = predictions

    if hasattr(automl, "predict_proba"):
        proba = automl.predict_proba(df)
        result_df["불량확률"] = proba[:, 1].round(4) if proba.shape[1] == 2 else proba.max(axis=1).round(4)

    return {
        "total": len(predictions),
        "results": result_df.fillna("").to_dict("records"),
    }
```

---

## [W8] PDF 리포트

### `backend/templates/report.html`
```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: "Nanum Gothic", sans-serif; color: #1C2833; margin: 40px; }
  h1 { color: #1E3A5F; border-bottom: 3px solid #2E86C1; padding-bottom: 8px; }
  h2 { color: #2E86C1; margin-top: 30px; }
  .card { background: #EBF5FB; border-left: 4px solid #2E86C1;
          padding: 16px; margin: 12px 0; border-radius: 4px; }
  .accuracy { font-size: 48px; font-weight: bold; color: #1ABC9C; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #1E3A5F; color: white; padding: 10px; text-align: left; }
  td { padding: 8px 10px; border-bottom: 1px solid #BDC3C7; }
  tr:nth-child(even) td { background: #F2F3F4; }
  .bar-container { background: #F2F3F4; height: 20px; border-radius: 4px; margin: 4px 0; }
  .bar { background: #2E86C1; height: 20px; border-radius: 4px; }
  .footer { margin-top: 40px; border-top: 1px solid #BDC3C7;
            padding-top: 12px; color: #7F8C8D; font-size: 12px; }
</style>
</head>
<body>
  <h1>🏭 AI 불량예측 도입 리포트</h1>
  <p>생성일: {{ generated_at }} | 공장: {{ factory_name }}</p>

  <h2>📊 요약</h2>
  <div class="card">
    <div class="accuracy">{{ accuracy }}%</div>
    <p>예측 정확도 ({{ task_type }})</p>
    <p>최적 알고리즘: <strong>{{ best_model }}</strong></p>
    <p>학습 데이터: {{ data_rows }}행 × {{ data_cols }}개 항목</p>
    <p>학습 소요 시간: {{ training_time }}초</p>
  </div>

  <h2>🔍 불량에 영향을 미치는 주요 요인 Top {{ features|length }}</h2>
  <table>
    <tr><th>순위</th><th>요인명</th><th>영향도</th></tr>
    {% for feat in features %}
    <tr>
      <td>{{ loop.index }}위</td>
      <td>{{ feat.name }}</td>
      <td>
        <div class="bar-container">
          <div class="bar" style="width: {{ feat.pct }}%"></div>
        </div>
        {{ feat.pct }}%
      </td>
    </tr>
    {% endfor %}
  </table>

  <h2>📈 모델 성능 지표</h2>
  <table>
    <tr><th>지표</th><th>값</th></tr>
    {% for k, v in metrics.items() %}
    <tr><td>{{ k }}</td><td>{{ v }}</td></tr>
    {% endfor %}
  </table>

  <h2>💡 이 AI 활용 방법</h2>
  <ol>
    <li>새 공정 데이터를 CSV로 저장합니다</li>
    <li>Manufacturing AI Studio에서 [예측하기] 탭을 클릭합니다</li>
    <li>CSV 파일을 업로드하면 불량 확률이 즉시 계산됩니다</li>
    <li>불량 확률 70% 이상인 항목을 중점 점검하세요</li>
  </ol>

  <div class="footer">
    Manufacturing AI Studio v1.0 | 이 리포트는 자동 생성되었습니다
  </div>
</body>
</html>
```

### `backend/services/report_service.py`
```python
import json
from datetime import datetime
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from database import SessionLocal
from models import TrainedModel

REPORT_DIR = Path("data/reports")
REPORT_DIR.mkdir(parents=True, exist_ok=True)

env = Environment(loader=FileSystemLoader("templates"))


def generate_pdf_report(model_id: str, factory_name: str = "우리 공장") -> str:
    db = SessionLocal()
    try:
        model = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
        if not model:
            raise ValueError(f"모델을 찾을 수 없습니다: {model_id}")

        feature_importance = json.loads(model.feature_importance or "{}")
        max_importance = max(feature_importance.values()) if feature_importance else 1

        features = [
            {
                "name": k,
                "pct": round(v / max_importance * 100, 1),
            }
            for k, v in list(feature_importance.items())[:10]
        ]

        metrics = {
            "정확도": f"{round((model.accuracy or 0) * 100, 1)}%",
            "최적 알고리즘": model.best_estimator or "-",
            "학습 시간": f"{model.training_time or 0}초",
        }

        template = env.get_template("report.html")
        html_content = template.render(
            generated_at=datetime.now().strftime("%Y년 %m월 %d일 %H:%M"),
            factory_name=factory_name,
            accuracy=round((model.accuracy or 0) * 100, 1),
            task_type="분류" if "classification" in (model.best_estimator or "") else "예측",
            best_model=model.best_estimator or "-",
            data_rows="-",
            data_cols=len(feature_importance),
            training_time=model.training_time or 0,
            features=features,
            metrics=metrics,
        )

        output_path = str(REPORT_DIR / f"report_{model_id}.pdf")
        HTML(string=html_content).write_pdf(output_path)
        return output_path

    finally:
        db.close()
```

### `backend/routers/report.py`
```python
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from services.report_service import generate_pdf_report

router = APIRouter()

@router.get("/{model_id}")
def download_report(model_id: str, factory_name: str = Query("우리 공장")):
    try:
        pdf_path = generate_pdf_report(model_id, factory_name)
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=f"AI_불량예측_리포트_{model_id}.pdf",
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"리포트 생성 실패: {str(e)}")
```

---

## [W5-W7] 프론트엔드 핵심 컴포넌트

### `frontend/src/api/client.js`
```javascript
import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 30000,
});

// 에러 인터셉터 — 한국어 에러 메시지
client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.detail || "서버 오류가 발생했습니다";
    return Promise.reject(new Error(message));
  }
);

export default client;
```

### `frontend/src/store/useAppStore.js`
```javascript
import { create } from "zustand";

export const useAppStore = create((set) => ({
  // 워크플로우 단계: 0=홈, 1=업로드, 2=설정, 3=학습, 4=결과, 5=예측
  currentStep: 0,
  setStep: (step) => set({ currentStep: step }),

  // 업로드된 파일 정보
  fileId: null,
  filename: null,
  columns: [],
  columnAnalysis: {},
  preview: [],
  setFileData: (data) => set({
    fileId: data.file_id,
    filename: data.filename,
    columns: data.columns,
    columnAnalysis: data.column_analysis,
    preview: data.preview,
    currentStep: 2,
  }),

  // 학습 설정
  targetCol: null,
  featureCols: [],
  taskType: "auto",
  setTrainConfig: (config) => set({ ...config }),

  // 학습 결과
  sessionId: null,
  modelId: null,
  trainingResult: null,
  isTraining: false,
  trainingProgress: 0,
  trainingMessage: "",
  setTrainingState: (state) => set(state),

  // 리셋
  reset: () => set({
    currentStep: 0, fileId: null, filename: null, columns: [],
    targetCol: null, featureCols: [], modelId: null, trainingResult: null,
  }),
}));
```

### `frontend/src/App.jsx`
```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Sidebar from "./components/layout/Sidebar";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import SetupPage from "./pages/SetupPage";
import TrainingPage from "./pages/TrainingPage";
import ResultsPage from "./pages/ResultsPage";
import PredictPage from "./pages/PredictPage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex h-screen bg-gray-50 font-korean">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/training" element={<TrainingPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/predict" element={<PredictPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
        <Toaster position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

### `frontend/src/pages/TrainingPage.jsx`
```jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";

export default function TrainingPage() {
  const navigate = useNavigate();
  const { sessionId, setTrainingState } = useAppStore();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("학습 준비 중...");
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!sessionId) { navigate("/upload"); return; }

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const es = new EventSource(`${apiUrl}/api/train/progress/${sessionId}`);

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.progress || 0);
      setMessage(data.message || "");
      if (data.message) setLogs((prev) => [...prev.slice(-20), data.message]);

      if (data.status === "done") {
        es.close();
        setTrainingState({ modelId: data.model_id, trainingResult: data.result });
        navigate("/results");
      } else if (data.status === "failed") {
        es.close();
        setMessage(`❌ ${data.message}`);
      }
    };

    return () => es.close();
  }, [sessionId]);

  return (
    <div className="max-w-xl mx-auto mt-20 text-center">
      <h1 className="text-3xl font-bold text-primary mb-2">AI 학습 중...</h1>
      <p className="text-gray-500 mb-8">최적의 AI 모델을 찾고 있습니다. 잠시만 기다려 주세요.</p>

      {/* 원형 프로그레스 */}
      <div className="relative w-48 h-48 mx-auto mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#EBF5FB" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1ABC9C" strokeWidth="8"
            strokeDasharray={`${progress * 2.51} 251`}
            strokeLinecap="round" className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold text-primary">{progress}%</span>
        </div>
      </div>

      <p className="text-lg font-medium text-gray-700 mb-4">{message}</p>

      {/* 로그 */}
      <div className="bg-gray-900 text-green-400 text-sm font-mono rounded-lg p-4 text-left h-40 overflow-y-auto">
        {logs.map((log, i) => <div key={i}>&gt; {log}</div>)}
      </div>
    </div>
  );
}
```

---

## ✅ Phase 1 완료 체크리스트

작업 완료 전 아래를 모두 확인하세요:

- [ ] 비개발자 1명에게 혼자서 CSV 업로드 → 예측까지 시켜보기
- [ ] 50MB CSV 파일 업로드 테스트
- [ ] EUC-KR 인코딩 CSV 파일 업로드 테스트
- [ ] 학습 도중 Docker 재시작해도 모델 저장 확인
- [ ] PDF 리포트에 한국어 깨짐 없음 확인
- [ ] http://localhost:8000/docs 에서 모든 API 동작 확인
