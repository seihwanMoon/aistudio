import { Link } from 'react-router-dom'

export default function ModelsPage() {
  return (
    <section style={{ textAlign: 'left' }}>
      <h1>모델 관리</h1>
      <ul>
        <li><Link to="/model-history">모델 히스토리</Link></li>
        <li><Link to="/registry">모델 레지스트리</Link></li>
        <li><Link to="/drift">드리프트 모니터링</Link></li>
      </ul>
    </section>
  )
}
