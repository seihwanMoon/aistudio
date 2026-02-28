import { useAuthStore } from '../store/useAuthStore'

export function useAuth() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.role)
  const username = useAuthStore((s) => s.username)
  const setAuth = useAuthStore((s) => s.setAuth)
  const logout = useAuthStore((s) => s.logout)

  return {
    token,
    role,
    username,
    isAuthenticated: Boolean(token),
    setAuth,
    logout,
  }
}
