import { apiClient } from './client'

export async function getAlertSettings() {
  const { data } = await apiClient.get('/api/alerts/settings')
  return data
}

export async function updateAlertSettings(payload) {
  const { data } = await apiClient.put('/api/alerts/settings', payload)
  return data
}

export async function sendAlertTest(payload = { channel: 'both' }) {
  const { data } = await apiClient.post('/api/alerts/test', payload)
  return data
}

export async function getAlertLogs(params = { limit: 20 }) {
  const { data } = await apiClient.get('/api/alerts/logs', { params })
  return data
}
