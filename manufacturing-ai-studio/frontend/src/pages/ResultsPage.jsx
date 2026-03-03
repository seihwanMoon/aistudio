import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { getTrainingResults } from '../api/train.api'
import { downloadReport } from '../api/report.api'
import { KO } from '../constants/korean'
import { useAppStore } from '../store/useAppStore'

export default function ResultsPage() {
  const navigate = useNavigate()
  const trainedModelId = useAppStore((state) => state.trainedModelId)
  const trainingResult = useAppStore((state) => state.trainingResult)
  const [result, setResult] = useState(trainingResult)
  const [errorMessage, setErrorMessage] = useState('')
  const chartContainerRef = useRef(null)
  const [chartWidth, setChartWidth] = useState(0)

  useEffect(() => {
    async function loadResult() {
      if (!trainedModelId) return
      try {
        const data = await getTrainingResults(trainedModelId)
        setResult((prev) => ({ ...prev, ...data }))
      } catch (error) {
        setErrorMessage(error?.response?.data?.detail || '결과를 불러오지 못했습니다.')
      }
    }
    loadResult()
  }, [trainedModelId])

  useEffect(() => {
    const element = chartContainerRef.current
    if (!element) return

    const updateWidth = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width)
      setChartWidth(nextWidth > 0 ? nextWidth : 0)
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  if (!result) {
    return <p>아직 학습 결과가 없습니다.</p>
  }

  const featureData = Object.entries(result.feature_importance || {}).map(([name, value]) => ({ name, value }))

  async function handleDownloadReport() {
    if (!trainedModelId) return
    const blob = await downloadReport(trainedModelId)
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `report_${trainedModelId}.pdf`
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <section style={{ textAlign: 'left' }}>
      <h1>{KO.results.title}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginTop: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
          <p>{KO.results.bestModel}</p>
          <strong>{result.model_name || 'N/A'}</strong>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
          <p>{result.metric_name}</p>
          <strong>{result.metric_value?.toFixed?.(4) ?? 'N/A'}</strong>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
          <p>{KO.results.trainingTime}</p>
          <strong>{result.training_time ? `${result.training_time.toFixed(2)}초` : 'N/A'}</strong>
        </div>
      </div>

      {Array.isArray(result.confusion_matrix) && result.confusion_matrix.length > 0 && (
        <div style={{ marginTop: 20, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
          <h3>혼동행렬</h3>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {result.confusion_matrix.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td key={`${rowIdx}-${cellIdx}`} style={{ border: '1px solid #d1d5db', padding: '6px 10px' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 20, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        <h3>{KO.results.topFeatures}</h3>
        <div ref={chartContainerRef} style={{ width: '100%', minHeight: 260 }}>
          {chartWidth > 0 ? (
            <BarChart width={chartWidth} height={260} data={featureData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" />
            </BarChart>
          ) : (
            <div style={{ height: 260 }} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button type="button" onClick={handleDownloadReport}>{KO.results.downloadReport}</button>
        <button type="button" onClick={() => navigate('/predict')}>{KO.results.startPrediction}</button>
      </div>

      {errorMessage && <p style={{ color: '#dc2626' }}>{errorMessage}</p>}
    </section>
  )
}
