import { useEffect, useState } from 'react'
import { changeModelStage, listRegistry, registerModel } from '../api/registry.api'

export default function RegistryPage() {
  const [models, setModels] = useState([])
  const [form, setForm] = useState({ model_name: '', run_id: '' })
  const [error, setError] = useState('')

  async function refresh() {
    try {
      const data = await listRegistry()
      setModels(data.models || [])
    } catch (e) {
      setError(e?.response?.data?.detail || '레지스트리 조회 실패')
    }
  }

  useEffect(() => {
    listRegistry()
      .then((data) => setModels(data.models || []))
      .catch((e) => setError(e?.response?.data?.detail || '레지스트리 조회 실패'))
  }, [])

  async function onRegister() {
    try {
      await registerModel(form)
      setForm({ model_name: '', run_id: '' })
      await refresh()
    } catch (e) {
      setError(e?.response?.data?.detail || '모델 등록 실패')
    }
  }

  async function promote(name) {
    await changeModelStage(name, 'Production')
    await refresh()
  }

  return (
    <section style={{ textAlign: 'left' }}>
      <h1>모델 레지스트리</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input placeholder="model name" value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} />
        <input placeholder="run id" value={form.run_id} onChange={(e) => setForm({ ...form, run_id: e.target.value })} />
        <button type="button" onClick={onRegister}>등록</button>
      </div>

      {models.map((m) => (
        <div key={m.name} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 10, backgroundColor: '#fff' }}>
          <strong>{m.name}</strong>
          <button type="button" onClick={() => promote(m.name)} style={{ marginLeft: 8 }}>Production 승격</button>
          <pre>{JSON.stringify(m.versions, null, 2)}</pre>
        </div>
      ))}

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
    </section>
  )
}
