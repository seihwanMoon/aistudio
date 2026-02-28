import { apiClient } from './client'

export async function listExperiments() {
  const { data } = await apiClient.get('/api/experiments')
  return data
}

export async function getExperimentDetail(runId) {
  const { data } = await apiClient.get(`/api/experiments/${runId}`)
  return data
}

export async function compareExperiments(runIds) {
  const { data } = await apiClient.post('/api/experiments/compare', { run_ids: runIds })
  return data
}
