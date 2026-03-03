# 🛠️ SETUP — 개발환경 초기 셋업

> 코딩 에이전트: 이 파일의 모든 단계를 순서대로 실행하세요.
> 완료 시 `PROGRESS.md` 의 S-01 ~ S-05 체크하세요.

---

## 사전 요구사항

- Docker Desktop ≥ v4.0 (Windows 10 64bit / macOS 12 이상)
- Node.js ≥ 20 (로컬 개발 시)
- Python ≥ 3.11 (로컬 개발 시)

---

## Step 1 — 폴더 구조 생성

아래 스크립트를 실행하면 `ARCHITECTURE.md` 의 전체 폴더 구조가 생성됩니다.

```bash
# 프로젝트 루트에서 실행
mkdir -p manufacturing-ai-studio/{backend/{routers,services,models,middleware,templates,data/{uploads,models,reports}},frontend/src/{pages,components/{layout,charts,data,common},hooks,api,store,constants},mlflow-data}

cd manufacturing-ai-studio

# 빈 __init__.py 생성
touch backend/routers/__init__.py
touch backend/services/__init__.py
touch backend/models/__init__.py

echo "✅ 폴더 구조 생성 완료"
```

---

## Step 2 — Backend 초기 파일 생성

### `backend/requirements.txt`
```
# ── Core ───────────────────────────────────────
fastapi==0.111.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9

# ── Data ───────────────────────────────────────
pandas==2.2.0
openpyxl==3.1.2
chardet==5.2.0
pyarrow==15.0.2

# ── AutoML ─────────────────────────────────────
flaml[automl]==2.1.2
scikit-learn==1.4.0
xgboost==2.0.3
lightgbm==4.3.0

# ── Explainability ─────────────────────────────
shap==0.45.0
matplotlib==3.8.0

# ── DB ─────────────────────────────────────────
sqlalchemy==2.0.25

# ── Report ─────────────────────────────────────
weasyprint==61.2
jinja2==3.1.3

# ── Utils ──────────────────────────────────────
joblib==1.3.2
python-dotenv==1.0.0

# ── Phase 2 (주석 해제하여 사용) ────────────────
# mlflow==2.11.0
# evidently==0.4.22
# apscheduler==3.10.4

# ── Phase 3 (주석 해제하여 사용) ────────────────
# watchdog==4.0.0
# httpx==0.27.0
# python-jose[cryptography]==3.3.0
# passlib[bcrypt]==1.7.4
```

### `backend/database.py`
```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/manufacturing_ai.db")

# SQLite 파일이 저장될 data/ 폴더 생성
Path("data").mkdir(exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite 전용 설정
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI Depends 주입용 DB 세션 제공"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### `backend/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from database import engine, Base

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
```

---

## Step 3 — Frontend 초기화

```bash
cd manufacturing-ai-studio/frontend

# Vite + React 프로젝트 초기화
npm create vite@latest . -- --template react
npm install

# 핵심 의존성 설치
npm install \
  react-router-dom@6 \
  axios \
  zustand \
  @tanstack/react-query \
  recharts \
  react-dropzone \
  @tanstack/react-table \
  react-hot-toast \
  lucide-react

# Tailwind 설치
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### `frontend/tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1E3A5F",
          light: "#2E86C1",
        },
        accent: "#1ABC9C",
        danger: "#E74C3C",
        warning: "#E67E22",
      },
      fontFamily: {
        korean: ["Malgun Gothic", "Apple SD Gothic Neo", "sans-serif"],
      },
    },
  },
  plugins: [],
};
```

### `frontend/src/constants/korean.js`
```javascript
/**
 * 모든 한국어 UI 텍스트를 한 곳에서 관리
 * UI 컴포넌트에서는 반드시 이 파일을 import하여 사용
 */
