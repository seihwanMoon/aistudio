# ✅ PROGRESS — 마스터 진척 트래커

> 코딩 에이전트는 작업 완료 시 `[ ]` → `[x]` 로 변경하고 날짜를 기입하세요.
> 블로커는 해당 항목 바로 아래 `> ⚠️ 이슈:` 형식으로 기록하세요.

---

## 📊 전체 진척 현황

| Phase | 진행률 | 완료 / 전체 |
|-------|--------|------------|
| SETUP | 60% | 3 / 5 |
| Phase 1 MVP | 0% | 0 / 28 |
| Phase 2 MLOps | 0% | 0 / 22 |
| Phase 3 현장연동 | 0% | 0 / 26 |

> 이 표는 아래 체크박스 완료 수를 세어 수동으로 업데이트하세요.

---

## 🛠️ SETUP — 개발환경 초기화

- [ ] **S-01** Docker Desktop 설치 확인 및 버전 체크 (≥ v4.0)
  - 완료일: ___
  > ⚠️ 이슈: Docker CLI가 설치되어 있지 않아 버전 체크를 수행할 수 없음 (`docker: command not found`).
- [x] **S-02** 프로젝트 루트 폴더 구조 생성 (`ARCHITECTURE.md` 참고)
  - 완료일: 2026-02-27
- [x] **S-03** Backend `requirements.txt` 설치 검증 (`pip install -r requirements.txt`)
  - 완료일: 2026-02-27
- [x] **S-04** Frontend 의존성 설치 검증 (`npm install`)
  - 완료일: 2026-02-27
- [ ] **S-05** `docker-compose up` 으로 전체 스택 기동 확인
  - 완료일: ___
  > ⚠️ 이슈: Docker Compose가 설치되어 있지 않아 전체 스택 기동 검증을 수행할 수 없음 (`docker-compose: command not found`).

---

## 🚀 Phase 1 — MVP (목표: 8주)

### [W1-W2] 프로젝트 기반 셋업

- [ ] **P1-01** FastAPI 앱 진입점 (`backend/main.py`) 작성
  - 완료일: ___
- [ ] **P1-02** SQLite DB 연결 및 `database.py` 작성
  - 완료일: ___
- [ ] **P1-03** DB 모델 정의 (`models/experiment.py`, `models/model.py`)
  - 완료일: ___
- [ ] **P1-04** Vite + React 프로젝트 초기화 및 라우터 셋업
  - 완료일: ___
- [ ] **P1-05** Zustand 전역 스토어 (`store/useAppStore.js`) 작성
  - 완료일: ___

### [W3-W4] 데이터 업로드 & 전처리

- [ ] **P1-06** 파일 업로드 API (`POST /api/data/upload`) 구현
  - 완료일: ___
  - 요구사항: CSV + XLSX, 최대 50MB, EUC-KR/UTF-8 자동 감지
- [ ] **P1-07** 데이터 품질 분석 함수 (결측값 카운트, 컬럼 타입 감지)
  - 완료일: ___
- [ ] **P1-08** 데이터 미리보기 API (`GET /api/data/{file_id}/preview`)
  - 완료일: ___
- [ ] **P1-09** Upload 페이지 UI 컴포넌트 (`pages/UploadPage.jsx`)
  - 완료일: ___
  - 요구사항: 드래그앤드롭, 파일 형식 안내, 샘플 데이터 다운로드 버튼
- [ ] **P1-10** DataPreview 컴포넌트 (상위 100행 테이블, 결측값 하이라이트)
  - 완료일: ___

### [W5-W6] AutoML 학습 엔진

- [ ] **P1-11** FLAML AutoML 래퍼 서비스 (`services/automl_service.py`)
  - 완료일: ___
  - 요구사항: 분류/회귀 자동 판별, time_budget=120초 기본값
- [ ] **P1-12** 학습 API (`POST /api/train/start`) + BackgroundTasks 비동기 처리
  - 완료일: ___
- [ ] **P1-13** SSE 진행률 스트리밍 (`GET /api/train/progress/{session_id}`)
  - 완료일: ___
- [ ] **P1-14** SHAP 피처 중요도 계산 및 결과 저장
  - 완료일: ___
- [ ] **P1-15** 학습 설정 UI (`pages/SetupPage.jsx`) — 타겟/피처 선택 위저드
  - 완료일: ___
- [ ] **P1-16** 학습 진행 UI (`pages/TrainingPage.jsx`) — 원형 프로그레스 + 로그
  - 완료일: ___

