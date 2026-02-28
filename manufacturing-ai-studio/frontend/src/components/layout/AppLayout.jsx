import { Link, Outlet, useNavigate } from 'react-router-dom'
import { KO } from '../../constants/korean'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  ['/', KO.nav.home],
  ['/upload', KO.nav.upload],
  ['/setup', '학습 설정'],
  ['/training', KO.nav.train],
  ['/results', '학습 결과'],
  ['/predict', KO.nav.predict],
  ['/model-history', '히스토리'],
  ['/registry', '레지스트리'],
  ['/drift', KO.nav.drift],
  ['/realtime', KO.nav.realtime],
  ['/alerts', KO.nav.alerts],
]

const mobileTabs = [
  ['/', KO.nav.home],
  ['/realtime', KO.nav.realtime],
  ['/drift', KO.nav.drift],
  ['/alerts', KO.nav.alerts],
]

export default function AppLayout() {
  const navigate = useNavigate()
  const { username, role, logout } = useAuth()

  return (
    <div style={{ fontFamily: 'Malgun Gothic, Apple SD Gothic Neo, sans-serif', minHeight: '100vh' }}>
      <header className="desktop-header" style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
        <strong>Manufacturing AI Studio</strong>
        <div style={{ float: 'right' }}>
          {username} ({role})
          <button type="button" onClick={() => { logout(); navigate('/login') }} style={{ marginLeft: 8 }}>로그아웃</button>
        </div>
        <nav style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {navItems.map(([to, label]) => (
            <Link key={to} to={to}>{label}</Link>
          ))}
        </nav>
      </header>
      <main className="app-main" style={{ padding: 16 }}>
        <Outlet />
      </main>
      <footer className="mobile-tabbar">
        {mobileTabs.map(([to, label]) => (
          <Link key={to} to={to}>{label}</Link>
        ))}
      </footer>
    </div>
  )
}
