import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../api/auth.api'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [form, setForm] = useState({ username: 'admin', password: 'admin123' })
  const [registerRole, setRegisterRole] = useState('admin')
  const [error, setError] = useState('')

  async function handleLogin() {
    try {
      const data = await login(form)
      setAuth({ token: data.access_token, role: data.role, username: data.username })
      navigate('/')
    } catch (e) {
      setError(e?.response?.data?.detail || '로그인 실패')
    }
  }

  async function handleRegister() {
    try {
      await register({ ...form, role: registerRole })
      await handleLogin()
    } catch (e) {
      setError(e?.response?.data?.detail || '회원가입 실패')
    }
  }

  return (
    <section className="form-shell page-shell">
      <div className="form-card">
        <p className="page-kicker">Secure Access</p>
        <h1>로그인</h1>
        <p className="page-subtitle">계정 인증 후 메뉴 권한에 맞는 기능이 노출됩니다.</p>

        <div className="field-stack">
          <input
            placeholder="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            placeholder="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <div className="form-inline">
          <label>가입 역할</label>
          <select value={registerRole} onChange={(e) => setRegisterRole(e.target.value)}>
            <option value="admin">admin</option>
            <option value="operator">operator</option>
            <option value="viewer">viewer</option>
          </select>
        </div>

        <div className="form-row">
          <button type="button" onClick={handleLogin}>로그인</button>
          <button type="button" onClick={handleRegister}>회원가입(초기)</button>
        </div>

        {error && <p className="notice error">{error}</p>}
      </div>
    </section>
  )
}
