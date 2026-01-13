import { useState, useEffect, useCallback } from 'react'
import { quotesAPI, customersAPI, productsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'

function Quotes() {
  const [quotes, setQuotes] = useState([])
  const [customers, setCustomers] = useState([])
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
    customer_id: '',
    customer_name: '',
    valid_until: '',
    status: 'Draft',
    notes: '',
    terms_conditions: '',
    items: [{ product_id: '', quantity: 1, unit_price: 0, discount_percent: 0 }],
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

      const response = await quotesAPI.getAll(params)
      if (response.data.items) {
        setQuotes(response.data.items)
        setTotalItems(response.data.total || 0)
      } else {
        setQuotes(response.data)
        setTotalItems(response.data.length)
      }
    } catch (error) {
      showAlert('Error loading quotes: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearchTerm, filterStatus, itemsPerPage])

  useEffect(() => {
    loadCustomers()
    loadProducts()
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
      items: [...formData.items, { product_id: '', quantity: 1, unit_price: 0, discount_percent: 0 }],
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
      await quotesAPI.create(formData)
      showAlert('Quote created successfully!')
      resetForm()
      loadData()
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quote?')) return
    try {
      await quotesAPI.delete(id)
      showAlert('Quote deleted successfully')
      loadData()
    } catch (error) {
      showAlert('Error deleting quote: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      customer_id: '',
      customer_name: '',
      valid_until: '',
      status: 'Draft',
      notes: '',
      terms_conditions: '',
      items: [{ product_id: '', quantity: 1, unit_price: 0, discount_percent: 0 }],
    })
    setShowForm(false)
  }

  if (loading && quotes.length === 0) {
    return <div className="spinner"></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>💰 Quotes</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Create Quote'}
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
          placeholder="🔍 Search by quote number or customer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: '2', minWidth: '250px' }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
          <option value="Expired">Expired</option>
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
          <h2>➕ New Quote</h2>
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            💡 Quote number will be auto-generated: QT000000
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
                  <label>👤 Customer Name (if not in list) *</label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>📅 Valid Until</label>
                <input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>📊 Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="card" style={{ marginTop: '1rem', backgroundColor: 'rgba(45, 27, 14, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>📋 Quote Items</h3>
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

            <div className="form-group">
              <label>📄 Terms & Conditions</label>
              <textarea value={formData.terms_conditions} onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })} rows="4" />
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">✨ Create Quote</button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>❌ Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>💰 Quotes ({totalItems})</h2>
        {quotes.length === 0 && !loading ? (
          <p>No quotes found. Create your first quote above.</p>
        ) : (
          <>
            <SortableTable
              data={quotes}
              columns={[
                { key: 'quote_number', label: 'Quote #', render: (value) => <strong>{value}</strong> },
                { key: 'customer_name', label: 'Customer' },
                { key: 'quote_date', label: 'Date', render: (value) => new Date(value).toLocaleDateString() },
                { key: 'valid_until', label: 'Valid Until', render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
                { key: 'grand_total', label: 'Total', render: (value) => `$${parseFloat(value || 0).toFixed(2)}` },
                {
                  key: 'status',
                  label: 'Status',
                  render: (value) => (
                    <span className={`status-badge status-${value.toLowerCase()}`}>
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

export default Quotes
