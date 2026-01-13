import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesOrdersAPI, productsAPI, customersAPI } from '../services/api'
import Pagination from '../components/Pagination'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'
import UnifiedChartBuilder from '../components/UnifiedChartBuilder'
import ChartWidget from '../components/ChartWidget'
import ChartImporter from '../components/ChartImporter'
import { exportChartData } from '../utils/export'

const STATUSES = [
  "Order Created",
  "Order Accepted", 
  "Ready for Production",
  "In Production",
  "Finished Production",
  "Order Shipped",
  "Order Received"
]

function SalesOrders() {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [alert, setAlert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500) // 500ms debounce
  const [filterStatus, setFilterStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20
  
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_address: '',
    shipping_address: '',
    shipping_method: '',
    status: 'Order Created',
    notes: '',
    items: [{ product_id: '', quantity: 1, unit_price: 0, discount_percent: 0 }],
  })

  const [customerFormData, setCustomerFormData] = useState({
    company_name: '',
    email: '',
    phone: '',
    address: '',
    siret: '',
    contact_name: '',
    commentary: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  // Load products once on mount
  useEffect(() => {
    const loadProductsOnce = async () => {
      try {
        const response = await productsAPI.getAll({ limit: 1000, is_active: true })
        const productList = Array.isArray(response.data) ? response.data : (response.data.items || [])
        setProducts(productList)
      } catch (error) {
        console.error('Error loading products:', error)
      }
    }
    loadProductsOnce()
  }, [])

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterStatus])

  // Load data when page or filters change (table-only refresh when filters change)
  useEffect(() => {
    const shouldSkipLoading = currentPage === 1 && (debouncedSearchTerm || filterStatus)
    loadData(currentPage, shouldSkipLoading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm, filterStatus])

  const loadData = useCallback(async (page = 1, skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true)
      const params = {
        skip: (page - 1) * itemsPerPage,
        limit: itemsPerPage
      }
      if (debouncedSearchTerm) params.search = debouncedSearchTerm
      if (filterStatus) params.status = filterStatus
      
      const ordersRes = await salesOrdersAPI.getAll(params)
      
      // Handle response format
      if (ordersRes.data.items) {
        setOrders(ordersRes.data.items)
        setTotalItems(ordersRes.data.total || 0)
      } else {
        setOrders(ordersRes.data)
        setTotalItems(ordersRes.data.length)
      }
    } catch (error) {
      showAlert('⚠️ Error loading data: ' + (error.message || 'Unknown error'), 'error')
    } finally {
      if (!skipLoading) setLoading(false)
    }
  }, [debouncedSearchTerm, filterStatus, itemsPerPage])
  
  // Refresh table only (keeps search/filters static)
  const refreshTable = useCallback(() => {
    loadData(currentPage, true) // Skip loading spinner
  }, [currentPage])

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    const timeoutId = setTimeout(() => setAlert(null), 4000)
    return () => clearTimeout(timeoutId)
  }, [])

  const getNextStatus = (currentStatus) => {
    const idx = STATUSES.indexOf(currentStatus)
    if (idx === -1 || idx === STATUSES.length - 1) return null
    return STATUSES[idx + 1]
  }

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', quantity: 1, unit_price: 0, discount_percent: 0 }],
    })
  }

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    setFormData({ ...formData, items: newItems })
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index][field] = field === 'product_id' ? parseInt(value) : 
                            (field === 'quantity' || field === 'unit_price' || field === 'discount_percent') ? 
                            parseFloat(value) || 0 : value
    
    // Auto-fill price when product is selected
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === parseInt(value))
      if (product) {
        newItems[index].unit_price = product.base_price
      }
    }
    
    setFormData({ ...formData, items: newItems })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.customer_id && !formData.customer_name) {
      showAlert('⚠️ Please select a customer or enter customer name', 'error')
      return
    }
    if (formData.items.length === 0) {
      showAlert('⚠️ Please add at least one item', 'error')
      return
    }
    
    try {
      // Prepare order data - use customer_id if available, otherwise use customer_name
      const orderData = {
        ...formData,
        customer_id: formData.customer_id ? parseInt(formData.customer_id) : null,
        customer_name: formData.customer_id ? undefined : formData.customer_name, // Only send customer_name if no customer_id
      }
      await salesOrdersAPI.create(orderData)
      showAlert('✅ Sales order created successfully! Order number auto-generated.')
      resetForm()
      loadData()
      // Reload customers to get any new ones
      const response = await customersAPI.getAll({ limit: 100 })
      const customerList = Array.isArray(response.data) ? response.data : (response.data.items || [])
      setCustomers(customerList)
    } catch (error) {
      showAlert('⚠️ Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    try {
      const response = await customersAPI.create(customerFormData)
      showAlert('✅ Customer created successfully!')
      // Add to local customers list
      setCustomers([...customers, response.data])
      // Pre-select the new customer
      setFormData({ ...formData, customer_id: response.data.id.toString() })
      resetCustomerForm()
    } catch (error) {
      showAlert('⚠️ Error creating customer: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleCustomerSelect = (customerId) => {
    const selectedCustomer = customers.find(c => c.id === parseInt(customerId))
    if (selectedCustomer) {
      setFormData({
        ...formData,
        customer_id: customerId,
        customer_name: selectedCustomer.company_name,
        customer_email: selectedCustomer.email || '',
        customer_address: selectedCustomer.address || '',
      })
    } else {
      setFormData({
        ...formData,
        customer_id: '',
        customer_name: '',
        customer_email: '',
        customer_address: '',
      })
    }
  }

  const resetCustomerForm = () => {
    setCustomerFormData({
      company_name: '',
      email: '',
      phone: '',
      address: '',
      siret: '',
      contact_name: '',
      commentary: '',
    })
    setShowCustomerForm(false)
  }

  const handleNextStatus = async (orderId) => {
    const order = orders.find(o => o.id === orderId)
    const nextStatus = getNextStatus(order?.status)
    
    if (!nextStatus) {
      showAlert('⚠️ Order is already at final status', 'warning')
      return
    }
    
    if (!window.confirm(`➡️ Move order to "${nextStatus}"?${nextStatus === 'Ready for Production' ? '\n\n⚠️ This will deduct materials from inventory!' : ''}`)) return
    
    try {
      await salesOrdersAPI.nextStatus(orderId)
      showAlert(`✅ Order status updated to "${nextStatus}"!${nextStatus === 'Ready for Production' ? ' Materials deducted.' : ''}`)
      loadData()
    } catch (error) {
      showAlert('⚠️ Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleDelete = async (orderId) => {
    if (!window.confirm('⚠️ Are you sure you want to delete this order?')) return
    
    try {
      await salesOrdersAPI.delete(orderId)
      showAlert('✅ Order deleted successfully')
      loadData()
    } catch (error) {
      showAlert('⚠️ Error deleting order: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      customer_id: '',
      customer_name: '',
      customer_email: '',
      customer_address: '',
      shipping_address: '',
      shipping_method: '',
      status: 'Order Created',
      notes: '',
      items: [{ product_id: '', quantity: 1, unit_price: 0, discount_percent: 0 }],
    })
    setShowForm(false)
  }

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      'Order Created': 'status-created',
      'Order Accepted': 'status-accepted',
      'Ready for Production': 'status-ready',
      'In Production': 'status-production',
      'Finished Production': 'status-finished',
      'Order Shipped': 'status-shipped',
      'Order Received': 'status-received',
    }
    return statusMap[status] || 'status-created'
  }

  if (loading) {
    return <div className="spinner"></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>📦 Sales Orders</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Create Sales Order'}
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'success'}`}>
          {alert.message}
        </div>
      )}

      {/* Search and Filters */}
      <div className="search-bar">
        <input
          type="search"
          placeholder="🔍 Search by customer name or order number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: '2', minWidth: '250px' }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>➕ New Sales Order</h2>
            <button 
              type="button"
              className="btn btn-success" 
              onClick={() => setShowCustomerForm(true)}
              style={{ margin: 0 }}
            >
              ➕ Add Customer
            </button>
          </div>
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            💡 Order number will be auto-generated: SO000000
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>👤 Customer *</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Select Customer...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.company_name} {customer.contact_name ? `(${customer.contact_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>📧 Customer Email</label>
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  disabled={!!formData.customer_id}
                  title={formData.customer_id ? "Email is auto-filled from customer" : ""}
                />
              </div>
            </div>

            <div className="form-group">
              <label>📍 Customer Address</label>
              <textarea
                value={formData.customer_address}
                onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                rows="2"
                disabled={!!formData.customer_id}
                title={formData.customer_id ? "Address is auto-filled from customer" : ""}
              />
            </div>

            {/* Manual customer entry fallback */}
            {!formData.customer_id && (
              <div className="form-group">
                <label>👤 Customer Name (if not in list) *</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>🚚 Shipping Address</label>
                <textarea
                  value={formData.shipping_address}
                  onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                  rows="2"
                />
              </div>
              <div className="form-group">
                <label>📦 Shipping Method</label>
                <input
                  type="text"
                  value={formData.shipping_method}
                  onChange={(e) => setFormData({ ...formData, shipping_method: e.target.value })}
                />
              </div>
            </div>

            <div className="card" style={{ marginTop: '1rem', backgroundColor: 'rgba(45, 27, 14, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>📋 Order Items</h3>
                <button type="button" className="btn btn-success" onClick={handleAddItem}>
                  ➕ Add Item
                </button>
              </div>

              {formData.items.map((item, index) => (
                <div key={index} style={{ border: '1px solid var(--brown-500)', padding: '1rem', marginBottom: '1rem', borderRadius: '8px', backgroundColor: 'rgba(45, 27, 14, 0.3)' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>📦 Product *</label>
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        required
                      >
                        <option value="">Select Product</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.sku} - {p.name} (${p.base_price})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>🔢 Quantity *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>💰 Unit Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>🎯 Discount %</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.discount_percent}
                        onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)}
                      />
                    </div>
                    {formData.items.length > 1 && (
                      <div className="form-group">
                        <label>&nbsp;</label>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleRemoveItem(index)}
                          style={{ width: '100%' }}
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>📝 Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="3"
              />
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary">✨ Create Order</button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>❌ Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Customer Modal */}
      {showCustomerForm && (
        <div className="modal-overlay" onClick={() => setShowCustomerForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>➕ Add New Customer</h2>
              <button className="btn btn-secondary" onClick={() => setShowCustomerForm(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="form-row">
                <div className="form-group">
                  <label>🏢 Company Name *</label>
                  <input
                    type="text"
                    value={customerFormData.company_name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, company_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>📧 Email</label>
                  <input
                    type="email"
                    value={customerFormData.email}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>📞 Phone</label>
                  <input
                    type="text"
                    value={customerFormData.phone}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>📇 SIRET</label>
                  <input
                    type="text"
                    value={customerFormData.siret}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, siret: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>👤 Contact Name</label>
                  <input
                    type="text"
                    value={customerFormData.contact_name}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, contact_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>📍 Address</label>
                <textarea
                  value={customerFormData.address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>📝 Commentary</label>
                <textarea
                  value={customerFormData.commentary}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, commentary: e.target.value })}
                  rows="4"
                />
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary">✨ Create Customer</button>
                <button type="button" className="btn btn-secondary" onClick={resetCustomerForm}>❌ Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>📦 Sales Orders ({totalItems})</h2>
          <button className="btn btn-secondary" onClick={refreshTable} title="Refresh Table Only">
            🔄 Refresh Table
          </button>
        </div>
        {orders.length === 0 && !loading ? (
          <p>No sales orders found. Create your first order above.</p>
        ) : (
          <>
          <SortableTable
            data={orders}
            columns={[
              { key: 'order_number', label: 'Order Number', render: (value) => <strong>{value}</strong> },
              { key: 'customer_name', label: 'Customer' },
              { 
                key: 'order_date', 
                label: 'Date',
                render: (value) => new Date(value).toLocaleDateString()
              },
              { 
                key: 'items', 
                label: 'Items',
                render: (_, row) => row.items?.length || 0
              },
              { 
                key: 'grand_total', 
                label: 'Total',
                render: (value) => `$${parseFloat(value || 0).toFixed(2)}`
              },
              {
                key: 'status',
                label: 'Status',
                render: (value) => (
                  <span className={`status-badge ${getStatusBadgeClass(value)}`}>
                    {value}
                  </span>
                )
              },
              {
                key: 'actions',
                label: 'Actions',
                sortable: false,
                render: (_, row) => {
                  const nextStatus = getNextStatus(row.status)
                  return (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {nextStatus && (
                        <button
                          className="btn btn-success"
                          onClick={() => handleNextStatus(row.id)}
                          title={`Move to: ${nextStatus}`}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        >
                          ➡️ Next Status
                        </button>
                      )}
                      {row.status === 'Order Created' && (
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handleDelete(row.id)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  )
                }
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

export default SalesOrders
