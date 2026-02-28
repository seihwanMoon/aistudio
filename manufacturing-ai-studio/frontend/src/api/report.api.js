import { apiClient } from './client'

export async function downloadReport(modelId) {
  const response = await apiClient.get(`/api/report/${modelId}`, { responseType: 'blob' })
  return response.data
}
