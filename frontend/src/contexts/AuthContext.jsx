import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import api from '../services/api'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

const toErrorString = (error) => {
  const detail = error?.response?.data?.detail ?? error?.response?.data ?? error?.message
  if (typeof detail === 'string') return detail
  try {
    return JSON.stringify(detail)
  } catch {
    return 'Login failed'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState([])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {}

    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    setPermissions([])
  }, [])

  const verifySession = useCallback(async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data.user)
      setPermissions(response.data.permissions || [])
    } catch {
      logout()
    }
  }, [logout])

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('auth_user')

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        verifySession()
      } catch {
        logout()
      }
    }

    setLoading(false)
  }, [verifySession, logout])

  const login = async (username, password, rememberMe = false) => {
    try {
      // Don’t send any stale token to /auth/login
      delete api.defaults.headers.common['Authorization']

      // 1) Try JSON first (matches many custom login endpoints)
      try {
        const response = await api.post('/auth/login', {
          username,
          password,
          remember_me: rememberMe
        })

        const { access_token, user: userData } = response.data

        localStorage.setItem('auth_token', access_token)
        localStorage.setItem('auth_user', JSON.stringify(userData))
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

        setUser(userData)

        try {
          const permResponse = await api.get('/auth/me')
          setPermissions(permResponse.data.permissions || [])
        } catch {
          setPermissions([])
        }

        return { success: true }
      } catch (err) {
        // If it’s not a validation error, bubble it up
        if (err?.response?.status !== 422) throw err
      }

      // 2) Retry as x-www-form-urlencoded (OAuth2PasswordRequestForm style)
      const body = new URLSearchParams()
      body.append('username', username)
      body.append('password', password)

      // Common optional fields (safe even if ignored)
      body.append('grant_type', '')
      body.append('scope', '')
      body.append('client_id', '')
      body.append('client_secret', '')

      // If your backend reads remember_me from the form, include it (ignored otherwise)
      body.append('remember_me', rememberMe ? 'true' : 'false')

      const response = await api.post('/auth/login', body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })

      const { access_token, user: userData } = response.data

      localStorage.setItem('auth_token', access_token)
      localStorage.setItem('auth_user', JSON.stringify(userData))
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

      setUser(userData)

      try {
        const permResponse = await api.get('/auth/me')
        setPermissions(permResponse.data.permissions || [])
      } catch {
        setPermissions([])
      }

      return { success: true }
    } catch (error) {
      // Clean up any partial state
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      delete api.defaults.headers.common['Authorization']
      setUser(null)
      setPermissions([])

      return {
        success: false,
        error: toErrorString(error)
      }
    }
  }

  const hasPermission = useCallback(
    (permissionCode) => {
      if (!user) return false
      if (user.is_superuser) return true
      return permissions.includes(permissionCode)
    },
    [user, permissions]
  )

  const hasAnyPermission = useCallback(
    (permissionCodes) => {
      if (!user) return false
      if (user.is_superuser) return true
      return permissionCodes.some((code) => permissions.includes(code))
    },
    [user, permissions]
  )

  const value = {
    user,
    loading,
    permissions,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    isAuthenticated: !!user,
    isSuperuser: user?.is_superuser || false
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Protected Route component
export function RequireAuth({ children, permission, fallback = null }) {
  const { isAuthenticated, loading, hasPermission } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!isAuthenticated) {
    if (fallback) return fallback
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (permission && !hasPermission(permission)) {
    return <AccessDenied />
  }

  return children
}

function AccessDenied() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        flexDirection: 'column',
        gap: '1rem',
        color: 'var(--red-400)'
      }}
    >
      <h2>⛔ Access Denied</h2>
      <p>You don&apos;t have permission to access this page.</p>
    </div>
  )
}

export default AuthContext
