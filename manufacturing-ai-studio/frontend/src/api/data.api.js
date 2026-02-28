import { apiClient } from './client'

export async function uploadDataFile(file) {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await apiClient.post('/api/data/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return data
}

export async function getDataPreview(fileId) {
  const { data } = await apiClient.get(`/api/data/${fileId}/preview`)
  return data
}
