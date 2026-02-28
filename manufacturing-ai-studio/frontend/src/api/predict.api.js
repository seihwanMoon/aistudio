import { apiClient } from './client'

export async function predictSingle(payload) {
  const { data } = await apiClient.post('/api/predict/single', payload)
  return data
}

export async function predictBatch(modelId, file) {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post(`/api/predict/batch?model_id=${modelId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return data
}
