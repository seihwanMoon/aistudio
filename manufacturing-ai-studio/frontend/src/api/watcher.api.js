import { apiClient } from './client'

export async function startWatcher(payload) {
  const { data } = await apiClient.post('/api/watcher/config', payload)
  return data
}

export async function stopWatcher(watcherId) {
  const { data } = await apiClient.post(`/api/watcher/stop/${watcherId}`)
  return data
}

export async function getWatcherStatus() {
  const { data } = await apiClient.get('/api/watcher/status')
  return data
}
