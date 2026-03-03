import { Link, Outlet, useNavigate } from 'react-router-dom'
import { KO } from '../../constants/korean'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { to: '/', label: KO.nav.home, roles: ['admin', 'operator', 'viewer'] },
  { to: '/upload', label: KO.nav.upload, roles: ['admin', 'operator'] },
  { to: '/setup', label: '학습 설정', roles: ['admin', 'operator'] },
  { to: '/training', label: KO.nav.train, roles: ['admin', 'operator'] },
  { to: '/results', label: '학습 결과', roles: ['admin', 'operator', 'viewer'] },
  { to: '/predict', label: KO.nav.predict, roles: ['admin', 'operator'] },
  { to: '/model-history', label: '히스토리', roles: ['admin', 'operator', 'viewer'] },
  { to: '/registry', label: '레지스트리', roles: ['admin'] },
  { to: '/drift', label: KO.nav.drift, roles: ['admin', 'operator'] },
  { to: '/realtime', label: KO.nav.realtime, roles: ['admin', 'operator'] },
  { to: '/alerts', label: KO.nav.alerts, roles: ['admin'] },
]

const mobileTabs = [
  { to: '/', label: KO.nav.home, roles: ['admin', 'operator', 'viewer'] },
  { to: '/realtime', label: KO.nav.realtime, roles: ['admin', 'operator'] },
  { to: '/drift', label: KO.nav.drift, roles: ['admin', 'operator'] },
  { to: '/alerts', label: KO.nav.alerts, roles: ['admin'] },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const { username, role, logout } = useAuth()
  const visibleNavItems = navItems.filter((item) => item.roles.includes(role))
  const visibleMobileTabs = mobileTabs.filter((item) => item.roles.includes(role))

  return (
    <div style={{ fontFamily: 'Malgun Gothic, Apple SD Gothic Neo, sans-serif', minHeight: '100vh' }}>
      <header className="desktop-header" style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
        <strong>Manufacturing AI Studio</strong>
        <div style={{ float: 'right' }}>
          {username} ({role || 'viewer'})
          <button type="button" onClick={() => { logout(); navigate('/login') }} style={{ marginLeft: 8 }}>로그아웃</button>
        </div>
        <nav style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {visibleNavItems.map(({ to, label }) => (
            <Link key={to} to={to}>{label}</Link>
          ))}
        </nav>
      </header>
      <main className="app-main" style={{ padding: 16 }}>
        <Outlet />
      </main>
      <footer className="mobile-tabbar">
        {visibleMobileTabs.map(({ to, label }) => (
          <Link key={to} to={to}>{label}</Link>
        ))}
      </footer>
    </div>
  )
}
