import { useState, useEffect, useCallback } from 'react'
import { reportTemplatesAPI, savedReportsAPI, reportingAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const REPORT_TYPES = ['table', 'chart', 'summary', 'detailed']

function Reporting() {
  const [activeTab, setActiveTab] = useState('templates')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [alert, setAlert] = useState(null)
  
  // Templates state
  const [templates, setTemplates] = useState([])
  const [templatesTotal, setTemplatesTotal] = useState(0)
  const [templatesPage, setTemplatesPage] = useState(1)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateModule, setTemplateModule] = useState('')
  
  // Saved reports state
  const [savedReports, setSavedReports] = useState([])
  const [savedTotal, setSavedTotal] = useState(0)
  const [savedPage, setSavedPage] = useState(1)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  
  // Report viewer state
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [runningReport, setRunningReport] = useState(false)
  
  // Modules
  const [modules, setModules] = useState([])
  
  // Forms
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveFormData, setSaveFormData] = useState({
    name: '', description: '', is_favorite: false
  })
  
  const itemsPerPage = 20

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  // Load modules
  useEffect(() => {
    const loadModules = async () => {
      try {
        const response = await reportingAPI.getModules()
        setModules(response.data.modules || [])
      } catch (err) {
        console.error('Failed to load modules', err)
      }
    }
    loadModules()
  }, [])

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (templatesPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (templateSearch) params.search = templateSearch
      if (templateModule) params.module = templateModule
      const response = await reportTemplatesAPI.getAll(params)
      setTemplates(response.data.items || [])
      setTemplatesTotal(response.data.total || 0)
    } catch (err) {
      setError('Failed to load report templates')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [templatesPage, templateSearch, templateModule])

  // Load saved reports
  const loadSavedReports = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (savedPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (showFavoritesOnly) params.is_favorite = true
      const response = await savedReportsAPI.getAll(params)
      setSavedReports(response.data.items || [])
      setSavedTotal(response.data.total || 0)
    } catch (err) {
      setError('Failed to load saved reports')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [savedPage, showFavoritesOnly])

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'templates') loadTemplates()
    else if (activeTab === 'saved') loadSavedReports()
  }, [activeTab, loadTemplates, loadSavedReports])

  // Initialize default templates
  const handleInitTemplates = async () => {
    try {
      const response = await reportTemplatesAPI.initDefaults()
      showAlert(response.data.message)
      loadTemplates()
    } catch (err) {
      showAlert('Failed to initialize report templates', 'error')
    }
  }

  // Run a report
  const handleRunReport = async (template) => {
    try {
      setRunningReport(true)
      setSelectedTemplate(template)
      const response = await reportingAPI.runReport(template.id, {})
      setReportData(response.data)
      setActiveTab('viewer')
    } catch (err) {
      showAlert('Failed to run report', 'error')
      console.error(err)
    } finally {
      setRunningReport(false)
    }
  }

  // Export report
  const handleExportReport = async (templateId, format) => {
    try {
      const response = await reportingAPI.exportReport(templateId, format)
      
      // Create download link
      const blob = new Blob([response.data], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      showAlert(`Report exported as ${format.toUpperCase()}`)
    } catch (err) {
      showAlert('Failed to export report', 'error')
    }
  }

  // Save current report
  const handleSaveReport = async (e) => {
    e.preventDefault()
    if (!selectedTemplate) return
    
    try {
      await savedReportsAPI.create({
        template_id: selectedTemplate.id,
        name: saveFormData.name,
        description: saveFormData.description,
        is_favorite: saveFormData.is_favorite
      })
      showAlert('Report saved successfully')
      setShowSaveForm(false)
      setSaveFormData({ name: '', description: '', is_favorite: false })
    } catch (err) {
      showAlert('Failed to save report', 'error')
    }
  }

  // Toggle favorite
  const handleToggleFavorite = async (reportId) => {
    try {
      await savedReportsAPI.toggleFavorite(reportId)
      loadSavedReports()
    } catch (err) {
      showAlert('Failed to toggle favorite', 'error')
    }
  }

  // Delete saved report
  const handleDeleteSavedReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this saved report?')) return
    try {
      await savedReportsAPI.delete(reportId)
      showAlert('Saved report deleted')
      loadSavedReports()
    } catch (err) {
      showAlert('Failed to delete report', 'error')
    }
  }

  // Run saved report
  const handleRunSavedReport = async (savedReport) => {
    const template = savedReport.template
    if (template) {
      await handleRunReport(template)
    }
  }

  if (loading && templates.length === 0 && savedReports.length === 0) {
    return <div className="loading">Loading...</div>
  }
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          📊 Reporting
          <PageHelpCorner />
        </h1>
        <button onClick={handleInitTemplates} className="btn btn-secondary">Init Default Reports</button>
      </div>

      {/* Tabs */}
      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        {['templates', 'saved', 'viewer'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === tab ? 'var(--green-500)' : 'var(--brown-700)',
              color: activeTab === tab ? 'var(--brown-900)' : 'var(--brown-200)',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              marginRight: '2px',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'templates' ? 'Report Templates' : tab === 'saved' ? 'Saved Reports' : 'Report Viewer'}
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <>
          <div className="filters-row">
            <input
              type="text"
              placeholder="Search reports..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="search-input"
            />
            <select value={templateModule} onChange={(e) => setTemplateModule(e.target.value)} className="filter-select">
              <option value="">All Modules</option>
              {modules.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
            </select>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Report Name</th>
                  <th>Code</th>
                  <th>Module</th>
                  <th>Type</th>
                  <th>System</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(template => (
                  <tr key={template.id}>
                    <td>{template.name}</td>
                    <td><code>{template.code}</code></td>
                    <td style={{ textTransform: 'capitalize' }}>{template.module}</td>
                    <td style={{ textTransform: 'capitalize' }}>{template.report_type}</td>
                    <td>{template.is_system ? '🔒 System' : 'Custom'}</td>
                    <td className="actions-cell">
                      <button 
                        onClick={() => handleRunReport(template)} 
                        className="btn-icon" 
                        title="Run Report"
                        disabled={runningReport}
                      >
                        ▶️
                      </button>
                      <button 
                        onClick={() => handleExportReport(template.id, 'csv')} 
                        className="btn-icon" 
                        title="Export CSV"
                      >
                        📥
                      </button>
                      <button 
                        onClick={() => handleExportReport(template.id, 'json')} 
                        className="btn-icon" 
                        title="Export JSON"
                      >
                        📋
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={templatesPage} totalItems={templatesTotal} itemsPerPage={itemsPerPage} onPageChange={setTemplatesPage} />
        </>
      )}

      {/* Saved Reports Tab */}
      {activeTab === 'saved' && (
        <>
          <div className="filters-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={showFavoritesOnly}
                onChange={(e) => setShowFavoritesOnly(e.target.checked)}
              />
              Show favorites only
            </label>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Report Name</th>
                  <th>Template</th>
                  <th>Description</th>
                  <th>Last Run</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedReports.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                      No saved reports yet. Run a report and save it for quick access.
                    </td>
                  </tr>
                ) : (
                  savedReports.map(report => (
                    <tr key={report.id}>
                      <td>
                        <span style={{ cursor: 'pointer' }} onClick={() => handleToggleFavorite(report.id)}>
                          {report.is_favorite ? '⭐' : '☆'}
                        </span>
                        {' '}{report.name}
                      </td>
                      <td>{report.template?.name || '-'}</td>
                      <td>{report.description || '-'}</td>
                      <td>{report.last_run_at ? new Date(report.last_run_at).toLocaleString() : 'Never'}</td>
                      <td className="actions-cell">
                        <button onClick={() => handleRunSavedReport(report)} className="btn-icon" title="Run">▶️</button>
                        <button onClick={() => handleDeleteSavedReport(report.id)} className="btn-icon" title="Delete">🗑️</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={savedPage} totalItems={savedTotal} itemsPerPage={itemsPerPage} onPageChange={setSavedPage} />
        </>
      )}

      {/* Report Viewer Tab */}
      {activeTab === 'viewer' && (
        <div>
          {!reportData ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <h3>No Report Loaded</h3>
              <p style={{ color: 'var(--brown-300)' }}>Select a report template from the Templates tab and click Run to view it here.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0 }}>{selectedTemplate?.name || 'Report'}</h2>
                  <p style={{ margin: '0.5rem 0 0', color: 'var(--brown-300)', fontSize: '0.9rem' }}>
                    Generated at {new Date(reportData.generated_at).toLocaleString()} • {reportData.total_rows} rows
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowSaveForm(true)} className="btn btn-secondary">💾 Save Report</button>
                  <button onClick={() => handleExportReport(selectedTemplate.id, 'csv')} className="btn btn-secondary">📥 Export CSV</button>
                  <button onClick={() => handleRunReport(selectedTemplate)} className="btn btn-primary" disabled={runningReport}>
                    {runningReport ? 'Running...' : '🔄 Refresh'}
                  </button>
                </div>
              </div>

              {/* Save Report Modal */}
              {showSaveForm && (
                <div className="modal-overlay" onClick={() => setShowSaveForm(false)}>
                  <div className="modal" onClick={(e) => e.stopPropagation()}>
                    <h2>Save Report</h2>
                    <form onSubmit={handleSaveReport}>
                      <div className="form-group">
                        <label>Report Name *</label>
                        <input
                          type="text"
                          value={saveFormData.name}
                          onChange={(e) => setSaveFormData({ ...saveFormData, name: e.target.value })}
                          required
                          placeholder="My Custom Report"
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <textarea
                          value={saveFormData.description}
                          onChange={(e) => setSaveFormData({ ...saveFormData, description: e.target.value })}
                          rows="3"
                          placeholder="Optional description..."
                        />
                      </div>
                      <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={saveFormData.is_favorite}
                            onChange={(e) => setSaveFormData({ ...saveFormData, is_favorite: e.target.checked })}
                          />
                          Add to favorites
                        </label>
                      </div>
                      <div className="form-actions">
                        <button type="button" onClick={() => setShowSaveForm(false)} className="btn btn-secondary">Cancel</button>
                        <button type="submit" className="btn btn-primary">Save</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Report Data Table */}
              <div className="table-container" style={{ maxHeight: '600px', overflow: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {reportData.columns?.map((col, idx) => (
                        <th key={idx}>{col.label || col.key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.data?.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {reportData.columns?.map((col, colIdx) => (
                          <td key={colIdx}>
                            {typeof row[col.key] === 'number' 
                              ? (col.key.includes('total') || col.key.includes('cost') || col.key.includes('revenue') || col.key.includes('spent') || col.key.includes('profit') || col.key.includes('value') || col.key.includes('balance'))
                                ? `$${row[col.key].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : row[col.key].toLocaleString()
                              : row[col.key] || '-'
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Stats */}
              {reportData.data?.length > 0 && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--brown-700)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 0.5rem' }}>Summary</h4>
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ color: 'var(--brown-300)' }}>Total Rows:</span>
                      <strong style={{ marginLeft: '0.5rem' }}>{reportData.total_rows}</strong>
                    </div>
                    {reportData.columns?.filter(col => 
                      col.key.includes('total') || col.key.includes('revenue') || col.key.includes('cost')
                    ).slice(0, 3).map((col, idx) => {
                      const sum = reportData.data.reduce((acc, row) => acc + (parseFloat(row[col.key]) || 0), 0)
                      return (
                        <div key={idx}>
                          <span style={{ color: 'var(--brown-300)' }}>Sum {col.label}:</span>
                          <strong style={{ marginLeft: '0.5rem' }}>${sum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Reporting
