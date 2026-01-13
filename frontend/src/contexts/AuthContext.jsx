import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import api from '../services/api'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
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
        // Verify session is still valid
        verifySession()
      } catch {
        logout()
      }
    }

    setLoading(false)
  }, [verifySession, logout])

  const login = async (username, password, rememberMe = false) => {
    try {
      // IMPORTANT:
      // Many FastAPI login endpoints use OAuth2PasswordRequestForm,
      // which expects application/x-www-form-urlencoded, NOT JSON.
      const body = new URLSearchParams()
      body.append('username', username)
      body.append('password', password)
      // OPTIONAL but sometimes expected by some implementations:
      body.append('grant_type', '')
      body.append('scope', '')
      body.append('client_id', '')
      body.append('client_secret', '')


      // If your backend reads remember_me from the form too, include it:
      body.append('remember_me', rememberMe ? 'true' : 'false')

      // Ensure we don't send an old token to login
      if (api.defaults.headers.common['Authorization']) {
        delete api.defaults.headers.common['Authorization']
      }

      const response = await api.post('/auth/login', body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })

      const { access_token, user: userData } = response.data

      // Store token (you currently always use localStorage)
      localStorage.setItem('auth_token', access_token)
      localStorage.setItem('auth_user', JSON.stringify(userData))

      // Set auth header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

      setUser(userData)

      // Load permissions
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
        error: error.response?.data?.detail || 'Login failed'
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
      <p>You don't have permission to access this page.</p>
    </div>
  )
}

export default AuthContext
