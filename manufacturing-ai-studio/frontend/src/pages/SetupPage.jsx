import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KO } from '../constants/korean'
import { getDataPreview } from '../api/data.api'
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
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadPreview() {
      if (!uploadedFile?.file_id) return
      try {
        const preview = await getDataPreview(uploadedFile.file_id)
        setColumns(preview.columns || [])
        setDtypes(preview.dtypes || {})
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
      <section style={{ textAlign: 'left' }}>
        <h1>{KO.setup.title}</h1>
        <p>먼저 업로드를 진행해 주세요.</p>
        <Link to="/upload">업로드로 이동</Link>
      </section>
    )
  }

  return (
    <section style={{ textAlign: 'left', maxWidth: 980, margin: '0 auto' }}>
      <h1>{KO.setup.title}</h1>
      <p style={{ color: '#4b5563' }}>{KO.setup.featureHint}</p>

      <label style={{ display: 'block', marginTop: 12, fontWeight: 700 }}>{KO.setup.targetLabel}</label>
      <select
        value={targetColumn}
        onChange={(e) => handleTargetChange(e.target.value)}
        style={{ width: '100%', maxWidth: 420, marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
      >
        <option value="">{KO.setup.targetPlaceholder}</option>
        {columns.map((col) => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>

      {targetColumn && (
        <p style={{ color: '#1d4ed8', fontWeight: 600 }}>
          {KO.setup.autoDetected}: {taskType === 'classification' ? KO.setup.taskType.classification : KO.setup.taskType.regression}
        </p>
      )}

      <h3>{KO.setup.featureLabel}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {featureOptions.map((col) => (
          <label key={col} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, backgroundColor: '#fff' }}>
            <input type="checkbox" checked={featureColumns.includes(col)} onChange={() => toggleFeature(col)} /> {col}
            <small style={{ display: 'block', color: '#6b7280' }}>{dtypes[col]}</small>
          </label>
        ))}
      </div>

      <button type="button" onClick={goTraining} style={{ marginTop: 16 }}>학습 시작 화면으로 이동</button>
      {errorMessage && <p style={{ color: '#dc2626' }}>{errorMessage}</p>}
    </section>
  )
}
