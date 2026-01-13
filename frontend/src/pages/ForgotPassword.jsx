import { useState } from 'react'
import { authAPI } from '../services/api'
import PageHelpCorner from '../components/PageHelpCorner'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const res = await authAPI.forgotPassword({ email })
      setMessage(res.data?.message || 'If that email exists, a reset link has been sent.')
    } catch (err) {
      setError(err.message || 'Failed to request password reset')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 style={{ margin: 0 }}>
          📧 Forgot Password
          <PageHelpCorner />
        </h1>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <p style={{ marginBottom: '1rem' }}>
          Enter your account email. If it exists, we’ll send a password reset link.
        </p>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      </div>
    </div>
  )
}

