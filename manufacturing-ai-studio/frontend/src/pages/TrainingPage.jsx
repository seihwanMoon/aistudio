import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { startTraining, getTrainingStatus } from '../api/train.api'
import { KO } from '../constants/korean'
import { useAppStore } from '../store/useAppStore'

export default function TrainingPage() {
  const navigate = useNavigate()
  const uploadedFile = useAppStore((state) => state.uploadedFile)
  const targetColumn = useAppStore((state) => state.targetColumn)
  const featureColumns = useAppStore((state) => state.featureColumns)
  const taskType = useAppStore((state) => state.taskType)
  const trainingSessionId = useAppStore((state) => state.trainingSessionId)
  const setTrainingSessionId = useAppStore((state) => state.setTrainingSessionId)
  const setTrainedModelId = useAppStore((state) => state.setTrainedModelId)
  const setTrainingResult = useAppStore((state) => state.setTrainingResult)

  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [autoStarted, setAutoStarted] = useState(false)

  const canStart = useMemo(
    () => uploadedFile?.file_id && targetColumn && featureColumns.length > 0,
    [uploadedFile?.file_id, targetColumn, featureColumns.length],
  )

  async function beginTraining() {
    if (!canStart) {
      setErrorMessage('학습 설정이 완료되지 않았습니다. 설정 페이지를 확인해 주세요.')
      return
    }

    setStatus('starting')
    setProgress(0)
    setLogs(['학습 시작 요청을 전송했습니다.'])
    setErrorMessage('')

    try {
      const response = await startTraining({
        file_id: uploadedFile.file_id,
        target_column: targetColumn,
        feature_columns: featureColumns,
        task_type: taskType,
        time_budget: 120,
      })
      setTrainingSessionId(response.session_id)
      setLogs((prev) => [...prev, `세션 생성 완료: ${response.session_id}`])
      setStatus('running')
    } catch (error) {
      setStatus('failed')
      setErrorMessage(error?.response?.data?.detail || '학습 시작에 실패했습니다.')
    }
  }

  useEffect(() => {
    // 설정이 충분하면 진입 직후 자동 시작(버튼 클릭 누락/확장프로그램 간섭 대비)
    if (!autoStarted && canStart && !trainingSessionId && status === 'idle') {
      setAutoStarted(true)
      beginTraining()
    }
  }, [autoStarted, canStart, trainingSessionId, status])

  useEffect(() => {
    if (!trainingSessionId) return

    const timer = setInterval(async () => {
      try {
        const data = await getTrainingStatus(trainingSessionId)
        setProgress(data.progress || 0)
        setLogs(data.logs || [])
        setStatus(data.status || 'running')

        if (data.status === 'done' && data.result) {
          setTrainedModelId(data.result.model_id)
          setTrainingResult(data.result)
          clearInterval(timer)
          navigate('/results')
        }

        if (data.status === 'failed') {
          setErrorMessage(data.error || '학습 중 오류가 발생했습니다.')
          clearInterval(timer)
        }
      } catch (error) {
        if (error?.response?.status === 404) {
          // 백엔드 재시작 등으로 세션 메모리가 초기화된 경우, 새 세션 시작을 유도
          setTrainingSessionId(null)
          setStatus('idle')
          setProgress(0)
          setLogs(['이전 학습 세션이 만료되었습니다. 다시 학습 시작 버튼을 눌러 주세요.'])
          setErrorMessage('')
          clearInterval(timer)
          return
        }
        setErrorMessage(error?.response?.data?.detail || '학습 상태를 불러오지 못했습니다.')
      }
    }, 1200)

    return () => clearInterval(timer)
  }, [trainingSessionId, navigate, setTrainedModelId, setTrainingResult])

  return (
    <section style={{ textAlign: 'left', maxWidth: 900, margin: '0 auto' }}>
      <h1>{KO.training.title}</h1>
      <p>{KO.training.subtitle}</p>
      <p style={{ color: '#475569', fontSize: 14 }}>
        상태: {status} / 세션: {trainingSessionId || '-'}
      </p>

      <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        <div style={{ height: 16, borderRadius: 999, backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#2563eb', transition: 'width 0.3s' }} />
        </div>
        <p style={{ marginTop: 8, fontWeight: 700 }}>{progress}%</p>
      </div>

      <button type="button" onClick={beginTraining} disabled={!canStart || status === 'running' || status === 'starting'} style={{ marginTop: 16 }}>
        {status === 'running' || status === 'starting' ? '학습 중...' : '학습 시작'}
      </button>
      {!canStart && (
        <p style={{ marginTop: 8, color: '#b45309' }}>
          학습에 필요한 설정이 없습니다. <Link to="/setup">학습 설정</Link>에서 타겟/피처를 다시 선택해 주세요.
        </p>
      )}

      <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#0f172a', color: '#e2e8f0' }}>
        <strong>로그</strong>
        <ul>
          {logs.map((log, idx) => (
            <li key={`${log}-${idx}`}>{log}</li>
          ))}
        </ul>
      </div>

      {errorMessage && <p style={{ color: '#dc2626' }}>{errorMessage}</p>}
    </section>
  )
}
