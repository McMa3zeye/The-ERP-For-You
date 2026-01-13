import { useState, useEffect, useCallback } from 'react'
import { assetsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const STATUSES = ['Active', 'In Maintenance', 'Retired', 'Disposed']
const CATEGORIES = ['Equipment', 'Vehicle', 'IT', 'Furniture', 'Tools', 'Machinery', 'Other']

function Assets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [alert, setAlert] = useState(null)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    name: '', category: '', serial_number: '', manufacturer: '', model: '',
    purchase_date: '', purchase_cost: 0, current_value: 0, warranty_expiry: '',
    location: '', assigned_to: '', status: 'Active',
    last_maintenance_date: '', next_maintenance_date: '', notes: ''
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
      if (categoryFilter) params.category = categoryFilter
      const response = await assetsAPI.getAll(params)
      setAssets(response.data.items || [])
      setTotalItems(response.data.total || 0)
    } catch (err) {
      setError('Failed to load assets')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, statusFilter, categoryFilter])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = { ...formData }
      const dateFields = ['purchase_date', 'warranty_expiry', 'last_maintenance_date', 'next_maintenance_date']
      dateFields.forEach(f => { if (!submitData[f]) delete submitData[f] })
      if (editingAsset) {
        await assetsAPI.update(editingAsset.id, submitData)
        showAlert('Asset updated successfully')
      } else {
        await assetsAPI.create(submitData)
        showAlert('Asset created successfully')
      }
      setShowForm(false)
      setEditingAsset(null)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(err.message || 'Failed to save asset', 'error')
    }
  }

  const handleEdit = (asset) => {
    setEditingAsset(asset)
    setFormData({
      name: asset.name || '', category: asset.category || '',
      serial_number: asset.serial_number || '', manufacturer: asset.manufacturer || '',
      model: asset.model || '',
      purchase_date: asset.purchase_date ? asset.purchase_date.split('T')[0] : '',
      purchase_cost: asset.purchase_cost || 0, current_value: asset.current_value || 0,
      warranty_expiry: asset.warranty_expiry ? asset.warranty_expiry.split('T')[0] : '',
      location: asset.location || '', assigned_to: asset.assigned_to || '',
      status: asset.status || 'Active',
      last_maintenance_date: asset.last_maintenance_date ? asset.last_maintenance_date.split('T')[0] : '',
      next_maintenance_date: asset.next_maintenance_date ? asset.next_maintenance_date.split('T')[0] : '',
      notes: asset.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await assetsAPI.delete(id)
      showAlert('Asset deleted successfully')
      loadData()
    } catch (err) {
      showAlert('Failed to delete asset', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '', category: '', serial_number: '', manufacturer: '', model: '',
      purchase_date: '', purchase_cost: 0, current_value: 0, warranty_expiry: '',
      location: '', assigned_to: '', status: 'Active',
      last_maintenance_date: '', next_maintenance_date: '', notes: ''
    })
  }

  const getStatusColor = (status) => {
    const colors = { Active: '#22c55e', 'In Maintenance': '#f59e0b', Retired: '#6b7280', Disposed: '#ef4444' }
    return colors[status] || '#6b7280'
  }

  if (loading && assets.length === 0) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          Assets & Maintenance
          <PageHelpCorner />
        </h1>
        <button onClick={() => { setShowForm(true); setEditingAsset(null); resetForm() }} className="btn btn-primary">+ New Asset</button>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Search assets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="filter-select">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingAsset ? 'Edit Asset' : 'New Asset'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Asset Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                    <option value="">Select Category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Serial Number</label>
                  <input type="text" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Manufacturer</label>
                  <input type="text" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Model</label>
                  <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Purchase Date</label>
                  <input type="date" value={formData.purchase_date} onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Purchase Cost</label>
                  <input type="number" step="0.01" value={formData.purchase_cost} onChange={(e) => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Current Value</label>
                  <input type="number" step="0.01" value={formData.current_value} onChange={(e) => setFormData({ ...formData, current_value: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Warranty Expiry</label>
                  <input type="date" value={formData.warranty_expiry} onChange={(e) => setFormData({ ...formData, warranty_expiry: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Assigned To</label>
                  <input type="text" value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Last Maintenance</label>
                  <input type="date" value={formData.last_maintenance_date} onChange={(e) => setFormData({ ...formData, last_maintenance_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Next Maintenance</label>
                  <input type="date" value={formData.next_maintenance_date} onChange={(e) => setFormData({ ...formData, next_maintenance_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingAsset ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset #</th>
              <th>Name</th>
              <th>Category</th>
              <th>Serial</th>
              <th>Status</th>
              <th>Location</th>
              <th>Value</th>
              <th>Next Maint.</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map(asset => (
              <tr key={asset.id}>
                <td>{asset.asset_number}</td>
                <td>{asset.name}</td>
                <td>{asset.category || '-'}</td>
                <td>{asset.serial_number || '-'}</td>
                <td><span className="status-badge" style={{ backgroundColor: getStatusColor(asset.status) }}>{asset.status}</span></td>
                <td>{asset.location || '-'}</td>
                <td>${(asset.current_value || 0).toLocaleString()}</td>
                <td>{asset.next_maintenance_date ? new Date(asset.next_maintenance_date).toLocaleDateString() : '-'}</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(asset)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(asset.id)} className="btn-icon" title="Delete">🗑️</button>
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

export default Assets
