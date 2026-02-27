# 🏗️ ARCHITECTURE — 기술 아키텍처 문서

---

## 기술 스택

| 레이어 | 기술 | 버전 | 역할 |
|--------|------|------|------|
| Frontend | React + Vite | 18.3 / 5.x | SPA UI |
| Styling | TailwindCSS | 3.4 | 유틸리티 CSS |
| 상태관리 | Zustand | 4.5 | 클라이언트 상태 |
| 서버 상태 | TanStack Query | 5.x | API 캐시/동기화 |
| 차트 | Recharts | 2.12 | 데이터 시각화 |
| Backend | FastAPI | 0.111 | REST API 서버 |
| AutoML | FLAML | 2.1.2 | 자동 모델 학습 |
| 설명AI | mljar-supervised | 1.1.0 | SHAP 설명 리포트 |
| MLOps | MLflow (로컬) | 2.11 | 실험 추적/레지스트리 |
| 드리프트 | Evidently AI | 0.4.x | 데이터/모델 드리프트 감지 |
| 스케줄러 | APScheduler | 3.10 | 주기적 자동 실행 |
| 실시간 | WebSocket (FastAPI) | — | 실시간 예측 스트리밍 |
| 파일감시 | Watchdog | 4.0 | 폴더 신규 파일 감지 |
| DB | SQLite | — | 로컬 파일 기반 DB |
| ORM | SQLAlchemy | 2.0 | DB 모델/쿼리 |
| PDF | WeasyPrint | 61.2 | 한국어 PDF 생성 |
| 템플릿 | Jinja2 | 3.1 | HTML/PDF 템플릿 |
| 인증 | python-jose | 3.3 | JWT 토큰 |
| 패키징 | Docker + Compose | — | 원클릭 설치 |

---

## 📁 전체 폴더 구조

