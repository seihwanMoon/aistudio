# Manufacturing AI Studio 상세 사용자 가이드

이 문서는 Docker 환경에서 `Manufacturing AI Studio`를 실제 운영하는 사용자를 위한 상세 안내서입니다.
대상은 `데이터 업로드 -> 모델 학습 -> 결과 확인 -> 예측 -> MLOps/실시간 관제` 전체 흐름을 사용하는 담당자입니다.

## 1. 접속 정보

기본 포트 기준:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- MLflow UI: `http://localhost:5000`

포트 충돌이 있으면 Frontend 포트만 변경할 수 있습니다.
- 예: `FRONTEND_PORT=43000 docker-compose up -d --build`
- 이 경우 Frontend 접속 URL은 `http://localhost:43000`

## 2. 실행/중지 명령

프로젝트 루트(`/home/moon/PRJ/GPT/aistudio`)에서:

```bash
cd manufacturing-ai-studio

# 전체 빌드 + 실행
FRONTEND_PORT=43000 docker-compose up -d --build

# 상태 확인
docker-compose ps

# 로그 확인
# backend
docker-compose logs -f backend
# frontend
docker-compose logs -f frontend
# mlflow
docker-compose logs -f mlflow

# 종료
docker-compose down
```

## 3. 첫 사용(로그인/계정)

1. 브라우저에서 Frontend 접속
2. `/login` 화면에서 로그인
3. 최초 1회는 `회원가입(초기)` 버튼으로 계정 생성 후 로그인

기본 입력값(화면 기본값):
- username: `admin`
- password: `admin123`

가입 시 역할 선택:
- `admin`: 전체 메뉴 접근(레지스트리/알림설정 포함)
- `operator`: 운영 메뉴 접근(업로드/학습/예측/드리프트/실시간)
- `viewer`: 조회 중심 메뉴 접근(홈/학습결과/히스토리)

주의:
- 이미 같은 username이 있으면 회원가입은 실패하고 로그인만 진행해야 합니다.

## 4. 기본 운영 흐름

### 4.1 데이터 업로드

메뉴: `데이터 업로드` (`/upload`)

기능:
- CSV/XLSX 업로드
- 최대 50MB
- CSV 인코딩 자동 감지(chardet)
- 업로드 직후 Preview(상위 100행, 컬럼 타입, 결측치 수)
- 업로드 직후 EDA 자동 분석
  - 품질 점수/결측/중복/상수 컬럼 요약
  - 상관관계 히트맵 데이터(상관 높은 페어)
  - 피처별 프로필(분포/이상치 비율)
  - 타겟 인사이트(타겟 기준 연관 Top Features)
- 샘플 파일 다운로드 버튼 제공

권장 확인 포인트:
- `file_id`가 생성되었는지
- Preview에서 target으로 쓸 컬럼이 정상 로딩되는지

### 4.2 학습 설정

메뉴: `학습 설정` (`/setup`)

기능:
- target 컬럼 1개 선택
- feature 컬럼 1개 이상 선택
- target dtype 기준 task type 자동 감지
  - 수치형이면 회귀(regression)
  - 그 외 분류(classification)

주의:
- 업로드를 먼저 하지 않으면 설정 화면에서 진행 불가
- target/feature 미선택 시 학습 시작 불가

### 4.3 학습 실행

메뉴: `AI 학습` (`/training`)

기능:
- 학습 시작
- 진행률(%)와 로그 표시
- 완료 시 자동으로 결과 페이지 이동
- 사용자가 `학습 시작` 버튼을 누를 때만 시작(자동 시작 없음)
- 서버 재시작 시 `queued/running` 상태 세션은 자동 복구되어 재개됨

기본 설정:
- `time_budget = 120초`
- 백엔드 내부 모델: RandomForest 기반
- 학습 완료 시 DB 모델 정보 + artifact(joblib) 저장
- 대용량 데이터는 `MAX_TRAIN_ROWS`(기본 50000행) 기준으로 샘플링 후 학습

### 4.4 학습 결과/리포트

메뉴: `학습 결과` (`/results`)

기능:
- 모델명, metric, 학습 시간
- 혼동행렬(분류일 때)
- feature importance 차트
- PDF 리포트 다운로드
- 예측 화면으로 이동

PDF 리포트:
- 버튼 클릭 시 `/api/report/{model_id}` 호출
- 파일명 예시: `report_3.pdf`

### 4.5 예측

메뉴: `예측하기` (`/predict`)

기능:
- 단건 예측: feature 입력 후 예측
- 배치 예측: CSV/XLSX 업로드 후 일괄 예측

주의:
- 학습이 끝나 모델 ID가 없는 상태면 예측 불가

## 5. MLflow 화면 사용법

접속: `http://localhost:5000`

학습 실행 후 확인할 내용:
1. Experiment 이름: `manufacturing_ai`
2. Run 목록에서 최신 run 선택
3. Parameters 확인
   - `task_type`, `target_column`, `feature_count`, `feature_columns`, `time_budget`
