import { useState, useEffect, useCallback } from 'react'
import { projectsAPI, customersAPI } from '../services/api'
import Pagination from '../components/Pagination'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'

function Projects() {
  const [projects, setProjects] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [showTasks, setShowTasks] = useState(false)
  const [tasks, setTasks] = useState([])
  const [editingProject, setEditingProject] = useState(null)
  const [alert, setAlert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [filterStatus, setFilterStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    project_code: '',
    name: '',
    description: '',
    customer_id: '',
    status: 'Planning',
    start_date: '',
    end_date: '',
    budget: 0,
    owner: '',
    notes: '',
  })

  const [taskForm, setTaskForm] = useState({
    task_name: '',
    description: '',
    status: 'Not Started',
    priority: 'Normal',
    due_date: '',
    assigned_to: '',
  })

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 4000)
  }

  const loadCustomers = async () => {
    try {
      // Backend limit is 100, so fetch in batches if needed
      const response = await customersAPI.getAll({ limit: 100 })
      setCustomers(Array.isArray(response.data) ? response.data : (response.data.items || []))
    } catch (error) {
      console.error('Error loading customers:', error)
    }
  }

  const loadData = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const params = { skip: (page - 1) * itemsPerPage, limit: itemsPerPage }
      if (debouncedSearchTerm) params.search = debouncedSearchTerm
      if (filterStatus) params.status = filterStatus

      const response = await projectsAPI.getAll(params)
      if (response.data.items) {
        setProjects(response.data.items)
        setTotalItems(response.data.total || 0)
      } else {
        setProjects(response.data)
        setTotalItems(response.data.length)
      }
    } catch (error) {
      showAlert('Error loading projects: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearchTerm, filterStatus, itemsPerPage])

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterStatus])

  useEffect(() => {
    loadData(currentPage)
  }, [currentPage, loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.project_code) {
      showAlert('Project name and code are required', 'error')
      return
    }

    try {
      if (editingProject) {
        await projectsAPI.update(editingProject.id, formData)
        showAlert('Project updated successfully')
      } else {
        await projectsAPI.create({
          ...formData,
          customer_id: formData.customer_id ? parseInt(formData.customer_id) : null,
          budget: parseFloat(formData.budget) || 0,
          start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
          end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        })
        showAlert('Project created successfully!')
      }
      resetForm()
      loadData()
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleViewTasks = async (project) => {
    setSelectedProject(project)
    try {
      const response = await projectsAPI.getById(project.id)
      setTasks(response.data.tasks || [])
      setShowTasks(true)
    } catch (error) {
      showAlert('Error loading tasks: ' + error.message, 'error')
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!selectedProject) return

    try {
      await projectsAPI.createTask(selectedProject.id, {
        ...taskForm,
        due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : null,
      })
      showAlert('Task created successfully!')
      setTaskForm({
        task_name: '',
        description: '',
        status: 'Not Started',
        priority: 'Normal',
        due_date: '',
        assigned_to: '',
      })
      handleViewTasks(selectedProject)
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleEdit = (project) => {
    setEditingProject(project)
    setFormData({
      project_code: project.project_code,
      name: project.name,
      description: project.description || '',
      customer_id: project.customer_id || '',
      status: project.status,
      start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '',
      end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '',
      budget: project.budget || 0,
      owner: project.owner || '',
      notes: project.notes || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return
    try {
      await projectsAPI.delete(id)
      showAlert('Project deleted successfully')
      loadData()
    } catch (error) {
      showAlert('Error deleting project: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      project_code: '',
      name: '',
      description: '',
      customer_id: '',
      status: 'Planning',
      start_date: '',
      end_date: '',
      budget: 0,
      owner: '',
      notes: '',
    })
    setEditingProject(null)
    setShowForm(false)
  }

  if (loading && projects.length === 0) {
    return <div className="spinner"></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>📋 Projects</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Create Project'}
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      <div className="search-bar">
        <input
          type="search"
          placeholder="🔍 Search by project name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: '2', minWidth: '250px' }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Planning">Planning</option>
          <option value="Active">Active</option>
          <option value="On Hold">On Hold</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        {(searchTerm || filterStatus) && (
          <button className="btn btn-secondary" onClick={() => {
            setSearchTerm('')
            setFilterStatus('')
          }}>
            🗑️ Clear
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2>{editingProject ? '✏️ Edit Project' : '➕ New Project'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>📋 Project Code *</label>
                <input
                  type="text"
                  value={formData.project_code}
                  onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                  required
                  disabled={!!editingProject}
                />
              </div>
              <div className="form-group">
                <label>📝 Project Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>📄 Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>👤 Customer (Optional)</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                >
                  <option value="">Select Customer...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>📊 Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Planning">Planning</option>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>📅 Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>📅 End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>💰 Budget</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>👤 Owner</label>
              <input
                type="text"
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                placeholder="Project owner name"
              />
            </div>

            <div className="form-group">
              <label>📝 Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="4"
              />
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">
                {editingProject ? '💾 Update' : '✨ Create'} Project
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                ❌ Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showTasks && selectedProject && (
        <div className="modal-overlay" onClick={() => setShowTasks(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>📋 Tasks: {selectedProject.name}</h2>
              <button className="btn btn-secondary" onClick={() => setShowTasks(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateTask} style={{ marginBottom: '1.5rem' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>📝 Task Name *</label>
                  <input
                    type="text"
                    value={taskForm.task_name}
                    onChange={(e) => setTaskForm({ ...taskForm, task_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>⚡ Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>📅 Due Date</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>&nbsp;</label>
                  <button type="submit" className="btn btn-success">➕ Add Task</button>
                </div>
              </div>
              <div className="form-group">
                <label>📄 Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows="2"
                />
              </div>
            </form>

            <h3>Current Tasks ({tasks.length})</h3>
            {tasks.length === 0 ? (
              <p style={{ color: 'var(--brown-200)' }}>No tasks added yet.</p>
            ) : (
              <table style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th>Task Name</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.id}>
                      <td>{task.task_name}</td>
                      <td><span className={`status-badge status-${task.status.toLowerCase().replace(/\s+/g, '-')}`}>{task.status}</span></td>
                      <td>{task.priority}</td>
                      <td>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</td>
                      <td>{task.assigned_to || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h2>📋 Projects ({totalItems})</h2>
        {projects.length === 0 && !loading ? (
          <p>No projects found. Create your first project above.</p>
        ) : (
          <>
            <SortableTable
              data={projects}
              columns={[
                { key: 'project_code', label: 'Code', render: (value) => <strong>{value}</strong> },
                { key: 'name', label: 'Project Name' },
                { key: 'customer', label: 'Customer', render: (_, row) => row.customer?.company_name || '-' },
                { key: 'status', label: 'Status', render: (value) => <span className={`status-badge status-${value.toLowerCase().replace(/\s+/g, '-')}`}>{value}</span> },
                { key: 'budget', label: 'Budget', render: (value) => `$${parseFloat(value || 0).toFixed(2)}` },
                { key: 'owner', label: 'Owner', render: (value) => value || '-' },
                {
                  key: 'actions',
                  label: 'Actions',
                  sortable: false,
                  render: (_, row) => (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-info" onClick={() => handleViewTasks(row)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                        📋 Tasks
                      </button>
                      <button className="btn btn-primary" onClick={() => handleEdit(row)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                        ✏️
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDelete(row.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                        🗑️
                      </button>
                    </div>
                  )
                }
              ]}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalItems / itemsPerPage)}
              onPageChange={(page) => {
                setCurrentPage(page)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default Projects
