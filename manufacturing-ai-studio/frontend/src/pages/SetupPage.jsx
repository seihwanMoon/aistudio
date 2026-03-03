import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KO } from '../constants/korean'
import { getDataPreview } from '../api/data.api'
import { getEdaSummary } from '../api/eda.api'
import EdaOverview from '../components/data/EdaOverview'
import { useAppStore } from '../store/useAppStore'

function detectTaskType(dtype) {
  if (!dtype) return 'classification'
  const lowered = dtype.toLowerCase()
  return ['int', 'float', 'double', 'decimal'].some((token) => lowered.includes(token))
    ? 'regression'
    : 'classification'
}

export default function SetupPage() {
  const navigate = useNavigate()
  const uploadedFile = useAppStore((state) => state.uploadedFile)
  const targetColumn = useAppStore((state) => state.targetColumn)
  const featureColumns = useAppStore((state) => state.featureColumns)
  const setTargetColumn = useAppStore((state) => state.setTargetColumn)
  const setFeatureColumns = useAppStore((state) => state.setFeatureColumns)
  const setTaskType = useAppStore((state) => state.setTaskType)

  const [columns, setColumns] = useState([])
  const [dtypes, setDtypes] = useState({})
  const [edaSummary, setEdaSummary] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadPreview() {
      if (!uploadedFile?.file_id) return
      try {
        const preview = await getDataPreview(uploadedFile.file_id)
        setColumns(preview.columns || [])
        setDtypes(preview.dtypes || {})
        try {
          const summary = await getEdaSummary(uploadedFile.file_id)
          setEdaSummary(summary)
        } catch {
          setEdaSummary(null)
        }
        if (!targetColumn && preview.columns?.length) {
          setTargetColumn(preview.columns[preview.columns.length - 1])
        }
      } catch (error) {
        setErrorMessage(error?.response?.data?.detail || '업로드 데이터를 불러오지 못했습니다.')
      }
    }
    loadPreview()
  }, [uploadedFile?.file_id, targetColumn, setTargetColumn])

  const taskType = useMemo(() => detectTaskType(dtypes[targetColumn]), [dtypes, targetColumn])
  const featureOptions = useMemo(() => columns.filter((col) => col !== targetColumn), [columns, targetColumn])

  function handleTargetChange(nextTarget) {
    setTargetColumn(nextTarget)
    setFeatureColumns((prev) => prev.filter((column) => column !== nextTarget))
  }

  function toggleFeature(column) {
    if (featureColumns.includes(column)) {
      setFeatureColumns(featureColumns.filter((c) => c !== column))
    } else {
      setFeatureColumns([...featureColumns, column])
    }
  }

  function goTraining() {
    if (!targetColumn || !featureColumns.length) {
      setErrorMessage('타겟 1개와 피처 1개 이상을 선택해 주세요.')
      return
    }
    setTaskType(taskType)
    navigate('/training')
  }

  if (!uploadedFile?.file_id) {
    return (
      <section className="page-shell compact">
        <h1>{KO.setup.title}</h1>
        <p>먼저 업로드를 진행해 주세요.</p>
        <Link to="/upload">업로드로 이동</Link>
      </section>
    )
  }

  return (
    <section className="page-shell compact">
      <div className="page-hero">
        <p className="page-kicker">Model Configuration</p>
        <h1>{KO.setup.title}</h1>
        <p className="page-subtitle">{KO.setup.featureHint}</p>
      </div>

      <div className="section-card soft">
        <label style={{ display: 'block', fontWeight: 700 }}>{KO.setup.targetLabel}</label>
      <select
        value={targetColumn}
        onChange={(e) => handleTargetChange(e.target.value)}
          style={{ width: '100%', maxWidth: 420, marginTop: 8 }}
      >
        <option value="">{KO.setup.targetPlaceholder}</option>
        {columns.map((col) => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>

      {targetColumn && (
          <p>
            <span className="badge info">
          {KO.setup.autoDetected}: {taskType === 'classification' ? KO.setup.taskType.classification : KO.setup.taskType.regression}
            </span>
        </p>
      )}

      <h3>{KO.setup.featureLabel}</h3>
        <div className="feature-grid">
        {featureOptions.map((col) => (
            <label key={col} className="feature-option">
            <input type="checkbox" checked={featureColumns.includes(col)} onChange={() => toggleFeature(col)} /> {col}
              <small>{dtypes[col]}</small>
          </label>
        ))}
      </div>

        <button type="button" onClick={goTraining} style={{ marginTop: 16 }}>학습 시작 화면으로 이동</button>
        {errorMessage && <p className="notice error">{errorMessage}</p>}
      </div>

      <div className="section-card">
        <h3 style={{ marginBottom: 8 }}>EDA 개선사항 요약</h3>
        <p className="section-card-subtitle">
          업로드 페이지에서 전체 EDA를 확인할 수 있으며, 여기서는 핵심 품질 지표를 요약 표시합니다.
        </p>
        <EdaOverview summary={edaSummary} />
        {!edaSummary && <p className="helper-text">EDA 요약을 불러오지 못했습니다. 업로드 페이지에서 다시 확인해 주세요.</p>}
      </div>
    </section>
  )
}