### [W7] 결과 시각화 & 예측

- [ ] **P1-17** 결과 대시보드 API (`GET /api/train/results/{model_id}`)
  - 완료일: ___
- [ ] **P1-18** 결과 대시보드 UI (`pages/ResultsPage.jsx`)
  - 완료일: ___
  - 요구사항: 정확도 카드, 혼동행렬, SHAP 바 차트 (recharts)
- [ ] **P1-19** 단건 예측 API (`POST /api/predict/single`)
  - 완료일: ___
- [ ] **P1-20** 배치 예측 API (`POST /api/predict/batch`) — CSV 업로드 방식
  - 완료일: ___
- [ ] **P1-21** 예측 입력 UI (`pages/PredictPage.jsx`)
  - 완료일: ___

### [W8] 리포트 & 패키징

- [ ] **P1-22** PDF 리포트 Jinja2 템플릿 작성 (`templates/report.html`)
  - 완료일: ___
- [ ] **P1-23** PDF 생성 서비스 (`services/report_service.py`) + WeasyPrint
  - 완료일: ___
- [ ] **P1-24** PDF 다운로드 API (`GET /api/report/{model_id}`)
  - 완료일: ___
- [ ] **P1-25** 한국어 UI 텍스트 상수 파일 (`constants/korean.js`)
  - 완료일: ___
- [ ] **P1-26** `docker-compose.yml` 완성 (backend + frontend)
  - 완료일: ___
- [ ] **P1-27** Backend `Dockerfile` 작성
  - 완료일: ___
- [ ] **P1-28** Frontend `Dockerfile` 작성
  - 완료일: ___

---

## 📦 Phase 2 — MLOps (목표: Phase 1 완료 후 8주)

### [W1-W2] MLflow 연동

- [ ] **P2-01** MLflow 도커 서비스 추가 (`docker-compose.yml` 확장)
  - 완료일: ___
- [ ] **P2-02** `automl_service.py` 에 MLflow 자동 기록 연동
  - 완료일: ___
- [ ] **P2-03** 실험 목록 조회 API (`GET /api/experiments`)
  - 완료일: ___
- [ ] **P2-04** 실험 상세 조회 API (`GET /api/experiments/{run_id}`)
  - 완료일: ___

### [W3-W4] 모델 레지스트리

- [ ] **P2-05** 모델 등록 API (`POST /api/registry/register`)
  - 완료일: ___
- [ ] **P2-06** 운영 모델 전환 API (`PUT /api/registry/{model_name}/stage`)
  - 완료일: ___
- [ ] **P2-07** 모델 히스토리 페이지 UI (`pages/ModelHistoryPage.jsx`)
  - 완료일: ___
- [ ] **P2-08** 모델 레지스트리 UI (`pages/RegistryPage.jsx`)
  - 완료일: ___

### [W5-W6] 드리프트 감지

- [ ] **P2-09** Evidently 드리프트 감지 서비스 (`services/drift_service.py`)
  - 완료일: ___
- [ ] **P2-10** APScheduler 주간 자동 실행 설정 (`scheduler.py`)
  - 완료일: ___
- [ ] **P2-11** 드리프트 알림 저장 API 및 DB 모델
  - 완료일: ___
- [ ] **P2-12** 드리프트 대시보드 UI (`pages/DriftPage.jsx`)
  - 완료일: ___
  - 요구사항: 게이지 차트, 알림 타임라인, 재학습 버튼

### [W7] 비교 분석

- [ ] **P2-13** 실험 비교 API (`POST /api/experiments/compare`)
  - 완료일: ___
- [ ] **P2-14** 실험 비교 UI — 레이더 차트 (recharts)
  - 완료일: ___
- [ ] **P2-15** A/B 예측 비교 API (`POST /api/predict/ab-compare`)
  - 완료일: ___
- [ ] **P2-16** A/B 비교 UI — 나란히 결과 표시
  - 완료일: ___

### [W8] 재학습 자동화

- [ ] **P2-17** 원클릭 재학습 API (`POST /api/train/retrain/{model_id}`)
  - 완료일: ___
- [ ] **P2-18** 재학습 트리거 조건 설정 UI (임계값 슬라이더)
  - 완료일: ___
- [ ] **P2-19** `requirements.txt` Phase 2 의존성 추가 (mlflow, evidently, apscheduler)
  - 완료일: ___
- [ ] **P2-20** Phase 2 전체 통합 테스트
  - 완료일: ___
