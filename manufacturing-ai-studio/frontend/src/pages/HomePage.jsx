import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <section style={{ textAlign: 'left' }}>
      <h1>Manufacturing AI Studio</h1>
      <p>Phase 3 현장 연동까지 포함된 전체 운영 흐름입니다.</p>
      <ol>
        <li><Link to="/upload">데이터 업로드</Link></li>
        <li><Link to="/setup">학습 설정</Link></li>
        <li><Link to="/training">학습 실행</Link></li>
        <li><Link to="/results">결과 확인</Link></li>
        <li><Link to="/drift">성능 모니터링</Link></li>
        <li><Link to="/realtime">실시간 관제</Link></li>
      </ol>
    </section>
  )
}
