import { useState, useEffect, useCallback } from 'react'
import { leadsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']
const STAGES = ['Lead', 'Opportunity', 'Customer']
const SOURCES = ['Web', 'Referral', 'Trade Show', 'Cold Call', 'Email Campaign', 'Social Media', 'Other']

function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [alert, setAlert] = useState(null)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    company_name: '', contact_name: '', email: '', phone: '', source: '',
    status: 'New', stage: 'Lead', estimated_value: 0, probability: 0,
    expected_close_date: '', assigned_to: '', notes: ''
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (currentPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      if (stageFilter) params.stage = stageFilter
      const response = await leadsAPI.getAll(params)
      setLeads(response.data.items || [])
      setTotalItems(response.data.total || 0)
    } catch (err) {
      setError('Failed to load leads')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, statusFilter, stageFilter])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = { ...formData }
      if (!submitData.expected_close_date) delete submitData.expected_close_date
      if (editingLead) {
        await leadsAPI.update(editingLead.id, submitData)
        showAlert('Lead updated successfully')
      } else {
        await leadsAPI.create(submitData)
        showAlert('Lead created successfully')
      }
      setShowForm(false)
      setEditingLead(null)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(err.message || 'Failed to save lead', 'error')
    }
  }

  const handleEdit = (lead) => {
    setEditingLead(lead)
    setFormData({
      company_name: lead.company_name || '', contact_name: lead.contact_name || '',
      email: lead.email || '', phone: lead.phone || '', source: lead.source || '',
      status: lead.status || 'New', stage: lead.stage || 'Lead',
      estimated_value: lead.estimated_value || 0, probability: lead.probability || 0,
      expected_close_date: lead.expected_close_date ? lead.expected_close_date.split('T')[0] : '',
      assigned_to: lead.assigned_to || '', notes: lead.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await leadsAPI.delete(id)
      showAlert('Lead deleted successfully')
      loadData()
    } catch (err) {
      showAlert('Failed to delete lead', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      company_name: '', contact_name: '', email: '', phone: '', source: '',
      status: 'New', stage: 'Lead', estimated_value: 0, probability: 0,
      expected_close_date: '', assigned_to: '', notes: ''
    })
  }

  const getStatusColor = (status) => {
    const colors = { New: '#3b82f6', Contacted: '#8b5cf6', Qualified: '#10b981', Proposal: '#f59e0b', Negotiation: '#f97316', Won: '#22c55e', Lost: '#ef4444' }
    return colors[status] || '#6b7280'
  }

  if (loading && leads.length === 0) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          Leads & Sales Pipeline
          <PageHelpCorner />
        </h1>
        <button onClick={() => { setShowForm(true); setEditingLead(null); resetForm() }} className="btn btn-primary">+ New Lead</button>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Search leads..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="filter-select">
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingLead ? 'Edit Lead' : 'New Lead'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Company Name *</label>
                  <input type="text" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Contact Name</label>
                  <input type="text" value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Source</label>
                  <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })}>
                    <option value="">Select Source</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Stage</label>
                  <select value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value })}>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Estimated Value</label>
                  <input type="number" step="0.01" value={formData.estimated_value} onChange={(e) => setFormData({ ...formData, estimated_value: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Probability (%)</label>
                  <input type="number" min="0" max="100" value={formData.probability} onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Expected Close Date</label>
                  <input type="date" value={formData.expected_close_date} onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Assigned To</label>
                  <input type="text" value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingLead ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Lead #</th>
              <th>Company</th>
              <th>Contact</th>
              <th>Source</th>
              <th>Status</th>
              <th>Stage</th>
              <th>Value</th>
              <th>Probability</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr key={lead.id}>
                <td>{lead.lead_number}</td>
                <td>{lead.company_name}</td>
                <td>{lead.contact_name || '-'}</td>
                <td>{lead.source || '-'}</td>
                <td><span className="status-badge" style={{ backgroundColor: getStatusColor(lead.status) }}>{lead.status}</span></td>
                <td>{lead.stage}</td>
                <td>${(lead.estimated_value || 0).toLocaleString()}</td>
                <td>{lead.probability}%</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(lead)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(lead.id)} className="btn-icon" title="Delete">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination currentPage={currentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
    </div>
  )
}

export default Leads
