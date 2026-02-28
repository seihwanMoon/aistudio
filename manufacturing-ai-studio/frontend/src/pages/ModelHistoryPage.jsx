import { useEffect, useState } from 'react'
import { compareExperiments, listExperiments } from '../api/experiments.api'

export default function ModelHistoryPage() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState([])
  const [comparison, setComparison] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    listExperiments()
      .then((data) => setItems(data.experiments || []))
      .catch((e) => setError(e?.response?.data?.detail || '실험 목록 조회 실패'))
  }, [])

  async function runCompare() {
    if (selected.length < 2) {
      setError('비교하려면 2개 이상의 run_id를 선택하세요.')
      return
    }
    const data = await compareExperiments(selected)
    setComparison(data.compared || [])
  }

  return (
    <section style={{ textAlign: 'left' }}>
      <h1>모델 히스토리</h1>
      <p>최근 실험/런을 확인하고 비교할 수 있습니다.</p>
      <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        {items.map((item) => (
          <label key={item.run_id} style={{ display: 'block', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={selected.includes(item.run_id)}
              onChange={(e) => {
                if (e.target.checked) setSelected([...selected, item.run_id])
                else setSelected(selected.filter((r) => r !== item.run_id))
              }}
            />{' '}
            {item.experiment_name} / {item.run_id} / {item.status}
          </label>
        ))}
        <button type="button" onClick={runCompare}>선택 실험 비교</button>
      </div>

      {comparison.length > 0 && (
        <pre style={{ marginTop: 12, background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 10 }}>
          {JSON.stringify(comparison, null, 2)}
        </pre>
      )}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
    </section>
  )
}
