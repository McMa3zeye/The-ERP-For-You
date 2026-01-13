import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import PageHelpCorner from '../components/PageHelpCorner'

function useQuery() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

export default function ResetPassword() {
  const query = useQuery()
  const navigate = useNavigate()

  const token = query.get('token') || ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!token) {
      setError('Missing token in URL')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const res = await authAPI.resetPassword({ token, new_password: newPassword })
      setMessage(res.data?.message || 'Password reset successfully')
      setTimeout(() => navigate('/login', { replace: true }), 600)
    } catch (err) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 style={{ margin: 0 }}>
          🔁 Reset Password
          <PageHelpCorner />
        </h1>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Confirm password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  )
}

