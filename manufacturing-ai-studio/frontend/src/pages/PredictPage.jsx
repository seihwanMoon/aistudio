import { useState } from 'react'
import { predictBatch, predictSingle } from '../api/predict.api'
import { KO } from '../constants/korean'
import { useAppStore } from '../store/useAppStore'

export default function PredictPage() {
  const trainedModelId = useAppStore((state) => state.trainedModelId)
  const featureColumns = useAppStore((state) => state.featureColumns)

  const [inputs, setInputs] = useState({})
  const [singleResult, setSingleResult] = useState(null)
  const [batchFile, setBatchFile] = useState(null)
  const [batchResult, setBatchResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  async function runSinglePrediction() {
    if (!trainedModelId) {
      setErrorMessage('먼저 학습을 완료해 주세요.')
      return
    }
    try {
      const data = await predictSingle({ model_id: trainedModelId, features: inputs })
      setSingleResult(data)
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || '단건 예측 실패')
    }
  }

  async function runBatchPrediction() {
    if (!trainedModelId || !batchFile) {
      setErrorMessage('모델 또는 파일이 준비되지 않았습니다.')
      return
    }
    try {
      const data = await predictBatch(trainedModelId, batchFile)
      setBatchResult(data)
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || '배치 예측 실패')
    }
  }

  return (
    <section style={{ textAlign: 'left' }}>
      <h1>{KO.predict.title}</h1>

      <div style={{ marginTop: 14, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        <h3>{KO.predict.singleTitle}</h3>
        {featureColumns.map((column) => (
          <div key={column} style={{ marginBottom: 8 }}>
            <label>{column}</label>
            <input
              type="text"
              value={inputs[column] || ''}
              onChange={(e) => setInputs({ ...inputs, [column]: e.target.value })}
              style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }}
            />
          </div>
        ))}
        <button type="button" onClick={runSinglePrediction}>단건 예측 실행</button>
        {singleResult && (
          <p style={{ marginTop: 10 }}>
            {KO.predict.result}: <strong>{singleResult.prediction}</strong> ({KO.predict.probability}: {singleResult.probability ?? 'N/A'})
          </p>
        )}
      </div>

      <div style={{ marginTop: 14, border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' }}>
        <h3>{KO.predict.batchTitle}</h3>
        <input type="file" accept=".csv,.xlsx" onChange={(e) => setBatchFile(e.target.files?.[0] || null)} />
        <button type="button" onClick={runBatchPrediction} style={{ marginLeft: 8 }}>배치 예측 실행</button>
        {batchResult && <p style={{ marginTop: 8 }}>총 {batchResult.rows}건 처리 완료</p>}
      </div>

      {errorMessage && <p style={{ color: '#dc2626' }}>{errorMessage}</p>}
    </section>
  )
}
