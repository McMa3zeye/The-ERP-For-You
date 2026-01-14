import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import PageHelpCorner from '../components/PageHelpCorner'

export default function Login() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = location.state?.from?.pathname || '/'

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await login(username, password, rememberMe)
      if (!res.success) {
        setError(String(res.error || 'Login failed'))
        return
      }
      navigate(from, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 style={{ margin: 0 }}>
          🔐 Login
          <PageHelpCorner />
        </h1>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <h2 style={{ marginTop: 0 }}>Welcome back</h2>
        <p style={{ marginBottom: '1rem' }}>
          Use a username/password that exists in <strong>Admin & Security → Users</strong>.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Username or Email</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            <span>Remember me</span>
          </label>

          <button className="btn btn-primary" type="submit" disabled={loading || submitting}>
            {submitting ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: '1rem' }}>
          <Link to="/forgot-password" style={{ color: 'var(--text-2)', fontWeight: 700 }}>
            Forgot your password?
          </Link>
        </div>
      </div>
    </div>
  )
}

