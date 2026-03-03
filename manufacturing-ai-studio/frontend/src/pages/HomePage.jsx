import { Link } from 'react-router-dom'

export default function HomePage() {
  const quickLinks = [
    { to: '/upload', label: '데이터 업로드', desc: 'CSV/XLSX 업로드 및 EDA 분석' },
    { to: '/setup', label: '학습 설정', desc: '타겟/피처 선택과 과제 유형 확인' },
    { to: '/training', label: 'AI 학습', desc: '학습 실행과 진행 로그 모니터링' },
    { to: '/results', label: '학습 결과', desc: '성능, XAI, 리포트 다운로드' },
    { to: '/drift', label: '성능 모니터링', desc: '드리프트 상태와 알림 이력 점검' },
    { to: '/realtime', label: '실시간 관제', desc: '파일 감시 기반 실시간 예측' },
  ]

  return (
    <section className="page-shell">
      <div className="page-hero">
        <p className="page-kicker">MLOps Dashboard</p>
        <h1>Manufacturing AI Studio</h1>
        <p className="page-subtitle">
          데이터 업로드부터 실시간 관제까지 이어지는 제조 AI 운영 워크플로를 한 화면에서 관리합니다.
        </p>
      </div>

      <div className="quick-grid">
        {quickLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="quick-card"
          >
            <strong className="quick-card-title">{item.label}</strong>
            <span className="quick-card-desc">{item.desc}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
