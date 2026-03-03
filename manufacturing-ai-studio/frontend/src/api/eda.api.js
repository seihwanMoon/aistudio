import { apiClient } from './client'

export async function getEdaSummary(fileId, params = {}) {
  const { data } = await apiClient.get(`/api/eda/${fileId}/summary`, { params })
  return data
}

export async function getEdaCorrelation(fileId, params = {}) {
  const { data } = await apiClient.get(`/api/eda/${fileId}/correlation`, { params })
  return data
}

export async function getEdaFeatureProfile(fileId, featureName, params = {}) {
  const { data } = await apiClient.get(`/api/eda/${fileId}/feature/${encodeURIComponent(featureName)}`, { params })
  return data
}

export async function getEdaTargetInsight(fileId, payload) {
  const { data } = await apiClient.post(`/api/eda/${fileId}/target-insight`, payload)
  return data
}
