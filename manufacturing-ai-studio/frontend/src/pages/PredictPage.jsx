import { useState } from 'react'
import { predictBatch, predictSingle } from '../api/predict.api'
import { getLocalXai } from '../api/xai.api'
import { KO } from '../constants/korean'
import { useAppStore } from '../store/useAppStore'

export default function PredictPage() {
  const trainedModelId = useAppStore((state) => state.trainedModelId)
  const featureColumns = useAppStore((state) => state.featureColumns)

  const [inputs, setInputs] = useState({})
  const [singleResult, setSingleResult] = useState(null)
  const [localXai, setLocalXai] = useState(null)
  const [batchFile, setBatchFile] = useState(null)
  const [batchResult, setBatchResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [xaiErrorMessage, setXaiErrorMessage] = useState('')
  const maxLocalAbs = Math.max(
    1e-9,
    ...((localXai?.contributions || []).map((item) => Number(item.abs_shap_value || 0))),
  )

  async function runSinglePrediction() {
    if (!trainedModelId) {
      setErrorMessage('먼저 학습을 완료해 주세요.')
      return
    }
    try {
      const data = await predictSingle({ model_id: trainedModelId, features: inputs })
      setSingleResult(data)
      setErrorMessage('')

      try {
        const xai = await getLocalXai({
          model_id: trainedModelId,
          features: inputs,
          top_n: 10,
        })
        setLocalXai(xai)
        setXaiErrorMessage('')
      } catch (xaiError) {
        setLocalXai(null)
        setXaiErrorMessage(xaiError?.response?.data?.detail || '로컬 XAI 계산 실패')
      }
    } catch (error) {
      setLocalXai(null)
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
          <div style={{ marginTop: 10 }}>
            <p>
              {KO.predict.result}: <strong>{singleResult.prediction}</strong> ({KO.predict.probability}: {singleResult.probability ?? 'N/A'})
            </p>
            {localXai && (
              <div style={{ marginTop: 8, border: '1px solid #d1d5db', borderRadius: 8, padding: 10, backgroundColor: '#f9fafb' }}>
                <h4 style={{ margin: '0 0 6px' }}>Local SHAP 설명</h4>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#4b5563' }}>
                  base: {Number(localXai.base_value).toFixed(4)} / shap_sum: {Number(localXai.shap_sum).toFixed(4)} / raw output: {Number(localXai.approx_raw_output).toFixed(4)}
                </p>
                {(localXai.contributions || []).map((item) => (
                  <div key={item.feature} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{item.feature}</span>
                      <strong>{item.shap_value.toFixed(6)}</strong>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.max(3, Math.min(100, (item.abs_shap_value / maxLocalAbs) * 100))}%`,
                          height: '100%',
                          backgroundColor: item.shap_value >= 0 ? '#2563eb' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {xaiErrorMessage && <p style={{ marginTop: 8, color: '#b45309' }}>{xaiErrorMessage}</p>}
          </div>
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
