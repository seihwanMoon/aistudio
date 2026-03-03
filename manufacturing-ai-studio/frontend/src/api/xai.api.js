import { apiClient } from './client'

export async function getGlobalXai(modelId, params = {}) {
  const { data } = await apiClient.get(`/api/xai/global/${modelId}`, { params })
  return data
}

export async function getLocalXai(payload) {
  const { data } = await apiClient.post('/api/xai/local', payload)
  return data
}

export async function getPdp(payload) {
  const { data } = await apiClient.post('/api/xai/pdp', payload)
  return data
}