```
manufacturing-ai-studio/
│
├── docker-compose.yml          ← 전체 스택 실행
├── docker-compose.phase2.yml   ← Phase 2 확장 (MLflow 추가)
├── .env.example                ← 환경변수 템플릿
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── main.py                 ← FastAPI 앱 진입점
│   ├── database.py             ← SQLite 연결 설정
│   ├── scheduler.py            ← APScheduler 설정 (Phase 2+)
│   ├── requirements.txt
│   │
│   ├── routers/                ← API 엔드포인트
│   │   ├── __init__.py
│   │   ├── data.py             ← 파일 업로드/미리보기
│   │   ├── train.py            ← 학습 시작/진행률/결과
│   │   ├── predict.py          ← 단건/배치 예측
│   │   ├── report.py           ← PDF 리포트 생성
│   │   ├── experiments.py      ← MLflow 실험 관리 (Phase 2)
│   │   ├── registry.py         ← 모델 레지스트리 (Phase 2)
│   │   ├── drift.py            ← 드리프트 감지 결과 (Phase 2)
│   │   ├── realtime.py         ← WebSocket 스트리밍 (Phase 3)
│   │   ├── watcher.py          ← 파일 감시 설정 (Phase 3)
│   │   └── auth.py             ← 로그인/JWT (Phase 3)
│   │
│   ├── services/               ← 비즈니스 로직
│   │   ├── automl_service.py   ← FLAML 학습 래퍼
│   │   ├── data_service.py     ← 데이터 전처리
│   │   ├── report_service.py   ← PDF 생성
│   │   ├── drift_service.py    ← Evidently 드리프트 (Phase 2)
│   │   ├── file_watcher.py     ← Watchdog 감시 (Phase 3)
│   │   ├── kakao_notifier.py   ← 카카오 알림 (Phase 3)
│   │   └── email_notifier.py   ← 이메일 리포트 (Phase 3)
│   │
│   ├── models/                 ← SQLAlchemy ORM 모델
│   │   ├── __init__.py
│   │   ├── experiment.py       ← 실험 기록
│   │   ├── trained_model.py    ← 학습된 모델 메타데이터
│   │   ├── prediction.py       ← 예측 기록
│   │   ├── alert.py            ← 드리프트/이상 알림 (Phase 2+)
│   │   └── user.py             ← 사용자/권한 (Phase 3)
│   │
│   ├── middleware/
│   │   └── auth.py             ← JWT 권한 검사 (Phase 3)
│   │
│   ├── templates/              ← Jinja2 HTML 템플릿
│   │   └── report.html         ← PDF 리포트 템플릿
│   │
│   └── data/                   ← 런타임 데이터 (Docker volume)
│       ├── uploads/            ← 업로드된 파일 (parquet)
│       ├── models/             ← 학습된 모델 (.pkl)
│       ├── reports/            ← 생성된 PDF
│       └── manufacturing_ai.db ← SQLite DB 파일
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   │
│   └── src/
│       ├── main.jsx
│       ├── App.jsx             ← 라우터 설정
│       │
│       ├── pages/              ← 라우터 페이지 컴포넌트
│       │   ├── HomePage.jsx
│       │   ├── UploadPage.jsx
│       │   ├── SetupPage.jsx
│       │   ├── TrainingPage.jsx
│       │   ├── ResultsPage.jsx
│       │   ├── PredictPage.jsx
│       │   ├── ModelHistoryPage.jsx  ← Phase 2
│       │   ├── RegistryPage.jsx      ← Phase 2
│       │   ├── DriftPage.jsx         ← Phase 2
│       │   ├── RealtimePage.jsx      ← Phase 3
│       │   ├── AlertSettingsPage.jsx ← Phase 3
│       │   └── LoginPage.jsx         ← Phase 3
│       │
│       ├── components/         ← 재사용 UI 컴포넌트
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx
│       │   │   ├── Header.jsx
│       │   │   └── StepWizard.jsx
│       │   ├── charts/
│       │   │   ├── AccuracyCard.jsx
│       │   │   ├── ConfusionMatrix.jsx
│       │   │   ├── ShapBarChart.jsx
│       │   │   ├── RealtimeChart.jsx  ← Phase 3
│       │   │   └── DriftGauge.jsx     ← Phase 2
│       │   ├── data/
│       │   │   ├── FileDropzone.jsx
│       │   │   └── DataTable.jsx
│       │   └── common/
│       │       ├── ProtectedRoute.jsx ← Phase 3
│       │       ├── AlertBadge.jsx
│       │       └── LoadingSpinner.jsx
│       │
│       ├── hooks/
│       │   ├── useFileUpload.js
│       │   ├── useTraining.js
│       │   ├── useRealtimePredictions.js  ← Phase 3
│       │   └── useAuth.js                 ← Phase 3
│       │
│       ├── api/                ← axios API 함수 모음
│       │   ├── client.js       ← axios 인스턴스 설정
│       │   ├── data.api.js
│       │   ├── train.api.js
│       │   ├── predict.api.js
│       │   ├── report.api.js
│       │   ├── experiments.api.js  ← Phase 2
│       │   └── auth.api.js         ← Phase 3
│       │
│       ├── store/
│       │   ├── useAppStore.js      ← 메인 앱 상태
│       │   └── useAuthStore.js     ← 인증 상태 (Phase 3)
│       │
│       └── constants/
│           └── korean.js           ← 모든 한국어 UI 텍스트
│
└── mlflow-data/                ← MLflow 데이터 (Docker volume, Phase 2)
    ├── mlflow.db
    └── artifacts/
```

---

## 🗄️ DB 스키마 (SQLite)

