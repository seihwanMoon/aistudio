import { apiClient } from './client'

export async function login(payload) {
  const { data } = await apiClient.post('/api/auth/login', payload)
  return data
}

export async function register(payload) {
  const { data } = await apiClient.post('/api/auth/register', payload)
  return data
}

export async function getMe(token) {
  const { data } = await apiClient.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
  return data
}
