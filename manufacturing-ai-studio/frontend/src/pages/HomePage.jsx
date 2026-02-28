import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <section style={{ textAlign: 'left' }}>
      <h1>Manufacturing AI Studio</h1>
      <p>Phase 1 MVP 학습/예측/리포트 흐름을 순서대로 진행하세요.</p>
      <ol>
        <li><Link to="/upload">데이터 업로드</Link></li>
        <li><Link to="/setup">학습 설정</Link></li>
        <li><Link to="/training">학습 실행</Link></li>
        <li><Link to="/results">결과 확인</Link></li>
      </ol>
    </section>
  )
}
