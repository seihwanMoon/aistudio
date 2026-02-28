import { apiClient } from './client'

export async function checkDrift(modelId) {
  const { data } = await apiClient.post(`/api/drift/check/${modelId}`)
  return data
}

export async function getDriftStatus(modelId) {
  const { data } = await apiClient.get(`/api/drift/status/${modelId}`)
  return data
}

export async function listAlerts(modelId) {
  const { data } = await apiClient.get('/api/drift/alerts', { params: modelId ? { model_id: modelId } : {} })
  return data
}
