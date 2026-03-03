# EDA + XAI 고도화 개발 계획

## 1) 목적
- 업로드 데이터에 대한 EDA(품질/분포/관계) 기능을 강화한다.
- 모델 결과를 XAI(Global/Local)로 설명 가능하게 만든다.
- EDA 결과와 XAI 결과를 같은 피처 중심으로 연결해, 원인 분석부터 개선 액션까지 한 흐름으로 제공한다.

## 2) 현재 상태 요약
- 데이터 미리보기: 상위 100행, dtype, 결측 수 제공(기본 수준)
- XAI: 실질 SHAP 계산 없이 입력값 기반 근사 표시
- 결과 시각화: feature importance bar 1개 중심
- MLflow: 기본 metrics/params + model 저장은 진행 중, EDA/XAI artifact는 없음

## 3) 목표
- EDA API: 데이터 품질 점수 + 수치/범주 통계 + 상관 관계 + 이상치 요약
- XAI API: Global SHAP + Local SHAP + PDP/Permutation Importance
- UI: EDA 대시보드 + XAI 대시보드 + 피처 드릴다운 연계
- MLflow: EDA/XAI 결과를 artifact(JSON)로 저장

## 4) 범위
### 포함
- Backend: EDA/XAI 서비스 및 API 추가
- Frontend: 업로드/결과/예측 화면 확장
- Docker/의존성 보완(FLAML import 안정화 포함)
- 문서/테스트/운영 체크리스트

### 제외(이번 단계)
- 대용량(수백만 행) 분산 처리
- 완전한 BI 리포팅(외부 대시보드 도구 대체)
- 모델 계보/승인 워크플로우 고도화

## 5) 아키텍처 변경안
### Backend 신규 파일
- `backend/services/eda_service.py`
- `backend/services/xai_service.py`
- `backend/routers/eda.py`
- `backend/routers/xai.py`

### Backend 수정 파일
- `backend/main.py`: router 등록
- `backend/services/data_service.py`: EDA 전처리 유틸 재사용
- `backend/services/automl_service.py`: 학습 완료 후 EDA/XAI artifact logging hook
- `backend/Dockerfile`: `libgomp1` 추가(FLAML/lightgbm 로딩 안정화)

### Frontend 신규/수정
- `frontend/src/api/eda.api.js`, `frontend/src/api/xai.api.js`
- `frontend/src/pages/UploadPage.jsx`: EDA 탭/카드 추가
- `frontend/src/pages/ResultsPage.jsx`: Global XAI 탭 추가
- `frontend/src/pages/PredictPage.jsx`: Local explanation 패널 추가
- `frontend/src/components/charts/*`: Heatmap/Box/Histogram/SHAP bar 컴포넌트 추가

## 6) 상세 기능 설계
### A. EDA 기능
1. 데이터 품질 요약
- rows, columns, memory usage
- missing ratio(열별/전체)
- duplicate ratio
- constant columns, near-constant columns
- numeric/categorical/datetime 열 수

2. 분포 분석
- numeric: min/max/mean/std/quantile/skewness
- categorical: top-k value counts, unique ratio
- target column 분포(회귀/분류 분기)

3. 관계 분석
- numeric correlation matrix(Pearson/Spearman 선택)
- target 기준 상관/ANOVA 요약
- multicollinearity 경고(|corr| > threshold)

4. 이상치 탐지(EDA 레벨)
- IQR 기반 비율
- z-score 기반 비율
- 상위 이상치 열 Top-N

### B. XAI 기능
1. Global explanation
- SHAP mean(|value|) Top-N
- Permutation importance
- PDP(선택 feature)

2. Local explanation
- 단건 예측 시 SHAP value + base value + prediction decomposition
- 배치 예측 시 행 인덱스 지정 설명

3. Realtime/History 연계
- 특정 예측 기록 선택 시 Local SHAP 재계산 API
- Drift 경고 피처와 SHAP Top 피처 교차 표시

### C. EDA ↔ XAI 연결 포인트
- EDA 상관/이상치 Top 피처 클릭 -> XAI 해당 피처 PDP/SHAP dependence 호출
- Results 화면에서 “문제 피처” 선택 시
  - EDA 분포(히스토그램/박스)
  - Global SHAP 랭킹
  - Local SHAP 사례
  를 한 패널에서 비교

## 7) API 초안
### 7.1 EDA
- `GET /api/eda/{file_id}/summary`
- `GET /api/eda/{file_id}/correlation?method=pearson&max_features=30`
- `GET /api/eda/{file_id}/feature/{feature_name}`
- `POST /api/eda/{file_id}/target-insight`

