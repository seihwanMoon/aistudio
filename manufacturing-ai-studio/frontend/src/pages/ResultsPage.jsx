import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { getEdaSummary } from '../api/eda.api'
import { getTrainingResults } from '../api/train.api'
import { downloadReport } from '../api/report.api'
import { getGlobalXai, getPdp } from '../api/xai.api'
import { KO } from '../constants/korean'
import { useAppStore } from '../store/useAppStore'

export default function ResultsPage() {
  const navigate = useNavigate()
  const trainedModelId = useAppStore((state) => state.trainedModelId)
  const trainingResult = useAppStore((state) => state.trainingResult)
  const uploadedFile = useAppStore((state) => state.uploadedFile)
  const [result, setResult] = useState(trainingResult)
  const [edaSummary, setEdaSummary] = useState(null)
  const [edaSummaryError, setEdaSummaryError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const chartContainerRef = useRef(null)
  const [chartWidth, setChartWidth] = useState(0)
  const globalChartRef = useRef(null)
  const [globalChartWidth, setGlobalChartWidth] = useState(0)
  const [globalXai, setGlobalXai] = useState(null)
  const [globalXaiError, setGlobalXaiError] = useState('')
  const [selectedPdpFeature, setSelectedPdpFeature] = useState('')
  const [pdpData, setPdpData] = useState([])
  const [pdpError, setPdpError] = useState('')
  const [isPdpLoading, setIsPdpLoading] = useState(false)
  const pdpChartRef = useRef(null)
  const [pdpChartWidth, setPdpChartWidth] = useState(0)

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
    async function loadGlobalXai() {
      if (!trainedModelId) return
      try {
        const data = await getGlobalXai(trainedModelId, { top_n: 10, sample_size: 1000 })
        setGlobalXai(data)
        setGlobalXaiError('')
        const first = data?.top_features?.[0]?.feature
        if (first) {
          setSelectedPdpFeature(first)
        }
      } catch (error) {
        setGlobalXai(null)
        setSelectedPdpFeature('')
        setPdpData([])
        setGlobalXaiError(error?.response?.data?.detail || 'XAI 결과를 불러오지 못했습니다.')
      }
    }
    loadGlobalXai()
  }, [trainedModelId])

  useEffect(() => {
    async function loadEdaSummary() {
      const fileId = result?.file_id || uploadedFile?.file_id
      if (!fileId) return
      try {
        const summary = await getEdaSummary(fileId)
        setEdaSummary(summary)
        setEdaSummaryError('')
      } catch (error) {
        setEdaSummary(null)
        setEdaSummaryError(error?.response?.data?.detail || 'EDA 요약을 불러오지 못했습니다.')
      }
    }
    loadEdaSummary()
  }, [result?.file_id, uploadedFile?.file_id])

  useEffect(() => {
    async function loadPdp() {
      if (!trainedModelId || !selectedPdpFeature) return
      setIsPdpLoading(true)
      try {
        const data = await getPdp({
          model_id: trainedModelId,
          feature_name: selectedPdpFeature,
          grid_points: 20,
        })
        setPdpData((data?.points || []).map((point) => ({ x: point.x, y: point.y })))
        setPdpError('')
      } catch (error) {
        setPdpData([])
        setPdpError(error?.response?.data?.detail || 'PDP를 불러오지 못했습니다.')
      } finally {
        setIsPdpLoading(false)
      }
    }
    loadPdp()
  }, [trainedModelId, selectedPdpFeature])

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

  useEffect(() => {
    const element = globalChartRef.current
    if (!element) return

    const updateWidth = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width)
      setGlobalChartWidth(nextWidth > 0 ? nextWidth : 0)
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = pdpChartRef.current
    if (!element) return
    const updateWidth = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width)
      setPdpChartWidth(nextWidth > 0 ? nextWidth : 0)
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
  const globalXaiData = (globalXai?.top_features || []).map((item) => ({
    name: item.feature,
    value: item.mean_abs_shap,
  }))

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

      <div style={{ marginTop: 20, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        <h3>EDA 개선사항 요약</h3>
        {edaSummary ? (
          <>
            <p style={{ margin: 0, color: '#4b5563' }}>
              품질점수 {edaSummary.quality_score} / 결측비율 {(Number(edaSummary.missing_overall_ratio || 0) * 100).toFixed(2)}% /
              중복비율 {(Number(edaSummary.duplicate_ratio || 0) * 100).toFixed(2)}%
            </p>
            {(edaSummary.warnings || []).length > 0 ? (
              <ul style={{ marginTop: 8 }}>
                {(edaSummary.warnings || []).slice(0, 5).map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p style={{ marginTop: 8, color: '#166534' }}>주요 품질 경고가 없습니다.</p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, color: '#6b7280' }}>EDA 요약 데이터가 없습니다.</p>
        )}
        {edaSummaryError && <p style={{ color: '#b45309', marginTop: 8 }}>{edaSummaryError}</p>}
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

      <div style={{ marginTop: 20, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        <h3>XAI Global SHAP Top Features</h3>
        {globalXaiError && <p style={{ color: '#dc2626' }}>{globalXaiError}</p>}
        {globalXai && (
          <p style={{ color: '#4b5563', marginTop: 4 }}>
            샘플 {globalXai.sample_size}건 기준 / 참조 파일: {globalXai.reference?.source_file || '-'}
          </p>
        )}
        <div ref={globalChartRef} style={{ width: '100%', minHeight: 280 }}>
          {globalChartWidth > 0 && globalXaiData.length > 0 ? (
            <BarChart width={globalChartWidth} height={280} data={globalXaiData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#0891b2" />
            </BarChart>
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', color: '#6b7280' }}>
              {globalXaiError ? 'XAI 결과를 확인해 주세요.' : 'XAI 데이터를 불러오는 중입니다.'}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        <h3>XAI Partial Dependence</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {globalXaiData.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSelectedPdpFeature(item.name)}
              style={{
                border: selectedPdpFeature === item.name ? '1px solid #0ea5e9' : '1px solid #d1d5db',
                backgroundColor: selectedPdpFeature === item.name ? '#e0f2fe' : '#fff',
                borderRadius: 999,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        {pdpError && <p style={{ color: '#dc2626' }}>{pdpError}</p>}
        <div ref={pdpChartRef} style={{ width: '100%', minHeight: 260 }}>
          {pdpChartWidth > 0 && pdpData.length > 0 ? (
            <LineChart width={pdpChartWidth} height={260} data={pdpData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" tickFormatter={(value) => Number(value).toFixed(1)} />
              <YAxis />
              <Tooltip formatter={(value) => Number(value).toFixed(4)} />
              <Line type="monotone" dataKey="y" stroke="#0ea5e9" dot={false} />
            </LineChart>
          ) : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', color: '#6b7280' }}>
              {isPdpLoading ? 'PDP 계산 중...' : 'PDP 데이터를 선택해 주세요.'}
            </div>
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
