import { useState, useEffect, useCallback } from 'react'
import { invoicesAPI, customersAPI, productsAPI, salesOrdersAPI } from '../services/api'
import Pagination from '../components/Pagination'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'

function Invoicing() {
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [salesOrders, setSalesOrders] = useState([])
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
    customer_id: '',
    customer_name: '',
    sales_order_id: '',
    due_date: '',
    payment_terms: 'Net 30',
    notes: '',
    items: [{ product_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }],
  })

  const loadCustomers = async () => {
    try {
      const response = await customersAPI.getAll({ limit: 100 })
      setCustomers(Array.isArray(response.data) ? response.data : (response.data.items || []))
    } catch (error) {
      console.error('Error loading customers:', error)
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

  const loadSalesOrders = async () => {
    try {
      const response = await salesOrdersAPI.getAll({ limit: 100, status: 'Order Received' })
      setSalesOrders(Array.isArray(response.data) ? response.data : (response.data.items || []))
    } catch (error) {
      console.error('Error loading sales orders:', error)
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
      if (debouncedSearchTerm) params.search = debouncedSearchTerm
      if (filterStatus) params.status = filterStatus

      const response = await invoicesAPI.getAll(params)
      if (response.data.items) {
        setInvoices(response.data.items)
        setTotalItems(response.data.total || 0)
      } else {
        setInvoices(response.data)
        setTotalItems(response.data.length)
      }
    } catch (error) {
      showAlert('Error loading invoices: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearchTerm, filterStatus, itemsPerPage])

  useEffect(() => {
    loadCustomers()
    loadProducts()
    loadSalesOrders()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterStatus])

  useEffect(() => {
    loadData(currentPage)
  }, [currentPage, loadData])

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }],
    })
  }

  const handleRemoveItem = (index) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) })
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index][field] = field === 'product_id' ? parseInt(value) : 
                            (field === 'quantity' || field === 'unit_price' || field === 'discount_percent') ? 
                            parseFloat(value) || 0 : value
    
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === parseInt(value))
      if (product) {
        newItems[index].unit_price = product.base_price
        newItems[index].description = product.name
      }
    }
    
    setFormData({ ...formData, items: newItems })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.customer_id && !formData.customer_name) {
      showAlert('Please select a customer or enter customer name', 'error')
      return
    }
    if (formData.items.length === 0) {
      showAlert('Please add at least one item', 'error')
      return
    }

    try {
      await invoicesAPI.create({
        ...formData,
        sales_order_id: formData.sales_order_id ? parseInt(formData.sales_order_id) : null,
      })
      showAlert('Invoice created successfully!')
      resetForm()
      loadData()
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return
    try {
      await invoicesAPI.delete(id)
      showAlert('Invoice deleted successfully')
      loadData()
    } catch (error) {
      showAlert('Error deleting invoice: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      customer_id: '',
      customer_name: '',
      sales_order_id: '',
      due_date: '',
      payment_terms: 'Net 30',
      notes: '',
      items: [{ product_id: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0 }],
    })
    setShowForm(false)
  }

  if (loading && invoices.length === 0) {
    return <div className="spinner"></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>🧾 Invoicing</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Create Invoice'}
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
          placeholder="🔍 Search by invoice number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: '2', minWidth: '250px' }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Paid">Paid</option>
          <option value="Partially Paid">Partially Paid</option>
          <option value="Overdue">Overdue</option>
          <option value="Void">Void</option>
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
          <h2>➕ New Invoice</h2>
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            💡 Invoice number will be auto-generated: INV000000
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>👤 Customer *</label>
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
              {!formData.customer_id && (
                <div className="form-group">
                  <label>👤 Customer Name *</label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    required
                  />
                </div>
              )}
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
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>📅 Due Date</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>💳 Payment Terms</label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                >
                  <option value="Due on Receipt">Due on Receipt</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                </select>
              </div>
            </div>

            <div className="card" style={{ marginTop: '1rem', backgroundColor: 'rgba(45, 27, 14, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>📋 Invoice Items</h3>
                <button type="button" className="btn btn-success" onClick={handleAddItem}>
                  ➕ Add Item
                </button>
              </div>

              {formData.items.map((item, index) => (
                <div key={index} style={{ border: '1px solid var(--brown-500)', padding: '1rem', marginBottom: '1rem', borderRadius: '8px' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>📦 Product *</label>
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        required
                      >
                        <option value="">Select Product...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>📝 Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      />
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
                        <button type="button" className="btn btn-danger" onClick={() => handleRemoveItem(index)}>
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
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" />
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">✨ Create Invoice</button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>❌ Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>🧾 Invoices ({totalItems})</h2>
        {invoices.length === 0 && !loading ? (
          <p>No invoices found. Create your first invoice above.</p>
        ) : (
          <>
            <SortableTable
              data={invoices}
              columns={[
                { key: 'invoice_number', label: 'Invoice #', render: (value) => <strong>{value}</strong> },
                { key: 'customer_name', label: 'Customer' },
                { key: 'invoice_date', label: 'Date', render: (value) => new Date(value).toLocaleDateString() },
                { key: 'due_date', label: 'Due Date', render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
                { key: 'grand_total', label: 'Total', render: (value) => `$${parseFloat(value || 0).toFixed(2)}` },
                { key: 'amount_due', label: 'Amount Due', render: (value) => `$${parseFloat(value || 0).toFixed(2)}` },
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
                    <button className="btn btn-danger" onClick={() => handleDelete(row.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                      🗑️
                    </button>
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

export default Invoicing
