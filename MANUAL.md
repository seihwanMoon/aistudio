# Manufacturing AI Studio 사용자 매뉴얼

## 1) 로그인
- `/login` 에서 계정으로 로그인합니다.
- 초기에는 회원가입 버튼으로 admin 계정을 생성할 수 있습니다.

## 2) 데이터 업로드
- `데이터 업로드` 메뉴에서 CSV/XLSX 파일을 업로드합니다.
- 업로드 직후 상위 100행 미리보기를 확인합니다.

## 3) 학습
- `학습 설정`에서 타겟/피처를 선택합니다.
- `AI 학습`에서 학습을 시작하고 진행 로그를 확인합니다.
- 완료 후 `학습 결과`에서 지표/피처중요도/리포트를 확인합니다.

## 4) 예측
- `예측하기`에서 단건/배치 예측을 실행합니다.
- 예측 결과는 DB에 저장됩니다.

## 5) MLOps (Phase 2)
- `모델 히스토리`: 실험 조회/비교
- `레지스트리`: 모델 등록/Production 승격
- `성능 모니터링`: 드리프트 점검 및 알림 확인

## 6) 현장 연동 (Phase 3)
- `실시간 모니터링`: WebSocket 실시간 예측 스트림/히트맵/드릴다운 확인
- `알림 설정`: 임계값/이메일/카카오 수신 설정
- Watcher API로 폴더 감시를 시작하면 CSV 신규 파일이 자동 예측됩니다.

## 7) Docker 실행
```bash
cd manufacturing-ai-studio
docker-compose up -d --build
# 포트 3000 충돌 시
# FRONTEND_PORT=43000 docker-compose up -d --build
```

## 8) 트러블슈팅
- Docker 미설치: Docker Desktop 설치 필요
- MLflow 미설치 환경: 앱은 fallback 동작, 레지스트리/실험 일부 기능 제한
- 브라우저에서 API 호출 실패: `backend` 컨테이너 및 CORS 설정 확인
