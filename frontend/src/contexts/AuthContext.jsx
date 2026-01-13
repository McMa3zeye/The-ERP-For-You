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
  }, [])

  const verifySession = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data.user)
      setPermissions(response.data.permissions || [])
    } catch {
      logout()
    }
  }

  const login = async (username, password, rememberMe = false) => {
    try {
      const response = await api.post('/auth/login', {
        username,
        password,
        remember_me: rememberMe
      })
      
      const { access_token, user: userData } = response.data
      
      // Store token
      localStorage.setItem('auth_token', access_token)
      localStorage.setItem('auth_user', JSON.stringify(userData))
      
      // Set auth header
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
      
      setUser(userData)
      
      // Load permissions
      try {
        const permResponse = await api.get('/auth/me')
        setPermissions(permResponse.data.permissions || [])
      } catch {}
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      }
    }
  }

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

  const hasPermission = useCallback((permissionCode) => {
    if (!user) return false
    if (user.is_superuser) return true
    return permissions.includes(permissionCode)
  }, [user, permissions])

  const hasAnyPermission = useCallback((permissionCodes) => {
    if (!user) return false
    if (user.is_superuser) return true
    return permissionCodes.some(code => permissions.includes(code))
  }, [user, permissions])

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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
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
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '400px',
      flexDirection: 'column',
      gap: '1rem',
      color: 'var(--red-400)'
    }}>
      <h2>⛔ Access Denied</h2>
      <p>You don't have permission to access this page.</p>
    </div>
  )
}

export default AuthContext
