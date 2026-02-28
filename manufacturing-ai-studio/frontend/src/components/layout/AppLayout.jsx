import { Link, Outlet } from 'react-router-dom'
import { KO } from '../../constants/korean'

const navItems = [
  ['/', KO.nav.home],
  ['/upload', KO.nav.upload],
  ['/setup', '학습 설정'],
  ['/training', KO.nav.train],
  ['/results', '학습 결과'],
  ['/predict', KO.nav.predict],
  ['/model-history', '모델 히스토리'],
  ['/registry', '레지스트리'],
  ['/drift', KO.nav.drift],
]

export default function AppLayout() {
  return (
    <div style={{ fontFamily: 'Malgun Gothic, Apple SD Gothic Neo, sans-serif', minHeight: '100vh' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
        <strong>Manufacturing AI Studio</strong>
        <nav style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {navItems.map(([to, label]) => (
            <Link key={to} to={to}>{label}</Link>
          ))}
        </nav>
      </header>
      <main style={{ padding: 16 }}>
        <Outlet />
      </main>
    </div>
  )
}
