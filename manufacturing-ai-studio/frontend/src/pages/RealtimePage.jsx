import { useState } from 'react'
import PredictionHeatmap from '../components/charts/PredictionHeatmap'
import RealtimeChart from '../components/charts/RealtimeChart'
import { startWatcher, stopWatcher, getWatcherStatus } from '../api/watcher.api'
import { useRealtimePredictions } from '../hooks/useRealtimePredictions'

export default function RealtimePage() {
  const { predictions, latestBatch, alerts, isConnected } = useRealtimePredictions()
  const [selected, setSelected] = useState(null)
  const [watcher, setWatcher] = useState({ watch_dir: '/tmp', model_id: 1, threshold: 0.7 })
  const [watcherId, setWatcherId] = useState('')
  const [watchStatus, setWatchStatus] = useState({})

  async function handleStartWatch() {
    const data = await startWatcher({ ...watcher, model_id: Number(watcher.model_id), threshold: Number(watcher.threshold) })
    setWatcherId(data.watcher_id)
  }

  async function handleStopWatch() {
    if (!watcherId) return
    await stopWatcher(watcherId)
    setWatcherId('')
  }

  async function handleRefreshWatch() {
    const data = await getWatcherStatus()
    setWatchStatus(data.watchers || {})
  }

  return (
    <section style={{ textAlign: 'left' }}>
      <h1>실시간 모니터링</h1>
      <p>연결 상태: {isConnected ? '🟢 연결됨' : '🔴 끊김'}</p>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff', marginBottom: 12 }}>
        <h3>감시 서비스 제어</h3>
        <input placeholder="watch dir" value={watcher.watch_dir} onChange={(e) => setWatcher({ ...watcher, watch_dir: e.target.value })} />
        <input placeholder="model id" value={watcher.model_id} onChange={(e) => setWatcher({ ...watcher, model_id: e.target.value })} style={{ marginLeft: 8 }} />
        <input placeholder="threshold" value={watcher.threshold} onChange={(e) => setWatcher({ ...watcher, threshold: e.target.value })} style={{ marginLeft: 8 }} />
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={handleStartWatch}>감시 시작</button>
          <button type="button" onClick={handleStopWatch} style={{ marginLeft: 8 }}>감시 중지</button>
          <button type="button" onClick={handleRefreshWatch} style={{ marginLeft: 8 }}>상태 확인</button>
        </div>
        <p>활성 watcher_id: {watcherId || '-'}</p>
        <pre>{JSON.stringify(watchStatus, null, 2)}</pre>
      </div>

      {latestBatch && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff', marginBottom: 12 }}>
          <p>최근 파일: {latestBatch.file}</p>
          <p>총 건수: {latestBatch.total} / 고위험: {latestBatch.high_risk_count}</p>
        </div>
      )}

      <RealtimeChart predictions={predictions} />

      <h3 style={{ marginTop: 14 }}>예측 히트맵</h3>
      <PredictionHeatmap predictions={predictions} />

      <h3 style={{ marginTop: 14 }}>알림 타임라인</h3>
      <ul>
        {alerts.map((a, idx) => (
          <li key={idx}>{a.timestamp} - {a.file} - 위험 {a.high_risk_count}건</li>
        ))}
      </ul>

      <h3 style={{ marginTop: 14 }}>최근 예측 (클릭 시 상세)</h3>
      <ul>
        {predictions.slice(0, 20).map((p, idx) => (
          <li key={idx}>
            <button type="button" onClick={() => setSelected(p)} style={{ border: 'none', background: 'transparent', color: '#2563eb', padding: 0 }}>
              idx {idx} / pred={p.prediction} / prob={p.probability ?? 0}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div style={{ border: '1px solid #d1d5db', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
          <h4>이상 구간 드릴다운</h4>
          <p>예측값: {selected.prediction}</p>
          <p>확률: {selected.probability ?? 0}</p>
          <h5>SHAP 로컬 설명(근사)</h5>
          <ul>
            {Object.entries(selected.input || {}).map(([k, v]) => (
              <li key={k}>{k}: {String(v)}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setSelected(null)}>닫기</button>
        </div>
      )}
    </section>
  )
}
