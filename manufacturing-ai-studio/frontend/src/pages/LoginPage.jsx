import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../api/auth.api'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [form, setForm] = useState({ username: 'admin', password: 'admin123' })
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
      await register({ ...form, role: 'admin' })
      await handleLogin()
    } catch (e) {
      setError(e?.response?.data?.detail || '회원가입 실패')
    }
  }

  return (
    <section style={{ maxWidth: 420, margin: '40px auto', textAlign: 'left' }}>
      <h1>로그인</h1>
      <input placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={{ width: '100%', marginBottom: 8 }} />
      <input placeholder="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ width: '100%', marginBottom: 8 }} />
      <button type="button" onClick={handleLogin}>로그인</button>
      <button type="button" onClick={handleRegister} style={{ marginLeft: 8 }}>회원가입(초기)</button>
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
    </section>
  )
}
