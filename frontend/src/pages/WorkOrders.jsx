import { useState, useEffect, useCallback } from 'react'
import { workOrdersAPI, salesOrdersAPI, productsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'

function WorkOrders() {
  const [workOrders, setWorkOrders] = useState([])
  const [salesOrders, setSalesOrders] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [alert, setAlert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [filterStatus, setFilterStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    sales_order_id: '',
    product_id: '',
    quantity: 1,
    due_date: '',
    priority: 'Normal',
    notes: '',
  })

  const loadSalesOrders = async () => {
    try {
      const response = await salesOrdersAPI.getAll({ limit: 100 })
      setSalesOrders(Array.isArray(response.data) ? response.data : (response.data.items || []))
    } catch (error) {
      console.error('Error loading sales orders:', error)
    }
  }

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll({ limit: 1000, is_active: true })
      setProducts(Array.isArray(response.data) ? response.data : (response.data.items || []))
    } catch (error) {
      console.error('Error loading products:', error)
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

      const response = await workOrdersAPI.getAll(params)
      if (response.data.items) {
        setWorkOrders(response.data.items)
        setTotalItems(response.data.total || 0)
      } else {
        setWorkOrders(response.data)
        setTotalItems(response.data.length)
      }
    } catch (error) {
      showAlert('Error loading work orders: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, itemsPerPage])

  useEffect(() => {
    loadSalesOrders()
    loadProducts()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus])

  useEffect(() => {
    loadData(currentPage)
  }, [currentPage, loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.product_id) {
      showAlert('Please select a product', 'error')
      return
    }

    try {
      await workOrdersAPI.create({
        ...formData,
        sales_order_id: formData.sales_order_id ? parseInt(formData.sales_order_id) : null,
        product_id: parseInt(formData.product_id),
        quantity: parseFloat(formData.quantity),
      })
      showAlert('Work order created successfully!')
      resetForm()
      loadData()
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleUpdateStatus = async (id, status) => {
    try {
      await workOrdersAPI.update(id, { status })
      showAlert('Work order status updated!')
      loadData()
    } catch (error) {
      showAlert('Error updating status: ' + error.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this work order?')) return
    try {
      await workOrdersAPI.delete(id)
      showAlert('Work order deleted successfully')
      loadData()
    } catch (error) {
      showAlert('Error deleting work order: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      sales_order_id: '',
      product_id: '',
      quantity: 1,
      due_date: '',
      priority: 'Normal',
      notes: '',
    })
    setShowForm(false)
  }

  if (loading && workOrders.length === 0) {
    return <div className="spinner"></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>🔧 Work Orders</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Create Work Order'}
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      <div className="search-bar">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Created">Created</option>
          <option value="In Progress">In Progress</option>
          <option value="On Hold">On Hold</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        {filterStatus && (
          <button className="btn btn-secondary" onClick={() => setFilterStatus('')}>
            🗑️ Clear
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2>➕ New Work Order</h2>
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            💡 Work order number will be auto-generated: WO000000
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>📋 Sales Order (Optional)</label>
                <select
                  value={formData.sales_order_id}
                  onChange={(e) => setFormData({ ...formData, sales_order_id: e.target.value })}
                >
                  <option value="">Select Order...</option>
                  {salesOrders.map(order => (
                    <option key={order.id} value={order.id}>
                      {order.order_number} - {order.customer_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>📦 Product *</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  required
                >
                  <option value="">Select Product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>🔢 Quantity *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 1 })}
                  required
                />
              </div>
              <div className="form-group">
                <label>📅 Due Date</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>⚡ Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>📝 Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" />
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">✨ Create Work Order</button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>❌ Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>🔧 Work Orders ({totalItems})</h2>
        {workOrders.length === 0 && !loading ? (
          <p>No work orders found. Create your first work order above.</p>
        ) : (
          <>
            <SortableTable
              data={workOrders}
              columns={[
                { key: 'wo_number', label: 'WO #', render: (value) => <strong>{value}</strong> },
                { key: 'product', label: 'Product', render: (_, row) => row.product?.name || '-' },
                { key: 'quantity', label: 'Quantity' },
                { key: 'completed_quantity', label: 'Completed' },
                {
                  key: 'priority',
                  label: 'Priority',
                  render: (value) => (
                    <span style={{ 
                      color: value === 'Urgent' ? 'var(--accent-amber)' : 
                             value === 'High' ? 'var(--brown-300)' : 'var(--green-300)' 
                    }}>
                      {value === 'Urgent' ? '🔴' : value === 'High' ? '🟠' : value === 'Normal' ? '🟡' : '🟢'} {value}
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
                {
                  key: 'actions',
                  label: 'Actions',
                  sortable: false,
                  render: (_, row) => (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {row.status !== 'Completed' && (
                        <button
                          className="btn btn-success"
                          onClick={() => handleUpdateStatus(row.id, 'In Progress')}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        >
                          ▶️ Start
                        </button>
                      )}
                      {row.status === 'In Progress' && (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleUpdateStatus(row.id, 'Completed')}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        >
                          ✅ Complete
                        </button>
                      )}
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

export default WorkOrders
