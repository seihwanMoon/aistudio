import { useEffect, useState } from 'react'
import { getAlertLogs, getAlertSettings, sendAlertTest, updateAlertSettings } from '../api/alerts.api'

export default function AlertSettingsPage() {
  const [settings, setSettings] = useState({
    threshold: 0.7,
    email: 'qa@example.com',
    phone: '010-0000-0000',
    enable_email: true,
    enable_kakao: true,
  })
  const [logs, setLogs] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    try {
      const [nextSettings, nextLogs] = await Promise.all([
        getAlertSettings(),
        getAlertLogs({ limit: 20 }),
      ])
      setSettings(nextSettings)
      setLogs(nextLogs?.logs || [])
    } catch (e) {
      setError(e?.response?.data?.detail || '알림 설정을 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSave() {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const saved = await updateAlertSettings(settings)
      setSettings(saved)
      setMessage('저장되었습니다.')
    } catch (e) {
      setError(e?.response?.data?.detail || '저장 실패')
    } finally {
      setLoading(false)
    }
  }

  async function handleTest(channel) {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await sendAlertTest({ channel })
      setMessage(`테스트 알림(${channel})을 전송했습니다.`)
      const nextLogs = await getAlertLogs({ limit: 20 })
      setLogs(nextLogs?.logs || [])
    } catch (e) {
      setError(e?.response?.data?.detail || '테스트 알림 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section style={{ textAlign: 'left', maxWidth: 840 }}>
      <h1>알림 설정</h1>

      <label>임계값: {Number(settings.threshold || 0).toFixed(2)}</label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={settings.threshold}
        onChange={(e) => setSettings((prev) => ({ ...prev, threshold: Number(e.target.value) }))}
        style={{ width: '100%' }}
      />

      <div style={{ marginTop: 8 }}>
        <label>수신 이메일</label>
        <input
          value={settings.email}
          onChange={(e) => setSettings((prev) => ({ ...prev, email: e.target.value }))}
          style={{ marginLeft: 8, minWidth: 260 }}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <label>카카오 수신번호</label>
        <input
          value={settings.phone}
          onChange={(e) => setSettings((prev) => ({ ...prev, phone: e.target.value }))}
          style={{ marginLeft: 8, minWidth: 260 }}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={settings.enable_email}
            onChange={(e) => setSettings((prev) => ({ ...prev, enable_email: e.target.checked }))}
          />
          {' '}
          이메일 알림 사용
        </label>
      </div>
      <div style={{ marginTop: 4 }}>
        <label>
          <input
            type="checkbox"
            checked={settings.enable_kakao}
            onChange={(e) => setSettings((prev) => ({ ...prev, enable_kakao: e.target.checked }))}
          />
          {' '}
          카카오 알림 사용
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={handleSave} disabled={loading}>저장</button>
        <button type="button" onClick={() => handleTest('both')} disabled={loading}>테스트(둘다)</button>
        <button type="button" onClick={() => handleTest('email')} disabled={loading}>테스트(이메일)</button>
        <button type="button" onClick={() => handleTest('kakao')} disabled={loading}>테스트(카카오)</button>
      </div>

      {message && <p style={{ color: '#15803d' }}>{message}</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      <div style={{ marginTop: 14, border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, backgroundColor: '#fff' }}>
        <strong>최근 알림 로그</strong>
        <ul style={{ marginTop: 8 }}>
          {logs.map((log, idx) => (
            <li key={idx} style={{ marginBottom: 6, fontSize: 13 }}>
              {JSON.stringify(log)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
