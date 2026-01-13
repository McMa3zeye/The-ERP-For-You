import { useState, useEffect, useCallback } from 'react'
import { timeAttendanceAPI, hrAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const ENTRY_TYPES = ['Regular', 'Overtime', 'PTO', 'Sick', 'Holiday', 'Training']
const STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected']

function TimeAttendance() {
  const [entries, setEntries] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [alert, setAlert] = useState(null)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    employee_name: '', employee_id: '', date: '', clock_in: '', clock_out: '',
    hours_worked: 0, overtime_hours: 0, break_duration: 0,
    entry_type: 'Regular', status: 'Draft', notes: ''
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadEmployees = useCallback(async () => {
    try {
      const response = await hrAPI.getAll({ limit: 100 })
      setEmployees(response.data.items || [])
    } catch (err) {
      console.error('Failed to load employees', err)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (currentPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.entry_type = typeFilter
      const response = await timeAttendanceAPI.getAll(params)
      setEntries(response.data.items || [])
      setTotalItems(response.data.total || 0)
    } catch (err) {
      setError('Failed to load time entries')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, statusFilter, typeFilter])

  useEffect(() => { loadEmployees() }, [loadEmployees])
  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = { ...formData }
      if (submitData.employee_id) submitData.employee_id = parseInt(submitData.employee_id)
      else delete submitData.employee_id
      submitData.date = new Date(submitData.date).toISOString()
      if (submitData.clock_in) submitData.clock_in = new Date(`${formData.date}T${submitData.clock_in}`).toISOString()
      else delete submitData.clock_in
      if (submitData.clock_out) submitData.clock_out = new Date(`${formData.date}T${submitData.clock_out}`).toISOString()
      else delete submitData.clock_out
      if (editingEntry) {
        await timeAttendanceAPI.update(editingEntry.id, submitData)
        showAlert('Time entry updated successfully')
      } else {
        await timeAttendanceAPI.create(submitData)
        showAlert('Time entry created successfully')
      }
      setShowForm(false)
      setEditingEntry(null)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(err.message || 'Failed to save time entry', 'error')
    }
  }

  const handleEdit = (entry) => {
    setEditingEntry(entry)
    setFormData({
      employee_name: entry.employee_name || '',
      employee_id: entry.employee_id || '',
      date: entry.date ? entry.date.split('T')[0] : '',
      clock_in: entry.clock_in ? new Date(entry.clock_in).toTimeString().slice(0, 5) : '',
      clock_out: entry.clock_out ? new Date(entry.clock_out).toTimeString().slice(0, 5) : '',
      hours_worked: entry.hours_worked || 0,
      overtime_hours: entry.overtime_hours || 0,
      break_duration: entry.break_duration || 0,
      entry_type: entry.entry_type || 'Regular',
      status: entry.status || 'Draft',
      notes: entry.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await timeAttendanceAPI.delete(id)
      showAlert('Time entry deleted successfully')
      loadData()
    } catch (err) {
      showAlert('Failed to delete time entry', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      employee_name: '', employee_id: '', date: new Date().toISOString().split('T')[0],
      clock_in: '', clock_out: '', hours_worked: 0, overtime_hours: 0, break_duration: 0,
      entry_type: 'Regular', status: 'Draft', notes: ''
    })
  }

  const handleEmployeeSelect = (employeeId) => {
    const emp = employees.find(e => e.id === parseInt(employeeId))
    if (emp) {
      setFormData({ ...formData, employee_id: employeeId, employee_name: `${emp.first_name} ${emp.last_name}` })
    } else {
      setFormData({ ...formData, employee_id: employeeId })
    }
  }

  const getStatusColor = (status) => {
    const colors = { Draft: '#6b7280', Submitted: '#3b82f6', Approved: '#22c55e', Rejected: '#ef4444' }
    return colors[status] || '#6b7280'
  }

  if (loading && entries.length === 0) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          Time & Attendance
          <PageHelpCorner />
        </h1>
        <button onClick={() => { setShowForm(true); setEditingEntry(null); resetForm() }} className="btn btn-primary">+ New Entry</button>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Search entries..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="filter-select">
          <option value="">All Types</option>
          {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingEntry ? 'Edit Time Entry' : 'New Time Entry'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Employee</label>
                  <select value={formData.employee_id} onChange={(e) => handleEmployeeSelect(e.target.value)}>
                    <option value="">Select or Enter Name</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Employee Name *</label>
                  <input type="text" value={formData.employee_name} onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Entry Type</label>
                  <select value={formData.entry_type} onChange={(e) => setFormData({ ...formData, entry_type: e.target.value })}>
                    {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Clock In</label>
                  <input type="time" value={formData.clock_in} onChange={(e) => setFormData({ ...formData, clock_in: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Clock Out</label>
                  <input type="time" value={formData.clock_out} onChange={(e) => setFormData({ ...formData, clock_out: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Hours Worked</label>
                  <input type="number" step="0.01" value={formData.hours_worked} onChange={(e) => setFormData({ ...formData, hours_worked: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Overtime Hours</label>
                  <input type="number" step="0.01" value={formData.overtime_hours} onChange={(e) => setFormData({ ...formData, overtime_hours: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Break (minutes)</label>
                  <input type="number" value={formData.break_duration} onChange={(e) => setFormData({ ...formData, break_duration: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingEntry ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Entry #</th>
              <th>Employee</th>
              <th>Date</th>
              <th>Type</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Hours</th>
              <th>OT</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id}>
                <td>{entry.entry_number}</td>
                <td>{entry.employee_name}</td>
                <td>{entry.date ? new Date(entry.date).toLocaleDateString() : '-'}</td>
                <td>{entry.entry_type}</td>
                <td>{entry.clock_in ? new Date(entry.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td>{entry.clock_out ? new Date(entry.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td>{entry.hours_worked}h</td>
                <td>{entry.overtime_hours}h</td>
                <td><span className="status-badge" style={{ backgroundColor: getStatusColor(entry.status) }}>{entry.status}</span></td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(entry)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(entry.id)} className="btn-icon" title="Delete">🗑️</button>
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

export default TimeAttendance
