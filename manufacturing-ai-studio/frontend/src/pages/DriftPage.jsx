import { useState } from 'react'
import { checkDrift, getDriftStatus, listAlerts } from '../api/drift.api'
import { KO } from '../constants/korean'

export default function DriftPage() {
  const [modelId, setModelId] = useState('')
  const [status, setStatus] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [error, setError] = useState('')

  async function runCheck() {
    if (!modelId) return
    try {
      const checked = await checkDrift(modelId)
      setStatus(checked)
      const list = await listAlerts(modelId)
      setAlerts(list.alerts || [])
      setError('')
    } catch (e) {
      setError(e?.response?.data?.detail || '드리프트 점검 실패')
    }
  }

  async function loadStatus() {
    if (!modelId) return
    const s = await getDriftStatus(modelId)
    setStatus(s)
  }

  return (
    <section style={{ textAlign: 'left' }}>
      <h1>{KO.drift.title}</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="model id" />
        <button type="button" onClick={loadStatus}>상태 조회</button>
        <button type="button" onClick={runCheck}>지금 점검</button>
      </div>

      {status && (
        <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
          <p><strong>drift_score:</strong> {status.drift_score}</p>
          <p><strong>level:</strong> {status.level}</p>
          <p><strong>message:</strong> {status.message}</p>
          <p><strong>{KO.drift.lastChecked}:</strong> {status.last_checked || '-'}</p>
        </div>
      )}

      {alerts.length > 0 && (
        <ul>
          {alerts.map((a) => <li key={a.id}>{a.created_at} - {a.level} - {a.message}</li>)}
        </ul>
      )}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
    </section>
  )
}
