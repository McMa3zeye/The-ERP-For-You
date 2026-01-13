import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { useTheme } from '../contexts/ThemeContext'
import PageHelpCorner from '../components/PageHelpCorner'

const SETTING_CATEGORIES = [
  { key: 'appearance', name: 'Appearance', icon: '🎨' },
  { key: 'company', name: 'Company Info', icon: '🏢' },
  { key: 'finance', name: 'Finance & Tax', icon: '💰' },
  { key: 'inventory', name: 'Inventory', icon: '📦' },
  { key: 'orders', name: 'Orders', icon: '📋' },
  { key: 'format', name: 'Formatting', icon: '📐' },
  { key: 'security', name: 'Security', icon: '🔐' },
  { key: 'notifications', name: 'Notifications', icon: '🔔' },
  { key: 'backup', name: 'Backup', icon: '💾' }
]

function Settings() {
  const { theme, themes, setTheme, density, setDensity, reduceMotion, setReduceMotion } = useTheme()
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(null)
  const [activeCategory, setActiveCategory] = useState('appearance')
  const [settings, setSettings] = useState({})
  const [editValues, setEditValues] = useState({})
  const [backups, setBackups] = useState([])
  const [showInitWizard, setShowInitWizard] = useState(false)
  
  const [companyForm, setCompanyForm] = useState({
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    tax_rate: 0,
    currency: 'USD',
    currency_symbol: '$'
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.get('/settings?include_private=true')
      setSettings(response.data.settings || {})
      setEditValues(response.data.settings || {})
    } catch (err) {
      console.error('Failed to load settings', err)
      // If settings fail, might not be initialized
      if (err.response?.status === 401) {
        showAlert('Please log in to access settings', 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [showAlert])

  const loadBackups = useCallback(async () => {
    try {
      const response = await api.get('/backup/list')
      setBackups(response.data.backups || [])
    } catch (err) {
      console.error('Failed to load backups', err)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (activeCategory === 'backup') {
      loadBackups()
    }
  }, [activeCategory, loadBackups])

  const handleSaveSetting = async (key) => {
    try {
      await api.put(`/settings/${key}?value=${encodeURIComponent(editValues[key])}`)
      showAlert('Setting saved')
      setSettings({ ...settings, [key]: editValues[key] })
    } catch (err) {
      showAlert('Failed to save setting', 'error')
    }
  }

  const handleInitCompany = async (e) => {
    e.preventDefault()
    try {
      const params = new URLSearchParams(companyForm)
      await api.post(`/settings/init-company?${params.toString()}`)
      showAlert('Company initialized successfully')
      setShowInitWizard(false)
      loadSettings()
    } catch (err) {
      showAlert('Failed to initialize company', 'error')
    }
  }

  const handleCreateBackup = async () => {
    try {
      const response = await api.post('/backup/create')
      showAlert(response.data.message)
      loadBackups()
    } catch (err) {
      showAlert('Failed to create backup', 'error')
    }
  }

  const handleRestoreBackup = async (filename) => {
    if (!window.confirm(`Restore from ${filename}? This will replace all current data!`)) return
    try {
      await api.post(`/backup/restore/${filename}`)
      showAlert('Backup restored. Please restart the application.')
    } catch (err) {
      showAlert('Failed to restore backup', 'error')
    }
  }

  const handleDeleteBackup = async (filename) => {
    if (!window.confirm(`Delete backup ${filename}?`)) return
    try {
      await api.delete(`/backup/${filename}`)
      showAlert('Backup deleted')
      loadBackups()
    } catch (err) {
      showAlert('Failed to delete backup', 'error')
    }
  }

  const getCategorySettings = () => {
    const prefix = activeCategory + '.'
    return Object.entries(settings)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({
        key,
        label: key.replace(prefix, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value
      }))
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1 style={{ margin: 0 }}>
          ⚙️ System Settings
          <PageHelpCorner />
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowInitWizard(true)} className="btn btn-secondary">🏢 Setup Wizard</button>
          <button onClick={loadSettings} className="btn btn-secondary">🔄 Refresh</button>
        </div>
      </div>

      {/* Setup Wizard Modal */}
      {showInitWizard && (
        <div className="modal-overlay" onClick={() => setShowInitWizard(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>🏢 Company Setup Wizard</h2>
            <p style={{ color: 'var(--brown-300)', marginBottom: '1.5rem' }}>
              Configure your company settings. This will initialize all system defaults.
            </p>
            <form onSubmit={handleInitCompany}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Company Name *</label>
                  <input type="text" value={companyForm.company_name} onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={companyForm.company_email} onChange={(e) => setCompanyForm({ ...companyForm, company_email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input type="text" value={companyForm.company_phone} onChange={(e) => setCompanyForm({ ...companyForm, company_phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Currency</label>
                  <select value={companyForm.currency} onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })}>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Currency Symbol</label>
                  <input type="text" value={companyForm.currency_symbol} onChange={(e) => setCompanyForm({ ...companyForm, currency_symbol: e.target.value })} maxLength="3" />
                </div>
                <div className="form-group">
                  <label>Default Tax Rate (%)</label>
                  <input type="number" value={companyForm.tax_rate} onChange={(e) => setCompanyForm({ ...companyForm, tax_rate: parseFloat(e.target.value) || 0 })} min="0" max="100" step="0.01" />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea value={companyForm.company_address} onChange={(e) => setCompanyForm({ ...companyForm, company_address: e.target.value })} rows="2" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowInitWizard(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Initialize Company</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '1.5rem' }}>
        {/* Categories Sidebar */}
        <div style={{ background: 'var(--brown-800)', borderRadius: '8px', padding: '1rem' }}>
          {SETTING_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                background: activeCategory === cat.key ? 'var(--green-600)' : 'transparent',
                color: activeCategory === cat.key ? '#fff' : 'var(--brown-200)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'left',
                marginBottom: '0.25rem'
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div style={{ background: 'var(--brown-800)', borderRadius: '8px', padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>
            {SETTING_CATEGORIES.find(c => c.key === activeCategory)?.icon}{' '}
            {SETTING_CATEGORIES.find(c => c.key === activeCategory)?.name}
          </h2>

          {activeCategory === 'appearance' ? (
            <>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Theme</h3>
                <div className="theme-grid">
                  {themes.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={`theme-card ${theme === t.key ? 'theme-card--active' : ''}`}
                      onClick={() => setTheme(t.key)}
                    >
                      <div className="theme-card__swatches" data-theme-preview={t.key}>
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="theme-card__meta">
                        <div className="theme-card__name">{t.name}</div>
                        <div className="theme-card__desc">{t.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Density</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['comfortable', 'compact'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`btn ${density === d ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setDensity(d)}
                    >
                      {d === 'comfortable' ? 'Comfortable' : 'Compact'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '0.75rem' }}>Motion</h3>
                <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={reduceMotion}
                    onChange={(e) => setReduceMotion(e.target.checked)}
                  />
                  <span>Reduce animations (more calming / less movement)</span>
                </label>
              </div>
            </>
          ) : activeCategory === 'backup' ? (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <button onClick={handleCreateBackup} className="btn btn-primary">💾 Create Backup Now</button>
              </div>
              
              <h3 style={{ marginBottom: '1rem' }}>Available Backups</h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Created</th>
                      <th>Size</th>
                      <th>Description</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map(backup => (
                      <tr key={backup.filename}>
                        <td>{backup.filename}</td>
                        <td>{new Date(backup.created).toLocaleString()}</td>
                        <td>{(backup.size_bytes / 1024 / 1024).toFixed(2)} MB</td>
                        <td>{backup.description || '-'}</td>
                        <td className="actions-cell">
                          <button onClick={() => window.open(`/api/backup/download/${backup.filename}`)} className="btn-icon" title="Download">⬇️</button>
                          <button onClick={() => handleRestoreBackup(backup.filename)} className="btn-icon" title="Restore">🔄</button>
                          <button onClick={() => handleDeleteBackup(backup.filename)} className="btn-icon" title="Delete">🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {backups.length === 0 && (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No backups found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {getCategorySettings().map(setting => (
                <div key={setting.key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'var(--brown-700)', borderRadius: '4px' }}>
                  <label style={{ flex: 1, fontWeight: 'bold' }}>{setting.label}</label>
                  <input
                    type="text"
                    value={editValues[setting.key] ?? ''}
                    onChange={(e) => setEditValues({ ...editValues, [setting.key]: e.target.value })}
                    style={{ flex: 2 }}
                  />
                  <button
                    onClick={() => handleSaveSetting(setting.key)}
                    className="btn btn-primary"
                    disabled={editValues[setting.key] === settings[setting.key]}
                  >
                    Save
                  </button>
                </div>
              ))}
              {getCategorySettings().length === 0 && (
                <p style={{ color: 'var(--brown-400)', textAlign: 'center', padding: '2rem' }}>
                  No settings in this category. Run the Setup Wizard to initialize.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
