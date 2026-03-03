import { useMemo, useState } from 'react'
import { KO } from '../constants/korean'
import { getDataPreview, uploadDataFile } from '../api/data.api'
import { getEdaCorrelation, getEdaFeatureProfile, getEdaSummary, getEdaTargetInsight } from '../api/eda.api'
import EdaCorrelation from '../components/data/EdaCorrelation'
import EdaFeatureProfile from '../components/data/EdaFeatureProfile'
import EdaTargetInsight from '../components/data/EdaTargetInsight'
import DataPreview from '../components/data/DataPreview'
import EdaOverview from '../components/data/EdaOverview'
import FileDropzone from '../components/data/FileDropzone'
import { useAppStore } from '../store/useAppStore'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const SUPPORTED_EXTENSIONS = ['csv', 'xlsx']

function validateFile(file) {
  if (!file) return '파일을 선택해 주세요.'

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !SUPPORTED_EXTENSIONS.includes(extension)) {
    return 'CSV 또는 XLSX 파일만 업로드할 수 있습니다.'
  }

  if (file.size > MAX_FILE_SIZE) {
    return '파일 크기가 50MB를 초과했습니다.'
  }

  return ''
}

export default function UploadPage() {
  const setUploadedFile = useAppStore((state) => state.setUploadedFile)

  const [file, setFile] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)
  const [preview, setPreview] = useState(null)
  const [edaSummary, setEdaSummary] = useState(null)
  const [edaCorrelation, setEdaCorrelation] = useState(null)
  const [targetInsight, setTargetInsight] = useState(null)
  const [targetInsightColumn, setTargetInsightColumn] = useState('')
  const [isTargetInsightLoading, setIsTargetInsightLoading] = useState(false)
  const [featureProfile, setFeatureProfile] = useState(null)
  const [selectedFeature, setSelectedFeature] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [edaErrorMessage, setEdaErrorMessage] = useState('')

  const canUpload = useMemo(() => file && !isLoading, [file, isLoading])

  function handleFileSelect(nextFile) {
    setFile(nextFile)
    setUploadResult(null)
    setPreview(null)
    setEdaSummary(null)
    setEdaCorrelation(null)
    setTargetInsight(null)
    setTargetInsightColumn('')
    setIsTargetInsightLoading(false)
    setFeatureProfile(null)
    setSelectedFeature('')

    const validationMessage = validateFile(nextFile)
    setErrorMessage(validationMessage)
    setEdaErrorMessage('')
  }

  async function loadFeatureProfile(fileId, featureName) {
    if (!fileId || !featureName) return
    try {
      const profile = await getEdaFeatureProfile(fileId, featureName)
      setFeatureProfile(profile)
      setEdaErrorMessage('')
    } catch (error) {
      setFeatureProfile(null)
      setEdaErrorMessage(error?.response?.data?.detail || '피처 프로필을 불러오지 못했습니다.')
    }
  }

  async function handleSelectFeature(featureName) {
    setSelectedFeature(featureName)
    await loadFeatureProfile(uploadResult?.file_id, featureName)
  }

  async function loadTargetInsight(fileId, targetColumn) {
    if (!fileId || !targetColumn) return
    setIsTargetInsightLoading(true)
    try {
      const insight = await getEdaTargetInsight(fileId, { target_column: targetColumn, top_n: 8 })
      setTargetInsight(insight)
      setEdaErrorMessage('')
    } catch (error) {
      setTargetInsight(null)
      setEdaErrorMessage(error?.response?.data?.detail || '타겟 인사이트를 불러오지 못했습니다.')
    } finally {
      setIsTargetInsightLoading(false)
    }
  }

  async function handleSelectTargetInsight(targetColumn) {
    setTargetInsightColumn(targetColumn)
    await loadTargetInsight(uploadResult?.file_id, targetColumn)
  }

  async function handleUpload() {
    const validationMessage = validateFile(file)
    if (validationMessage) {
      setErrorMessage(validationMessage)
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    try {
      const uploaded = await uploadDataFile(file)
      setUploadResult(uploaded)
      setUploadedFile(uploaded)

      const previewData = await getDataPreview(uploaded.file_id)
      setPreview(previewData)

      try {
        const [summary, correlation] = await Promise.all([
          getEdaSummary(uploaded.file_id),
          getEdaCorrelation(uploaded.file_id, { max_features: 30, threshold: 0.8 }),
        ])
        setEdaSummary(summary)
        setEdaCorrelation(correlation)

        const defaultTargetColumn = previewData?.columns?.[previewData?.columns?.length - 1] || ''
        setTargetInsightColumn(defaultTargetColumn)
        if (defaultTargetColumn) {
          await loadTargetInsight(uploaded.file_id, defaultTargetColumn)
        } else {
          setTargetInsight(null)
        }

        const firstFeature = previewData?.columns?.[0]
        if (firstFeature) {
          setSelectedFeature(firstFeature)
          await loadFeatureProfile(uploaded.file_id, firstFeature)
        }
      } catch (edaError) {
        setEdaSummary(null)
        setEdaCorrelation(null)
        setTargetInsight(null)
        setTargetInsightColumn('')
        setFeatureProfile(null)
        setSelectedFeature('')
        setEdaErrorMessage(edaError?.response?.data?.detail || 'EDA 결과를 불러오지 못했습니다.')
      }
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || '업로드에 실패했습니다. 파일 형식을 확인해 주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'left' }}>
      <h1 style={{ marginBottom: 8 }}>{KO.upload.title}</h1>
      <p style={{ margin: '0 0 20px', color: '#4b5563' }}>{KO.upload.subtitle}</p>

      <FileDropzone file={file} onFileSelect={handleFileSelect} disabled={isLoading} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14 }}>
        <button type="button" onClick={handleUpload} disabled={!canUpload || Boolean(errorMessage)}>
          {isLoading ? KO.upload.uploading : KO.upload.button}
        </button>

        <a
          href="/samples/sample_manufacturing.csv"
          download
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            padding: '0.55rem 1rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            backgroundColor: '#fff',
            color: '#111827',
          }}
        >
          {KO.upload.sampleData}
        </a>
      </div>

      <small style={{ display: 'block', marginTop: 10, color: '#6b7280' }}>{KO.upload.supportedFormats}</small>

      {errorMessage && (
        <p style={{ marginTop: 12, color: '#dc2626', fontWeight: 600 }}>
          {KO.common.error}: {errorMessage}
        </p>
      )}

      {uploadResult && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
          }}
        >
          <strong>{KO.upload.success}</strong>
          <div style={{ marginTop: 4, fontSize: 14 }}>file_id: {uploadResult.file_id}</div>
        </div>
      )}

      <DataPreview preview={preview} />
      <EdaOverview summary={edaSummary} />
      <EdaTargetInsight
        columns={preview?.columns || []}
        targetColumn={targetInsightColumn}
        onChangeTarget={handleSelectTargetInsight}
        insight={targetInsight}
        isLoading={isTargetInsightLoading}
      />
      <EdaCorrelation correlation={edaCorrelation} />
      <EdaFeatureProfile
        columns={preview?.columns || []}
        selectedFeature={selectedFeature}
        onChangeFeature={handleSelectFeature}
        profile={featureProfile}
      />
      {edaErrorMessage && <p style={{ color: '#b45309', marginTop: 10 }}>{edaErrorMessage}</p>}
    </section>
  )
}
