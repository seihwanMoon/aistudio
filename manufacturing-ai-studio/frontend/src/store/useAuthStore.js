import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('auth_token') || '',
  role: localStorage.getItem('auth_role') || '',
  username: localStorage.getItem('auth_user') || '',
  setAuth: ({ token, role, username }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_role', role)
    localStorage.setItem('auth_user', username)
    set({ token, role, username })
  },
  logout: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_role')
    localStorage.removeItem('auth_user')
    set({ token: '', role: '', username: '' })
  },
}))