응답 예시(요약):
```json
{
  "file_id": "abc123",
  "rows": 12000,
  "columns": 42,
  "quality_score": 82.4,
  "missing_top": [{"column":"temp","missing_ratio":0.12}],
  "duplicates_ratio": 0.01,
  "type_counts": {"numeric": 30, "categorical": 10, "datetime": 2},
  "warnings": ["high_missing: temp", "high_corr: x1-x2"]
}
```

### 7.2 XAI
- `GET /api/xai/global/{model_id}?sample_size=2000&top_n=20`
- `POST /api/xai/local`
```json
{
  "model_id": 5,
  "features": {"가열온도": 710, "가열RPM": 1300}
}
```
- `POST /api/xai/pdp`
```json
{
  "model_id": 5,
  "feature": "가열온도",
  "grid_points": 20
}
```

## 8) 데이터/성능 전략
1. 샘플링
- 기본 `sample_size` 2,000 (설정 가능)
- 매우 큰 데이터셋은 stratified/quantile 샘플링

2. 캐시
- 키: `hash(file_id + model_id + params)`
- 저장: `backend/data/cache/eda_xai/*.json`
- TTL: 24시간

3. 계산 제한
- correlation feature cap(예: 50)
- SHAP 계산 timeout 및 fallback(importance only)

## 9) MLflow 연계
- run artifact 저장:
  - `eda/summary.json`
  - `eda/correlation.json`
  - `xai/global_shap.json`
  - `xai/permutation_importance.json`
- model/version tag 추가:
  - `eda_quality_score`
  - `xai_top_feature`
  - `xai_sample_size`

## 10) 단계별 실행 계획
## Phase 0: 기반 보강
- [x] Dockerfile에 `libgomp1` 추가
- [ ] FLAML import 헬스체크 endpoint 추가(선택)
- [x] 캐시 디렉터리 초기화 로직 추가

## Phase 1: EDA API
- [x] `eda_service.py` 구현(quality/summary/correlation/feature-profile)
- [x] `eda.py` router 구현 및 main 등록
- [x] 업로드 후 자동 EDA 호출 옵션 추가
- [ ] 단위 테스트 작성

## Phase 2: XAI API
- [x] `xai_service.py` 구현(ShapExplainer wrapper, local/global)
- [x] `xai.py` router 구현
- [x] 예측 단건/배치 결과와 연결
- [x] MLflow artifact logging 연계

## Phase 3: 프론트 대시보드
- [x] UploadPage에 EDA 탭 추가
- [x] ResultsPage에 Global XAI 섹션 추가
- [x] PredictPage에 Local 설명 탭 추가
- [x] 피처 클릭 드릴다운(EDA ↔ XAI) 연결

## Phase 4: 안정화
- [ ] 캐시/샘플링/timeout 튜닝
- [ ] 사용자 가이드/운영 가이드 업데이트
- [ ] 회귀 테스트 + 성능 점검

## 11) 테스트 계획
### Backend
- `pytest`:
  - EDA summary 응답 스키마 검증
  - 결측/중복/이상치 계산 정확성
  - XAI local/global 최소 1개 모델 검증
  - 캐시 hit/miss 동작

### Frontend
- 핵심 페이지 렌더 테스트:
  - EDA 카드/테이블/차트 렌더
  - XAI bar/waterfall 렌더
- API 실패 시 graceful fallback 메시지

### E2E
- 업로드 -> EDA 확인 -> 학습 -> 결과 -> XAI -> 예측 상세

## 12) 완료 기준(Definition of Done)
- EDA/XAI API 문서화 완료
- UI에서 3개 이상 주요 차트가 정상 렌더
- MLflow에 EDA/XAI artifact 저장 확인
- 샘플 데이터 기준 응답시간 목표 충족
  - EDA summary < 2s
  - XAI local < 3s
  - XAI global(샘플 2k) < 20s

## 13) 리스크 및 대응
1. SHAP 계산 비용 과다
- 대응: 샘플링, 캐시, timeout + fallback

2. 데이터 타입 혼합/인코딩 문제
- 대응: FLAML dtype 보정 + robust parsing + 사용자 경고

3. 모델별 설명 방식 차이
- 대응: 트리모델은 SHAP TreeExplainer, 기타 모델은 permutation 중심 fallback

4. UI 복잡도 증가
- 대응: 탭 구조 + progressive disclosure(기본 요약 -> 상세)

## 14) 개발 순서 권장(바로 실행용)
1. Phase 0 + Phase 1 백엔드 먼저 완료
2. UploadPage EDA 뷰 연결
3. Phase 2 XAI API 추가
4. Results/Predict 페이지 XAI 연결
5. MLflow artifact/tag 연계
6. 문서/테스트/성능 튜닝

## 15) 산출물 목록
- 설계/계획: 본 문서
- 코드: EDA/XAI 서비스, 라우터, 프론트 시각화 컴포넌트
- 테스트: API/단위/E2E
- 문서: user-guide, 운영 troubleshooting, API spec
