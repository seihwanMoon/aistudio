import { apiClient } from './client'

export async function listRegistry() {
  const { data } = await apiClient.get('/api/registry')
  return data
}

export async function registerModel(payload) {
  const { data } = await apiClient.post('/api/registry/register', payload)
  return data
}

export async function changeModelStage(modelName, stage) {
  const { data } = await apiClient.put(`/api/registry/${modelName}/stage`, { stage })
  return data
}
