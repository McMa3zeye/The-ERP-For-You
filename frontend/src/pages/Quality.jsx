import { useState, useEffect, useCallback } from 'react'
import { qualityAPI, productsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const INSPECTION_TYPES = ['Incoming', 'In-Process', 'Final', 'Audit']
const STATUSES = ['Pending', 'In Progress', 'Passed', 'Failed', 'On Hold']

function Quality() {
  const [inspections, setInspections] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingInspection, setEditingInspection] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [alert, setAlert] = useState(null)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    inspection_type: 'Incoming', reference_type: '', reference_id: null,
    product_id: '', quantity_inspected: 0, quantity_passed: 0, quantity_failed: 0,
    status: 'Pending', inspector: '', result_notes: ''
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      const response = await productsAPI.getAll({ limit: 100 })
      setProducts(response.data.items || [])
    } catch (err) {
      console.error('Failed to load products', err)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (currentPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.inspection_type = typeFilter
      const response = await qualityAPI.getAll(params)
      setInspections(response.data.items || [])
      setTotalItems(response.data.total || 0)
    } catch (err) {
      setError('Failed to load inspections')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, statusFilter, typeFilter])

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = { ...formData }
      if (submitData.product_id) submitData.product_id = parseInt(submitData.product_id)
      else delete submitData.product_id
      if (editingInspection) {
        await qualityAPI.update(editingInspection.id, submitData)
        showAlert('Inspection updated successfully')
      } else {
        await qualityAPI.create(submitData)
        showAlert('Inspection created successfully')
      }
      setShowForm(false)
      setEditingInspection(null)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(err.message || 'Failed to save inspection', 'error')
    }
  }

  const handleEdit = (inspection) => {
    setEditingInspection(inspection)
    setFormData({
      inspection_type: inspection.inspection_type || 'Incoming',
      reference_type: inspection.reference_type || '',
      reference_id: inspection.reference_id || null,
      product_id: inspection.product_id || '',
      quantity_inspected: inspection.quantity_inspected || 0,
      quantity_passed: inspection.quantity_passed || 0,
      quantity_failed: inspection.quantity_failed || 0,
      status: inspection.status || 'Pending',
      inspector: inspection.inspector || '',
      result_notes: inspection.result_notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await qualityAPI.delete(id)
      showAlert('Inspection deleted successfully')
      loadData()
    } catch (err) {
      showAlert('Failed to delete inspection', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      inspection_type: 'Incoming', reference_type: '', reference_id: null,
      product_id: '', quantity_inspected: 0, quantity_passed: 0, quantity_failed: 0,
      status: 'Pending', inspector: '', result_notes: ''
    })
  }

  const getStatusColor = (status) => {
    const colors = { Pending: '#f59e0b', 'In Progress': '#3b82f6', Passed: '#22c55e', Failed: '#ef4444', 'On Hold': '#6b7280' }
    return colors[status] || '#6b7280'
  }

  if (loading && inspections.length === 0) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          Quality Control
          <PageHelpCorner />
        </h1>
        <button onClick={() => { setShowForm(true); setEditingInspection(null); resetForm() }} className="btn btn-primary">+ New Inspection</button>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Search inspections..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="filter-select">
          <option value="">All Types</option>
          {INSPECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingInspection ? 'Edit Inspection' : 'New Inspection'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Inspection Type</label>
                  <select value={formData.inspection_type} onChange={(e) => setFormData({ ...formData, inspection_type: e.target.value })}>
                    {INSPECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Product</label>
                  <select value={formData.product_id} onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Inspector</label>
                  <input type="text" value={formData.inspector} onChange={(e) => setFormData({ ...formData, inspector: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Quantity Inspected</label>
                  <input type="number" step="0.01" value={formData.quantity_inspected} onChange={(e) => setFormData({ ...formData, quantity_inspected: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Quantity Passed</label>
                  <input type="number" step="0.01" value={formData.quantity_passed} onChange={(e) => setFormData({ ...formData, quantity_passed: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Quantity Failed</label>
                  <input type="number" step="0.01" value={formData.quantity_failed} onChange={(e) => setFormData({ ...formData, quantity_failed: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="form-group">
                <label>Result Notes</label>
                <textarea value={formData.result_notes} onChange={(e) => setFormData({ ...formData, result_notes: e.target.value })} rows="3" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingInspection ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Inspection #</th>
              <th>Type</th>
              <th>Product</th>
              <th>Status</th>
              <th>Inspected</th>
              <th>Passed</th>
              <th>Failed</th>
              <th>Inspector</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inspections.map(insp => (
              <tr key={insp.id}>
                <td>{insp.inspection_number}</td>
                <td>{insp.inspection_type}</td>
                <td>{insp.product?.name || '-'}</td>
                <td><span className="status-badge" style={{ backgroundColor: getStatusColor(insp.status) }}>{insp.status}</span></td>
                <td>{insp.quantity_inspected}</td>
                <td>{insp.quantity_passed}</td>
                <td>{insp.quantity_failed}</td>
                <td>{insp.inspector || '-'}</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(insp)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(insp.id)} className="btn-icon" title="Delete">🗑️</button>
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

export default Quality
