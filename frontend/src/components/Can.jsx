import { useAuth } from '../contexts/AuthContext'

export default function Can({ permission, anyPermissions, children, fallback = null }) {
  const { hasPermission, hasAnyPermission } = useAuth()

  const allowed = (() => {
    if (Array.isArray(anyPermissions) && anyPermissions.length > 0) return hasAnyPermission(anyPermissions)
    if (typeof permission === 'string' && permission.length > 0) return hasPermission(permission)
    return true
  })()

  if (!allowed) return fallback
  return children
}

