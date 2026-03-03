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
    <section className="page-shell">
      <div className="page-hero">
        <p className="page-kicker">Training Summary</p>
        <h1>{KO.results.title}</h1>
        <p className="page-subtitle">모델 성능과 EDA/XAI 핵심 결과를 한 번에 확인할 수 있습니다.</p>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">{KO.results.bestModel}</div>
          <div className="metric-value sm">{result.model_name || 'N/A'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">{result.metric_name}</div>
          <div className="metric-value sm">{result.metric_value?.toFixed?.(4) ?? 'N/A'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">{KO.results.trainingTime}</div>
          <div className="metric-value sm">{result.training_time ? `${result.training_time.toFixed(2)}초` : 'N/A'}</div>
        </div>
      </div>

      <div className="section-card">
        <h3>EDA 개선사항 요약</h3>
        {edaSummary ? (
          <>
            <p className="section-card-subtitle">
              품질점수 {edaSummary.quality_score} / 결측비율 {(Number(edaSummary.missing_overall_ratio || 0) * 100).toFixed(2)}% /
              중복비율 {(Number(edaSummary.duplicate_ratio || 0) * 100).toFixed(2)}%
            </p>
            {(edaSummary.warnings || []).length > 0 ? (
              <ul>
                {(edaSummary.warnings || []).slice(0, 5).map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="notice success">주요 품질 경고가 없습니다.</p>
            )}
          </>
        ) : (
          <p className="helper-text">EDA 요약 데이터가 없습니다.</p>
        )}
        {edaSummaryError && <p className="notice warn">{edaSummaryError}</p>}
      </div>

      {Array.isArray(result.confusion_matrix) && result.confusion_matrix.length > 0 && (
        <div className="section-card">
          <h3>혼동행렬</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                {result.confusion_matrix.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <td key={`${rowIdx}-${cellIdx}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="section-card">
        <h3>{KO.results.topFeatures}</h3>
        <div ref={chartContainerRef} className="chart-frame">
          {chartWidth > 0 ? (
            <BarChart width={chartWidth} height={260} data={featureData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" />
            </BarChart>
          ) : (
            <div className="chart-empty" />
          )}
        </div>
      </div>

      <div className="section-card">
        <h3>XAI Global SHAP Top Features</h3>
        {globalXaiError && <p className="notice error">{globalXaiError}</p>}
        {globalXai && (
          <p className="section-card-subtitle">
            샘플 {globalXai.sample_size}건 기준 / 참조 파일: {globalXai.reference?.source_file_name || globalXai.reference?.source_file || '-'}
          </p>
        )}
        <div ref={globalChartRef} className="chart-frame" style={{ minHeight: 280 }}>
          {globalChartWidth > 0 && globalXaiData.length > 0 ? (
            <BarChart width={globalChartWidth} height={280} data={globalXaiData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#0891b2" />
            </BarChart>
          ) : (
            <div className="chart-empty" style={{ minHeight: 280 }}>
              {globalXaiError ? 'XAI 결과를 확인해 주세요.' : 'XAI 데이터를 불러오는 중입니다.'}
            </div>
          )}
        </div>
      </div>

      <div className="section-card">
        <h3>XAI Partial Dependence</h3>
        <div className="pill-row">
          {globalXaiData.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSelectedPdpFeature(item.name)}
              className={selectedPdpFeature === item.name ? 'pill-button is-active' : 'pill-button'}
            >
              {item.name}
            </button>
          ))}
        </div>
        {pdpError && <p className="notice error">{pdpError}</p>}
        <div ref={pdpChartRef} className="chart-frame">
          {pdpChartWidth > 0 && pdpData.length > 0 ? (
            <LineChart width={pdpChartWidth} height={260} data={pdpData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" tickFormatter={(value) => Number(value).toFixed(1)} />
              <YAxis />
              <Tooltip formatter={(value) => Number(value).toFixed(4)} />
              <Line type="monotone" dataKey="y" stroke="#0ea5e9" dot={false} />
            </LineChart>
          ) : (
            <div className="chart-empty">
              {isPdpLoading ? 'PDP 계산 중...' : 'PDP 데이터를 선택해 주세요.'}
            </div>
          )}
        </div>
      </div>

      <div className="page-actions">
        <button type="button" onClick={handleDownloadReport}>{KO.results.downloadReport}</button>
        <button type="button" onClick={() => navigate('/predict')}>{KO.results.startPrediction}</button>
      </div>

      {errorMessage && <p className="notice error">{errorMessage}</p>}
    </section>
  )
}