4. Metrics 확인
   - 분류: `accuracy`, `f1_score`, `primary_metric`
   - 회귀: `r2_score`, `mae`, `primary_metric`
5. Artifacts에서 `model` 확인
   - `training_summary.json`
   - `eda/summary.json`, `eda/correlation.json`
   - `xai/global_shap.json`

Run 이름 규칙:
- `train-<session_timestamp>` 형식으로 생성되어 실행마다 고유하게 구분됩니다.
- `학습 시작` 버튼을 누를 때마다 새로운 run 1개가 생성됩니다.

앱과 연결해서 쓰는 방법:
- 앱 `모델 히스토리`에서 run_id 확인
- 앱 `레지스트리`에서 `model_name + run_id`로 등록
- 등록 후 `Production 승격` 가능

중요(아티팩트 저장):
- `docker-compose.yml`에서 backend와 mlflow가 같은 `./mlflow-data:/mlflow` 볼륨을 공유해야
  MLflow UI에서 artifact가 정상 보입니다.

## 6. MLOps 기능 상세

### 6.1 모델 히스토리

메뉴: `히스토리` (`/model-history`)

기능:
- 실험/런 목록 조회
- run_id 2개 이상 선택 후 비교

### 6.2 모델 레지스트리

메뉴: `레지스트리` (`/registry`)

기능:
- `model_name`, `run_id`로 모델 등록
- 최신 버전을 `Production`으로 승격
- 모델별 버전/상태 조회

### 6.3 드리프트 모니터링

메뉴: `성능 모니터링` (`/drift`)

기능:
- model_id 기준 상태 조회
- 수동 점검(`지금 점검`) 실행
- 알림 이력 조회

판정 레벨:
- `ok`
- `warning`
- `danger`

### 6.4 알림 설정

메뉴: `알림 설정` (`/alerts`, admin 전용)

기능:
- 임계값/이메일/카카오 수신 번호 저장
- 채널별 테스트 알림 전송(email/kakao/both)
- 최근 발송 로그 조회

## 7. 실시간 관제(Watcher + WebSocket)

메뉴: `실시간 모니터링` (`/realtime`)

구성:
- Watcher 제어(감시 시작/중지/상태)
- WebSocket 실시간 스트림
- 실시간 차트/히트맵/알림 타임라인

### 7.1 사전 준비

1. 유효한 `model_id` 확보(학습 완료 필요)
2. 감시 폴더 준비

호스트 기준:
```bash
mkdir -p /home/moon/PRJ/GPT/aistudio/manufacturing-ai-studio/backend/data/uploads/watch
```

UI 입력 권장값:
- `watch_dir`: `/app/data/uploads/watch`
- `model_id`: 학습된 모델 ID
- `threshold`: `0.7` (기본)

설명:
- 백엔드 컨테이너에서 경로 존재를 검사하므로 `watch_dir`는 컨테이너 기준 경로여야 합니다.
- `backend/data`는 `/app/data`로 마운트되어 있습니다.
- 감시 설정은 서버 재시작 후 자동 복구됩니다(저장된 watcher config 기준).

### 7.2 테스트 방법

1. 실시간 페이지에서 `감시 시작`
2. 호스트의 `backend/data/uploads/watch` 폴더에 CSV 파일 생성/복사
3. 실시간 페이지에서 배치 이벤트 수신 확인

예시 CSV(컬럼은 학습 모델 feature와 일치 필요):
```csv
feature_a,feature_b,feature_c
10,0.2,3
8,0.5,7
```

## 8. API 빠른 참조

주요 엔드포인트:
- 인증
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- 데이터
  - `POST /api/data/upload`
  - `GET /api/data/{file_id}/preview`
- EDA
  - `GET /api/eda/{file_id}/summary`
  - `GET /api/eda/{file_id}/correlation`
  - `GET /api/eda/{file_id}/feature/{feature_name}`
  - `POST /api/eda/{file_id}/target-insight`
- 학습
  - `POST /api/train/start`
  - `GET /api/train/status/{session_id}`
  - `GET /api/train/results/{model_id}`
  - `GET /api/train/flaml-health`
  - `POST /api/train/retrain/{model_id}`
- XAI
  - `GET /api/xai/global/{model_id}`
  - `POST /api/xai/local`
  - `POST /api/xai/pdp`
- 예측
  - `POST /api/predict/single`
  - `POST /api/predict/batch?model_id={id}`
  - `POST /api/predict/ab-compare`
  - `GET /api/predict/{prediction_id}/detail`
- 리포트
  - `GET /api/report/{model_id}`
- MLOps
  - `GET /api/experiments`
  - `GET /api/experiments/{run_id}`
  - `POST /api/experiments/compare`
  - `POST /api/registry/register`
  - `PUT /api/registry/{model_name}/stage`
  - `GET /api/registry`
  - `POST /api/drift/check/{model_id}`
  - `GET /api/drift/status/{model_id}`
  - `GET /api/drift/alerts`
- 실시간/Watcher
  - `WS /ws/predictions`
  - `POST /api/watcher/config`
  - `POST /api/watcher/stop/{watcher_id}`
  - `GET /api/watcher/status`