### `experiments` 테이블
```sql
CREATE TABLE experiments (
    id          TEXT PRIMARY KEY,        -- UUID
    name        TEXT NOT NULL,           -- 실험명 (사용자 입력)
    file_id     TEXT NOT NULL,           -- 업로드된 파일 ID
    target_col  TEXT NOT NULL,           -- 예측 대상 컬럼
    feature_cols TEXT NOT NULL,          -- 입력 피처 (JSON 배열)
    task        TEXT NOT NULL,           -- 'classification' | 'regression'
    status      TEXT DEFAULT 'pending',  -- pending | running | done | failed
    mlflow_run_id TEXT,                  -- MLflow run ID (Phase 2)
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `trained_models` 테이블
```sql
CREATE TABLE trained_models (
    id              TEXT PRIMARY KEY,    -- UUID (model_id)
    experiment_id   TEXT NOT NULL,
    model_path      TEXT NOT NULL,       -- .pkl 파일 경로
    best_estimator  TEXT,                -- 최적 알고리즘 이름
    accuracy        REAL,                -- 정확도 (0~1)
    training_time   REAL,                -- 학습 소요 시간 (초)
    feature_importance TEXT,             -- JSON {컬럼명: 중요도}
    stage           TEXT DEFAULT 'staging', -- staging | production | archived
    mlflow_version  INTEGER,             -- MLflow 모델 버전 (Phase 2)
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);
```

### `predictions` 테이블
```sql
CREATE TABLE predictions (
    id          TEXT PRIMARY KEY,        -- UUID
    model_id    TEXT NOT NULL,
    input_data  TEXT NOT NULL,           -- JSON (입력값)
    output_data TEXT NOT NULL,           -- JSON (예측값 + 확률)
    source      TEXT DEFAULT 'manual',   -- manual | batch | auto (Phase 3)
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES trained_models(id)
);
```

### `alerts` 테이블 (Phase 2+)
```sql
CREATE TABLE alerts (
    id          TEXT PRIMARY KEY,
    model_id    TEXT NOT NULL,
    alert_type  TEXT NOT NULL,           -- 'drift' | 'threshold' | 'error'
    level       TEXT NOT NULL,           -- 'info' | 'warning' | 'danger'
    message     TEXT NOT NULL,
    payload     TEXT,                    -- JSON 추가 데이터
    is_read     INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `users` 테이블 (Phase 3)
```sql
CREATE TABLE users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role        TEXT DEFAULT 'viewer',   -- admin | operator | viewer
    email       TEXT,
    is_active   INTEGER DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🌐 API 엔드포인트 전체 목록

### Phase 1 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/data/upload` | 파일 업로드 |
| GET | `/api/data/{file_id}/preview` | 데이터 미리보기 (상위 100행) |
| GET | `/api/data/{file_id}/analysis` | 데이터 품질 분석 결과 |
| POST | `/api/train/start` | AutoML 학습 시작 (BackgroundTask) |
| GET | `/api/train/progress/{session_id}` | SSE 학습 진행률 스트림 |
| GET | `/api/train/results/{model_id}` | 학습 결과 (정확도, SHAP 등) |
| GET | `/api/train/models` | 저장된 모델 목록 |
| POST | `/api/predict/single` | 단건 예측 |
| POST | `/api/predict/batch` | 배치 예측 (CSV 업로드) |
| GET | `/api/report/{model_id}` | PDF 리포트 다운로드 |

### Phase 2 추가 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/experiments` | 실험 목록 (MLflow 연동) |
| GET | `/api/experiments/{run_id}` | 실험 상세 |
| POST | `/api/experiments/compare` | 두 실험 비교 |
| POST | `/api/registry/register` | 모델 운영 등록 |
| PUT | `/api/registry/{name}/stage` | 모델 스테이지 변경 |
| GET | `/api/drift/{model_id}` | 드리프트 감지 결과 |
| POST | `/api/drift/check` | 수동 드리프트 체크 실행 |
| POST | `/api/train/retrain/{model_id}` | 재학습 실행 |

### Phase 3 추가 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| WS | `/ws/predictions` | 실시간 예측 WebSocket |
| POST | `/api/watcher/start` | 파일 감시 시작 |
| POST | `/api/watcher/stop` | 파일 감시 중지 |
| GET | `/api/watcher/status` | 감시 현황 |
| POST | `/api/alerts/settings` | 알림 설정 저장 |
| GET | `/api/predictions/{id}/detail` | 예측 상세 + 원인 분석 |
| POST | `/api/auth/login` | 로그인 → JWT 발급 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 사용자 정보 |

---

## 🔗 포트 배분

| 서비스 | 포트 | URL |
|--------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 8000 | http://localhost:8000 |
| MLflow UI | 5000 | http://localhost:5000 (Phase 2) |
| API 문서 | 8000 | http://localhost:8000/docs |

---

## 🔑 환경변수 전체 목록 (`.env`)

```bash
# ── Backend 기본 ──────────────────────────────
DATABASE_URL=sqlite:///./data/manufacturing_ai.db
SECRET_KEY=change-this-to-a-random-secret-key-min-32chars
ACCESS_TOKEN_EXPIRE_MINUTES=480

# ── MLflow (Phase 2) ──────────────────────────
MLFLOW_TRACKING_URI=http://mlflow:5000

# ── 알림 서비스 (Phase 3) ─────────────────────
KAKAO_REST_API_KEY=your_kakao_rest_api_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password

# ── Frontend ──────────────────────────────────
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```
