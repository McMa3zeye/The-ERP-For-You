import { useState, useEffect, useCallback } from 'react'
import { supportTicketsAPI, customersAPI } from '../services/api'
import Pagination from '../components/Pagination'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'

function SupportTickets() {
  const [tickets, setTickets] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTicket, setEditingTicket] = useState(null)
  const [alert, setAlert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    customer_id: '',
    subject: '',
    description: '',
    category: '',
    priority: 'Medium',
    status: 'Open',
    assigned_to: '',
    resolution: '',
  })

  const loadCustomers = async () => {
    try {
      const response = await customersAPI.getAll({ limit: 100 })
      setCustomers(Array.isArray(response.data) ? response.data : (response.data.items || []))
    } catch (error) {
      console.error('Error loading customers:', error)
    }
  }

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 4000)
  }

  const loadData = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const params = { skip: (page - 1) * itemsPerPage, limit: itemsPerPage }
      if (filterStatus) params.status = filterStatus
      if (filterPriority) params.priority = filterPriority
      if (filterCategory) params.category = filterCategory

      const response = await supportTicketsAPI.getAll(params)
      if (response.data.items) {
        setTickets(response.data.items)
        setTotalItems(response.data.total || 0)
      } else {
        setTickets(response.data)
        setTotalItems(response.data.length)
      }
    } catch (error) {
      showAlert('Error loading tickets: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterPriority, filterCategory, itemsPerPage])

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterStatus, filterPriority, filterCategory])

  useEffect(() => {
    loadData(currentPage)
  }, [currentPage, loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.subject || !formData.description) {
      showAlert('Subject and description are required', 'error')
      return
    }

    try {
      if (editingTicket) {
        await supportTicketsAPI.update(editingTicket.id, formData)
        showAlert('Ticket updated successfully')
      } else {
        await supportTicketsAPI.create({
          ...formData,
          customer_id: formData.customer_id ? parseInt(formData.customer_id) : null,
        })
        showAlert('Ticket created successfully!')
      }
      resetForm()
      loadData()
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleEdit = (ticket) => {
    setEditingTicket(ticket)
    setFormData({
      customer_id: ticket.customer_id || '',
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category || '',
      priority: ticket.priority,
      status: ticket.status,
      assigned_to: ticket.assigned_to || '',
      resolution: ticket.resolution || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return
    try {
      await supportTicketsAPI.delete(id)
      showAlert('Ticket deleted successfully')
      loadData()
    } catch (error) {
      showAlert('Error deleting ticket: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      customer_id: '',
      subject: '',
      description: '',
      category: '',
      priority: 'Medium',
      status: 'Open',
      assigned_to: '',
      resolution: '',
    })
    setEditingTicket(null)
    setShowForm(false)
  }

  const categories = [...new Set(tickets.map(t => t.category).filter(Boolean))]

  if (loading && tickets.length === 0) {
    return <div className="spinner"></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>🎫 Support Tickets</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Create Ticket'}
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      <div className="search-bar">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
        {(filterCategory || filterPriority || filterStatus) && (
          <button className="btn btn-secondary" onClick={() => {
            setFilterCategory('')
            setFilterPriority('')
            setFilterStatus('')
          }}>
            🗑️ Clear
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2>{editingTicket ? '✏️ Edit Ticket' : '➕ New Support Ticket'}</h2>
          <form onSubmit={handleSubmit}>
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
                <label>📂 Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  list="categories"
                  placeholder="Technical, Billing, General..."
                />
                <datalist id="categories">
                  {categories.map(cat => <option key={cat} value={cat} />)}
                  <option value="Technical" />
                  <option value="Billing" />
                  <option value="General" />
                  <option value="Shipping" />
                  <option value="Product" />
                </datalist>
              </div>
            </div>

            <div className="form-group">
              <label>📝 Subject *</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                placeholder="Brief description of the issue"
              />
            </div>

            <div className="form-group">
              <label>📄 Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="5"
                required
                placeholder="Detailed description of the issue..."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>⚡ Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>📊 Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div className="form-group">
                <label>👤 Assigned To</label>
                <input
                  type="text"
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  placeholder="Agent name"
                />
              </div>
            </div>

            {editingTicket && (
              <div className="form-group">
                <label>✅ Resolution</label>
                <textarea
                  value={formData.resolution}
                  onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                  rows="4"
                  placeholder="How was this ticket resolved?"
                />
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">
                {editingTicket ? '💾 Update' : '✨ Create'} Ticket
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                ❌ Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>🎫 Support Tickets ({totalItems})</h2>
        {tickets.length === 0 && !loading ? (
          <p>No tickets found. Create your first ticket above.</p>
        ) : (
          <>
            <SortableTable
              data={tickets}
              columns={[
                { key: 'ticket_number', label: 'Ticket #', render: (value) => <strong>{value}</strong> },
                { key: 'customer', label: 'Customer', render: (_, row) => row.customer?.company_name || '-' },
                { key: 'subject', label: 'Subject' },
                { key: 'category', label: 'Category', render: (value) => value || '-' },
                {
                  key: 'priority',
                  label: 'Priority',
                  render: (value) => (
                    <span style={{
                      color: value === 'Urgent' ? 'var(--accent-amber)' :
                             value === 'High' ? 'var(--brown-300)' :
                             value === 'Medium' ? 'var(--green-300)' : 'var(--brown-200)'
                    }}>
                      {value === 'Urgent' ? '🔴' : value === 'High' ? '🟠' : value === 'Medium' ? '🟡' : '🟢'} {value}
                    </span>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (value) => (
                    <span className={`status-badge status-${value.toLowerCase().replace(/\s+/g, '-')}`}>
                      {value}
                    </span>
                  )
                },
                { key: 'assigned_to', label: 'Assigned To', render: (value) => value || '-' },
                {
                  key: 'actions',
                  label: 'Actions',
                  sortable: false,
                  render: (_, row) => (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
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

export default SupportTickets
