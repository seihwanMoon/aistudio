import { useEffect, useMemo, useState } from 'react'
import { KO } from '../constants/korean'
import { getDataPreview, uploadDataFile } from '../api/data.api'
import { getEdaCorrelation, getEdaFeatureProfile, getEdaStatistics, getEdaSummary, getEdaTargetInsight } from '../api/eda.api'
import EdaCorrelation from '../components/data/EdaCorrelation'
import EdaFeatureProfile from '../components/data/EdaFeatureProfile'
import EdaStatistics from '../components/data/EdaStatistics'
import EdaTargetInsight from '../components/data/EdaTargetInsight'
import DataPreview from '../components/data/DataPreview'
import EdaOverview from '../components/data/EdaOverview'
import FileDropzone from '../components/data/FileDropzone'
import { useAppStore } from '../store/useAppStore'

const MAX_FILE_SIZE = 50 * 1024 * 1024
const SUPPORTED_EXTENSIONS = ['csv', 'xlsx']
const ANALYSIS_TABS = [
  { id: 'preview', label: '데이터 미리보기' },
  { id: 'overview', label: 'EDA 요약' },
  { id: 'statistics', label: '통계 분석' },
  { id: 'target', label: '타겟 인사이트' },
  { id: 'correlation', label: '상관분석' },
  { id: 'feature', label: '피처 프로필' },
]

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
  const uploadedFile = useAppStore((state) => state.uploadedFile)
  const setUploadedFile = useAppStore((state) => state.setUploadedFile)

  const [file, setFile] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)
  const [preview, setPreview] = useState(null)
  const [edaSummary, setEdaSummary] = useState(null)
  const [edaStatistics, setEdaStatistics] = useState(null)
  const [edaCorrelation, setEdaCorrelation] = useState(null)
  const [targetInsight, setTargetInsight] = useState(null)
  const [targetInsightColumn, setTargetInsightColumn] = useState('')
  const [isTargetInsightLoading, setIsTargetInsightLoading] = useState(false)
  const [featureProfile, setFeatureProfile] = useState(null)
  const [selectedFeature, setSelectedFeature] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [edaErrorMessage, setEdaErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('preview')

  const canUpload = useMemo(() => file && !isLoading, [file, isLoading])
  const currentFileId = uploadResult?.file_id || uploadedFile?.file_id

  function handleFileSelect(nextFile) {
    setFile(nextFile)
    setUploadResult(null)
    setPreview(null)
    setEdaSummary(null)
    setEdaStatistics(null)
    setEdaCorrelation(null)
    setTargetInsight(null)
    setTargetInsightColumn('')
    setIsTargetInsightLoading(false)
    setFeatureProfile(null)
    setSelectedFeature('')

    const validationMessage = validateFile(nextFile)
    setErrorMessage(validationMessage)
    setEdaErrorMessage('')
    setActiveTab('preview')
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
    await loadFeatureProfile(currentFileId, featureName)
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
    await loadTargetInsight(currentFileId, targetColumn)
  }

  async function loadPreviewAndEda(fileId, preferredDataName = '') {
    const previewData = await getDataPreview(fileId)
    const dataRef = previewData?.data_ref || previewData?.data_id || previewData?.file_id || fileId
    const resolvedDataName = preferredDataName || uploadedFile?.data_name || uploadedFile?.filename || previewData?.data_name
    setPreview({
      ...previewData,
      data_ref: dataRef,
      data_id: dataRef,
      data_key: dataRef,
      data_name: resolvedDataName || previewData?.data_name,
    })

    const [summary, statistics, correlation] = await Promise.all([
      getEdaSummary(fileId),
      getEdaStatistics(fileId, { top_numeric: 12, top_categorical: 6 }),
      getEdaCorrelation(fileId, { max_features: 30, threshold: 0.8 }),
    ])
    setEdaSummary(summary)
    setEdaStatistics(statistics)
    setEdaCorrelation(correlation)

    const defaultTargetColumn = previewData?.columns?.[previewData?.columns?.length - 1] || ''
    setTargetInsightColumn(defaultTargetColumn)
    if (defaultTargetColumn) {
      await loadTargetInsight(fileId, defaultTargetColumn)
    } else {
      setTargetInsight(null)
    }

    const firstFeature = previewData?.columns?.[0]
    if (firstFeature) {
      setSelectedFeature(firstFeature)
      await loadFeatureProfile(fileId, firstFeature)
    } else {
      setFeatureProfile(null)
      setSelectedFeature('')
    }
  }

  useEffect(() => {
    async function hydrateStoredUpload() {
      if (!uploadedFile?.file_id) return
      if (preview?.file_id === uploadedFile.file_id) return
      try {
        setUploadResult((prev) => prev || uploadedFile)
        await loadPreviewAndEda(uploadedFile.file_id, uploadedFile.data_name || uploadedFile.filename || '')
      } catch (error) {
        setEdaErrorMessage(error?.response?.data?.detail || 'EDA 결과를 불러오지 못했습니다.')
      }
    }
    hydrateStoredUpload()
  }, [uploadedFile?.file_id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      setActiveTab('preview')

      try {
        await loadPreviewAndEda(uploaded.file_id, uploaded.data_name || uploaded.filename || '')
      } catch (edaError) {
        setEdaSummary(null)
        setEdaStatistics(null)
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
    <section className="page-shell compact" style={{ maxWidth: 1100 }}>
      <div className="page-hero">
        <p className="page-kicker">Data Pipeline</p>
        <h1>{KO.upload.title}</h1>
        <p className="page-subtitle">{KO.upload.subtitle}</p>
      </div>

      <FileDropzone file={file} onFileSelect={handleFileSelect} disabled={isLoading} />

      <div className="actions-row">
        <button type="button" onClick={handleUpload} disabled={!canUpload || Boolean(errorMessage)}>
          {isLoading ? KO.upload.uploading : KO.upload.button}
        </button>

        <a
          href="/samples/sample_manufacturing.csv"
          download
          className="link-button"
        >
          {KO.upload.sampleData}
        </a>
      </div>

      <small className="helper-text">{KO.upload.supportedFormats}</small>

      {errorMessage && (
        <p className="notice error">
          {KO.common.error}: {errorMessage}
        </p>
      )}

      {uploadResult && (
        <div className="notice success">
          <strong>{KO.upload.success}</strong>
          <div className="meta-inline">
            <div>데이터명: {uploadResult.data_name || uploadResult.filename || '-'}</div>
            <div>데이터 식별자: {uploadResult.data_ref || uploadResult.data_id || uploadResult.file_id}</div>
          </div>
        </div>
      )}

      {preview && (
        <section className="section-card soft">
          <div>
            <h2 className="section-card-header">업로드 데이터 분석</h2>
            <p className="section-card-subtitle">
              아래 탭에서 미리보기와 EDA 결과를 개별 화면으로 확인하세요.
            </p>
          </div>

          <div className="tab-row">
            {ANALYSIS_TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={isActive ? 'tab-button is-active' : 'tab-button'}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="content-wrap">
            {activeTab === 'preview' && <DataPreview preview={preview} />}
            {activeTab === 'overview' && <EdaOverview summary={edaSummary} />}
            {activeTab === 'statistics' && <EdaStatistics stats={edaStatistics} fileId={currentFileId} />}
            {activeTab === 'target' && (
              <EdaTargetInsight
                columns={preview?.columns || []}
                targetColumn={targetInsightColumn}
                onChangeTarget={handleSelectTargetInsight}
                insight={targetInsight}
                isLoading={isTargetInsightLoading}
              />
            )}
            {activeTab === 'correlation' && <EdaCorrelation correlation={edaCorrelation} />}
            {activeTab === 'feature' && (
              <EdaFeatureProfile
                columns={preview?.columns || []}
                selectedFeature={selectedFeature}
                onChangeFeature={handleSelectFeature}
                profile={featureProfile}
              />
            )}
          </div>
        </section>
      )}
      {edaErrorMessage && <p className="notice warn">{edaErrorMessage}</p>}
    </section>
  )
}
