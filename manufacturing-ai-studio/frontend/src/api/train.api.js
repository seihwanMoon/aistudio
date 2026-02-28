import { apiClient } from './client'

export async function startTraining(payload) {
  const { data } = await apiClient.post('/api/train/start', payload)
  return data
}

export async function getTrainingStatus(sessionId) {
  const { data } = await apiClient.get(`/api/train/status/${sessionId}`)
  return data
}

export async function getTrainingResults(modelId) {
  const { data } = await apiClient.get(`/api/train/results/${modelId}`)
  return data
}
