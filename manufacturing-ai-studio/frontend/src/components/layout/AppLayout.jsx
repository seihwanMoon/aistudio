import { Link, Outlet } from 'react-router-dom'
import { KO } from '../../constants/korean'

const navItems = [
  ['/', KO.nav.home],
  ['/upload', KO.nav.upload],
  ['/train', KO.nav.train],
  ['/predict', KO.nav.predict],
  ['/models', KO.nav.models],
]

export default function AppLayout() {
  return (
    <div style={{ fontFamily: 'Malgun Gothic, Apple SD Gothic Neo, sans-serif', minHeight: '100vh' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
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
