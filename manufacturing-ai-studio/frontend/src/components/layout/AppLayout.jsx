import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { KO } from '../../constants/korean'
import { useAuth } from '../../hooks/useAuth'
import './AppLayout.css'

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
  const safeRole = role || 'viewer'

  return (
    <div className="app-shell">
      <header className="app-header desktop-header">
        <div className="app-header-top">
          <div className="app-brand-wrap">
            <span className="app-brand-eyebrow">Factory Intelligence Platform</span>
            <strong className="app-brand-title">Manufacturing AI Studio</strong>
          </div>

          <div className="app-user-wrap">
            <span className="app-user-chip">
              {username || 'guest'} ({safeRole})
            </span>
            <button
              type="button"
              className="app-logout-btn"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              로그아웃
            </button>
          </div>
        </div>

        <nav className="app-nav">
          {visibleNavItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? 'app-nav-link is-active' : 'app-nav-link')}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="mobile-tabbar">
        {visibleMobileTabs.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? 'mobile-tab-link is-active' : 'mobile-tab-link')}
          >
            {label}
          </NavLink>
        ))}
      </footer>
    </div>
  )
}
