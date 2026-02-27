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
