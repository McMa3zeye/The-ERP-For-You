import { useState, useEffect, useCallback } from 'react'
import { hrAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const STATUSES = ['Active', 'On Leave', 'Terminated']
const DEPARTMENTS = ['Production', 'Sales', 'Administration', 'Warehouse', 'Quality', 'Maintenance', 'Management']

function HR() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [alert, setAlert] = useState(null)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', department: '',
    job_title: '', hire_date: '', status: 'Active', hourly_rate: 0,
    salary: 0, address: '', emergency_contact: '', emergency_phone: '', notes: ''
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
      if (deptFilter) params.department = deptFilter
      const response = await hrAPI.getAll(params)
      setEmployees(response.data.items || [])
      setTotalItems(response.data.total || 0)
    } catch (err) {
      setError('Failed to load employees')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, statusFilter, deptFilter])

  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = { ...formData }
      if (!submitData.hire_date) delete submitData.hire_date
      if (editingEmployee) {
        await hrAPI.update(editingEmployee.id, submitData)
        showAlert('Employee updated successfully')
      } else {
        await hrAPI.create(submitData)
        showAlert('Employee created successfully')
      }
      setShowForm(false)
      setEditingEmployee(null)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(err.message || 'Failed to save employee', 'error')
    }
  }

  const handleEdit = (emp) => {
    setEditingEmployee(emp)
    setFormData({
      first_name: emp.first_name || '', last_name: emp.last_name || '',
      email: emp.email || '', phone: emp.phone || '',
      department: emp.department || '', job_title: emp.job_title || '',
      hire_date: emp.hire_date ? emp.hire_date.split('T')[0] : '',
      status: emp.status || 'Active', hourly_rate: emp.hourly_rate || 0,
      salary: emp.salary || 0, address: emp.address || '',
      emergency_contact: emp.emergency_contact || '',
      emergency_phone: emp.emergency_phone || '', notes: emp.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await hrAPI.delete(id)
      showAlert('Employee deleted successfully')
      loadData()
    } catch (err) {
      showAlert('Failed to delete employee', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      first_name: '', last_name: '', email: '', phone: '', department: '',
      job_title: '', hire_date: '', status: 'Active', hourly_rate: 0,
      salary: 0, address: '', emergency_contact: '', emergency_phone: '', notes: ''
    })
  }

  if (loading && employees.length === 0) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          Human Resources
          <PageHelpCorner />
        </h1>
        <button onClick={() => { setShowForm(true); setEditingEmployee(null); resetForm() }} className="btn btn-primary">+ New Employee</button>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="filter-select">
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingEmployee ? 'Edit Employee' : 'New Employee'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>First Name *</label>
                  <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required />
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
                  <label>Department</label>
                  <select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })}>
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Job Title</label>
                  <input type="text" value={formData.job_title} onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Hire Date</label>
                  <input type="date" value={formData.hire_date} onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Hourly Rate</label>
                  <input type="number" step="0.01" value={formData.hourly_rate} onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Salary</label>
                  <input type="number" step="0.01" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Emergency Contact</label>
                  <input type="text" value={formData.emergency_contact} onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Emergency Phone</label>
                  <input type="text" value={formData.emergency_phone} onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows="2" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="2" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingEmployee ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee #</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Job Title</th>
              <th>Status</th>
              <th>Hire Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id}>
                <td>{emp.employee_number}</td>
                <td>{emp.first_name} {emp.last_name}</td>
                <td>{emp.email || '-'}</td>
                <td>{emp.department || '-'}</td>
                <td>{emp.job_title || '-'}</td>
                <td><span className={`status-badge status-${emp.status?.toLowerCase().replace(' ', '-')}`}>{emp.status}</span></td>
                <td>{emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '-'}</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(emp)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(emp.id)} className="btn-icon" title="Delete">🗑️</button>
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

export default HR