export const KO = {
  // 네비게이션
  nav: {
    home: "홈",
    upload: "데이터 업로드",
    train: "AI 학습",
    predict: "예측하기",
    models: "모델 관리",
    drift: "성능 모니터링",
    realtime: "실시간 모니터링",
    alerts: "알림 설정",
  },

  // 업로드 페이지
  upload: {
    title: "데이터를 업로드하세요",
    subtitle: "CSV 또는 엑셀 파일을 여기에 끌어다 놓으세요",
    button: "파일 선택",
    sampleData: "샘플 데이터 받기",
    supportedFormats: "지원 형식: .csv, .xlsx (최대 50MB)",
    uploading: "업로드 중...",
    success: "업로드 완료!",
  },

  // 설정 페이지
  setup: {
    title: "무엇을 예측할까요?",
    targetLabel: "예측하고 싶은 항목",
    targetPlaceholder: "예: 불량여부, 수율, 고장여부",
    featureLabel: "예측에 사용할 데이터 항목",
    featureHint: "많을수록 좋지만, 관련 없는 항목은 제외하세요",
    autoDetected: "자동 감지됨",
    taskType: {
      classification: "분류 (불량/정상 구분)",
      regression: "수치 예측 (수율 % 등)",
    },
  },

  // 학습 페이지
  training: {
    title: "AI 학습 중...",
    subtitle: "잠시만 기다려 주세요. 최적의 AI 모델을 찾고 있습니다.",
    currentModel: "현재 테스트 중인 알고리즘",
    estimatedTime: "예상 완료 시간",
    done: "학습 완료!",
    errorOccurred: "학습 중 오류가 발생했습니다",
  },

  // 결과 페이지
  results: {
    title: "AI 학습 결과",
    accuracy: "예측 정확도",
    bestModel: "최적 알고리즘",
    trainingTime: "학습 소요 시간",
    topFeatures: "불량에 가장 큰 영향을 미치는 요인 Top 5",
    downloadReport: "리포트 PDF 다운로드",
    startPrediction: "이 AI로 예측하기",
  },

  // 예측 페이지
  predict: {
    title: "새 데이터로 예측하기",
    singleTitle: "단건 예측",
    batchTitle: "일괄 예측 (CSV 업로드)",
    result: "예측 결과",
    probability: "확률",
    defect: "불량",
    normal: "정상",
    high_risk: "⚠️ 고위험",
    low_risk: "✅ 정상 범위",
  },

  // 공통
  common: {
    loading: "불러오는 중...",
    error: "오류가 발생했습니다",
    retry: "다시 시도",
    save: "저장",
    cancel: "취소",
    confirm: "확인",
    delete: "삭제",
    seconds: "초",
    percent: "%",
    rows: "행",
    columns: "열",
  },

  // 드리프트 (Phase 2)
  drift: {
    title: "AI 성능 모니터링",
    status: {
      ok: "✅ 정상 — AI가 잘 작동하고 있습니다",
      warning: "⚠️ 주의 — 성능 저하 감지됨",
      danger: "🔴 위험 — 재학습이 필요합니다",
    },
    retrainButton: "지금 재학습하기",
    lastChecked: "마지막 점검",
  },
};
```

---

## Step 4 — Docker 설정

### `docker-compose.yml` (Phase 1)
```yaml
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
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "${FRONTEND_PORT:-3000}:80"
    depends_on:
      - backend
    environment:
      - VITE_API_URL=http://localhost:8000
    restart: unless-stopped
```

### `backend/Dockerfile`
```dockerfile
FROM python:3.11-slim

# WeasyPrint 의존성 (한국어 PDF)
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 libpangocairo-1.0-0 \
    libcairo2 libgdk-pixbuf-2.0-0 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Windows에서 FLAML 멀티프로세싱 오류 방지
ENV MULTIPROCESSING_START_METHOD=spawn

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `frontend/Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### `frontend/nginx.conf`
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # React SPA — 모든 경로를 index.html로 리다이렉트
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 백엔드 API 프록시
    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
    }

    location /ws {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Step 5 — 기동 및 검증

```bash
# 전체 스택 빌드 및 기동
cd manufacturing-ai-studio
docker-compose up -d --build
# 포트 3000 충돌 시
# FRONTEND_PORT=43000 docker-compose up -d --build

# 검증 체크리스트
# [x] http://localhost:3000 (또는 FRONTEND_PORT)  → React 앱 홈 화면 표시
# [x] http://localhost:8000/docs → FastAPI Swagger UI 표시
# [x] http://localhost:8000  → {"message": "Manufacturing AI Studio API v1.0"}
```

---

> ✅ 모든 단계 완료 후 `PROGRESS.md` S-01~S-05 체크하고 Phase 1 작업 시작