- [ ] **P2-21** 사이드바 네비게이션 업데이트 (Phase 2 메뉴 추가)
  - 완료일: ___
- [ ] **P2-22** Phase 2 `docker-compose.yml` 최종 업데이트
  - 완료일: ___

---

## 🔴 Phase 3 — 현장 연동 (목표: Phase 2 완료 후 12주)

### [W1-W2] 실시간 데이터 수집

- [ ] **P3-01** Watchdog 파일 감시 서비스 (`services/file_watcher.py`)
  - 완료일: ___
- [ ] **P3-02** 감시 폴더 설정 API (`POST /api/watcher/config`)
  - 완료일: ___
- [ ] **P3-03** 자동 예측 실행 파이프라인 (파일 감지 → 예측 → DB 저장)
  - 완료일: ___
- [ ] **P3-04** 감시 서비스 시작/중지 UI
  - 완료일: ___

### [W3-W4] WebSocket 실시간 스트리밍

- [ ] **P3-05** WebSocket 서버 (`routers/realtime.py`)
  - 완료일: ___
- [ ] **P3-06** `broadcast_prediction()` 함수 — 전체 연결 클라이언트에 전송
  - 완료일: ___
- [ ] **P3-07** `useRealtimePredictions` 훅 (`hooks/useRealtimePredictions.js`)
  - 완료일: ___
- [ ] **P3-08** 실시간 라인 차트 컴포넌트 (`components/RealtimeChart.jsx`)
  - 완료일: ___
- [ ] **P3-09** 실시간 모니터링 대시보드 페이지 (`pages/RealtimePage.jsx`)
  - 완료일: ___

### [W5-W6] 알림 시스템

- [ ] **P3-10** 카카오 알림톡 서비스 (`services/kakao_notifier.py`)
  - 완료일: ___
- [ ] **P3-11** 이메일 일간 리포트 서비스 (`services/email_notifier.py`)
  - 완료일: ___
- [ ] **P3-12** APScheduler 이메일 발송 스케줄 (매일 오전 8시)
  - 완료일: ___
- [ ] **P3-13** 알림 설정 UI (`pages/AlertSettingsPage.jsx`)
  - 완료일: ___
  - 요구사항: 임계값 슬라이더, 수신자 이메일 입력, 카카오 연동 버튼

### [W7-W8] 고급 시각화

- [ ] **P3-14** 예측 히트맵 컴포넌트 (시간대×공정 2D 히트맵)
  - 완료일: ___
- [ ] **P3-15** 이상 구간 드릴다운 API (`GET /api/predictions/{id}/detail`)
  - 완료일: ___
- [ ] **P3-16** 이상 구간 드릴다운 UI — 클릭 → 상세 모달
  - 완료일: ___
- [ ] **P3-17** 이상 원인 분석 — SHAP 로컬 설명 표시
  - 완료일: ___

### [W9-W10] 인증 & 권한

- [ ] **P3-18** JWT 인증 미들웨어 (`middleware/auth.py`)
  - 완료일: ___
- [ ] **P3-19** 사용자 모델 및 역할 정의 (Admin / Operator / Viewer)
  - 완료일: ___
- [ ] **P3-20** 로그인/로그아웃 API + UI
  - 완료일: ___
- [ ] **P3-21** 권한별 라우트 가드 (`components/ProtectedRoute.jsx`)
  - 완료일: ___

### [W11] 모바일 최적화

- [ ] **P3-22** 모바일 반응형 레이아웃 (Tailwind breakpoints 적용)
  - 완료일: ___
- [ ] **P3-23** 태블릿용 사이드바 → 하단 탭 네비게이션 전환
  - 완료일: ___

### [W12] 최종 마무리

- [ ] **P3-24** Phase 3 전체 통합 테스트
  - 완료일: ___
- [ ] **P3-25** `docker-compose.yml` 최종 완성본
  - 완료일: ___
- [ ] **P3-26** 사용자 매뉴얼 작성 (`MANUAL.md`)
  - 완료일: ___

---

## 🐛 이슈 & 블로커 로그

> 발생한 이슈는 아래에 추가하세요.

```
[날짜] [항목ID] 이슈 내용
예: [2026-03-01] [P1-11] FLAML이 Windows에서 멀티프로세싱 오류 발생 → freeze_support() 추가로 해결
```

---

## 📝 완료 기록

| 완료일 | 항목 | 비고 |
|--------|------|------|
| — | — | — |
