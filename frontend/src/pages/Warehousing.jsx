import { useState, useEffect, useCallback } from 'react'
import { warehousingAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const LOCATION_TYPES = ['Storage', 'Receiving', 'Shipping', 'Staging', 'Quarantine', 'Production']

function Warehousing() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [alert, setAlert] = useState(null)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    name: '', warehouse: '', zone: '', aisle: '', rack: '', bin: '',
    location_type: 'Storage', capacity: 0, is_active: true, notes: ''
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
      if (typeFilter) params.location_type = typeFilter
      const response = await warehousingAPI.getAll(params)
      setLocations(response.data.items || [])
      setTotalItems(response.data.total || 0)
    } catch (err) {
      setError('Failed to load locations')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, typeFilter])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingLocation) {
        await warehousingAPI.update(editingLocation.id, formData)
        showAlert('Location updated successfully')
      } else {
        await warehousingAPI.create(formData)
        showAlert('Location created successfully')
      }
      setShowForm(false)
      setEditingLocation(null)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(err.message || 'Failed to save location', 'error')
    }
  }

  const handleEdit = (location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name || '', warehouse: location.warehouse || '',
      zone: location.zone || '', aisle: location.aisle || '',
      rack: location.rack || '', bin: location.bin || '',
      location_type: location.location_type || 'Storage',
      capacity: location.capacity || 0, is_active: location.is_active !== false,
      notes: location.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await warehousingAPI.delete(id)
      showAlert('Location deleted successfully')
      loadData()
    } catch (err) {
      showAlert('Failed to delete location', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '', warehouse: '', zone: '', aisle: '', rack: '', bin: '',
      location_type: 'Storage', capacity: 0, is_active: true, notes: ''
    })
  }

  if (loading && locations.length === 0) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          Warehousing
          <PageHelpCorner />
        </h1>
        <button onClick={() => { setShowForm(true); setEditingLocation(null); resetForm() }} className="btn btn-primary">+ New Location</button>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Search locations..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="filter-select">
          <option value="">All Types</option>
          {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingLocation ? 'Edit Location' : 'New Location'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Location Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Warehouse</label>
                  <input type="text" value={formData.warehouse} onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Zone</label>
                  <input type="text" value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Aisle</label>
                  <input type="text" value={formData.aisle} onChange={(e) => setFormData({ ...formData, aisle: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Rack</label>
                  <input type="text" value={formData.rack} onChange={(e) => setFormData({ ...formData, rack: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Bin</label>
                  <input type="text" value={formData.bin} onChange={(e) => setFormData({ ...formData, bin: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Location Type</label>
                  <select value={formData.location_type} onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}>
                    {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Capacity</label>
                  <input type="number" step="0.01" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>
                    <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                    Active
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingLocation ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Warehouse</th>
              <th>Zone</th>
              <th>Aisle/Rack/Bin</th>
              <th>Type</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.map(loc => (
              <tr key={loc.id}>
                <td>{loc.location_code}</td>
                <td>{loc.name}</td>
                <td>{loc.warehouse || '-'}</td>
                <td>{loc.zone || '-'}</td>
                <td>{[loc.aisle, loc.rack, loc.bin].filter(Boolean).join('/') || '-'}</td>
                <td>{loc.location_type}</td>
                <td>{loc.capacity}</td>
                <td><span className={`status-badge ${loc.is_active ? 'active' : 'inactive'}`}>{loc.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(loc)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(loc.id)} className="btn-icon" title="Delete">🗑️</button>
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

export default Warehousing