- 알림 설정
  - `GET /api/alerts/settings`
  - `PUT /api/alerts/settings`
  - `POST /api/alerts/test`
  - `GET /api/alerts/logs`

## 9. 운영 중 자주 발생하는 이슈

### 9.1 Frontend 포트 충돌
증상:
- `bind: ... 0.0.0.0:3000` 오류

해결:
```bash
FRONTEND_PORT=43000 docker-compose up -d --build
```

### 9.2 로그인 실패
증상:
- `아이디 또는 비밀번호가 올바르지 않습니다.`

해결:
- 기존 계정이면 로그인만 시도
- 최초 계정이면 회원가입 후 로그인

### 9.3 학습 실패
증상:
- 학습 진행 중 failed

점검:
- target/feature가 올바른지
- 업로드 데이터에 비정상 값이 많은지
- backend 로그 확인: `docker-compose logs -f backend`

### 9.4 실시간 감시가 동작하지 않음
증상:
- 감시 시작은 되지만 이벤트가 안 들어옴

점검:
- `watch_dir`가 컨테이너 경로인지 (`/app/data/...`)
- 해당 폴더가 실제로 존재하는지
- 입력 CSV 컬럼이 모델 feature와 일치하는지

### 9.5 새로고침 후 예측 화면 동작 불가
설명:
- 일부 학습 상태(model_id, feature 목록)는 브라우저 메모리(store)에만 유지됩니다.

대응:
- 같은 세션에서 결과 확인/예측까지 진행
- 필요 시 다시 학습 실행 후 진행

### 9.6 콘솔에 `chrome-extension://... postMessage` 에러가 반복됨
설명:
- 브라우저 확장 프로그램에서 발생하는 메시지로, 앱 백엔드 에러가 아닙니다.

대응:
- 시크릿 모드(확장 비활성) 또는 확장 프로그램 OFF 후 재확인
- 실제 앱 오류는 Network 탭의 `/api/*` 응답 코드 기준으로 판단

### 9.7 FLAML 헬스체크 확인 방법
확인:
```bash
curl http://localhost:8000/api/train/flaml-health
```

예상:
- `status: ok` 이면 FLAML import 정상
- `dtype_converter_available: false` 는 FLAML 버전 차이로 보조 함수가 없는 상태일 수 있으며,
  이 경우에도 앱은 pandas 변환 fallback으로 동작

### 9.8 XAI 응답이 느리거나 빈번하게 재계산되는 경우
튜닝 환경변수(backend):
- `XAI_CACHE_TTL_SECONDS` (기본 86400)
- `XAI_MAX_REFERENCE_ROWS` (기본 3000)
- `XAI_SHAP_CELL_CAP` (기본 50000)

튜닝 환경변수(EDA):
- `EDA_CACHE_TTL_SECONDS` (기본 86400)

확인 API:
```bash
curl http://localhost:8000/api/xai/health
```

### 9.9 MLflow Run이 계속 늘어나는 경우
설명:
- 정상 동작입니다. `학습 시작` 버튼 클릭 1회당 run 1개가 생성됩니다.
- 실험 이력 비교/회귀 추적을 위해 run을 누적 저장합니다.

점검:
- 의도치 않은 run 생성이 의심되면 `/training` 페이지에서 자동 시작이 없는지 확인
- run 이름은 `train-<session_timestamp>`로 고유 생성되어 중복 식별이 가능합니다.

## 10. 권장 운영 절차(요약)

1. `docker-compose up -d --build`
2. `/login`에서 로그인
3. `/upload` 업로드 + preview 확인
4. `/setup` target/feature 선택
5. `/training` 학습 완료 대기
6. `/results` 성능 확인 + PDF 저장
7. `/predict` 현업 데이터 예측
8. `/model-history`, `/registry`로 버전 관리
9. `/drift` 주기 점검
10. `/realtime`로 파일 감시 기반 실시간 관제

## 11. 백엔드 테스트 실행

현재 의존성 기준으로 백엔드 테스트는 Python 3.11 컨테이너에서 실행하는 것을 권장합니다.

```bash
cd /home/moon/PRJ/GPT/aistudio/manufacturing-ai-studio

# 1) backend 재빌드/기동
FRONTEND_PORT=43000 docker compose up -d --build backend

# 2) 테스트 도구 설치(컨테이너 내부)
docker exec manufacturing-ai-studio-backend-1 python -m pip install pytest==8.2.2

# 3) 테스트 실행
docker exec manufacturing-ai-studio-backend-1 sh -lc 'cd /app && python -m pytest -q'
```

## 12. EDA/XAI 성능 스모크 점검

샘플 실행:
```bash
cd /home/moon/PRJ/GPT/aistudio/manufacturing-ai-studio
docker exec manufacturing-ai-studio-backend-1 \
  python /app/scripts/perf_smoke.py \
  --base-url http://localhost:8000 \
  --file-id 697566ee60eb48b6948db7933a074b38 \
  --model-id 10 \
  --target-column 경도 \
  --feature-name 가열온도
```
