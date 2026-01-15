import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { purchasingAPI, suppliersAPI, productsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'

function Purchasing() {
  // Read query params so we can open a PO modal from another page (like Products).
  const [searchParams, setSearchParams] = useSearchParams()

  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedPO, setSelectedPO] = useState(null)
  const [alert, setAlert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [filterStatus, setFilterStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    supplier_id: '',
    expected_delivery_date: '',
    status: 'Draft',
    notes: '',
    items: [{ product_id: '', quantity: 1, unit_price: 0 }],
  })

  const loadSuppliers = async () => {
    try {
      const response = await suppliersAPI.getAll({ limit: 100, is_active: true })
      setSuppliers(Array.isArray(response.data) ? response.data : (response.data.items || []))
    } catch (error) {
      console.error('Error loading suppliers:', error)
    }
  }

@@ -54,50 +60,68 @@ function Purchasing() {
      setLoading(true)
      const params = { skip: (page - 1) * itemsPerPage, limit: itemsPerPage }
      if (debouncedSearchTerm) params.search = debouncedSearchTerm
      if (filterStatus) params.status = filterStatus

      const response = await purchasingAPI.getAll(params)
      if (response.data.items) {
        setPurchaseOrders(response.data.items)
        setTotalItems(response.data.total || 0)
      } else {
        setPurchaseOrders(response.data)
        setTotalItems(response.data.length)
      }
    } catch (error) {
      showAlert('Error loading purchase orders: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearchTerm, filterStatus, itemsPerPage])

  useEffect(() => {
    loadSuppliers()
    loadProducts()
  }, [])

  // If we land on this page with ?poId=123, load the PO and show its details modal.
  useEffect(() => {
    const poId = searchParams.get('poId')
    if (!poId) return

    const loadPO = async () => {
      try {
        const response = await purchasingAPI.getById(poId)
        setSelectedPO(response.data)
        setShowDetails(true)
      } catch (error) {
        showAlert('Error loading purchase order: ' + error.message, 'error')
      }
    }

    loadPO()
  }, [searchParams])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterStatus])

  useEffect(() => {
    loadData(currentPage)
  }, [currentPage, loadData])

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', quantity: 1, unit_price: 0 }],
    })
  }

  const handleRemoveItem = (index) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) })
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index][field] = field === 'product_id' ? parseInt(value) : parseFloat(value) || 0
    
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === parseInt(value))
@@ -133,69 +157,123 @@ function Purchasing() {
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this purchase order?')) return
    try {
      await purchasingAPI.delete(id)
      showAlert('Purchase order deleted successfully')
      loadData()
    } catch (error) {
      showAlert('Error deleting purchase order: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      expected_delivery_date: '',
      status: 'Draft',
      notes: '',
      items: [{ product_id: '', quantity: 1, unit_price: 0 }],
    })
    setShowForm(false)
  }

  // Close the PO details modal and clean the URL query param.
  const closeDetails = () => {
    setShowDetails(false)
    setSelectedPO(null)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('poId')
    setSearchParams(nextParams)
  }

  if (loading && purchaseOrders.length === 0) {
    return <div className="spinner"></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>🛒 Purchasing</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Create Purchase Order'}
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      {/* Purchase Order Details Modal */}
      {showDetails && selectedPO && (
        <div className="modal-overlay" onClick={closeDetails}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>🛒 Purchase Order {selectedPO.po_number}</h2>
              <button className="btn btn-secondary" onClick={closeDetails}>
                ✕
              </button>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <p><strong>Supplier:</strong> {selectedPO.supplier?.company_name || '-'}</p>
              <p><strong>Status:</strong> {selectedPO.status}</p>
              <p><strong>Expected Delivery:</strong> {selectedPO.expected_delivery_date || '-'}</p>
              <p><strong>Total:</strong> ${selectedPO.grand_total?.toFixed(2)}</p>
            </div>

            <h3 style={{ marginTop: '1rem' }}>Items</h3>
            <table style={{ marginTop: '0.5rem' }}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedPO.items?.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product?.sku || '-'}</td>
                    <td>{item.product?.name || '-'}</td>
                    <td>{item.quantity}</td>
                    <td>${item.unit_price?.toFixed(2)}</td>
                    <td>${item.line_total?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="search-bar">
        <input
          type="search"
          placeholder="🔍 Search by PO number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: '2', minWidth: '250px' }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Received">Received</option>
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
          <h2>➕ New Purchase Order</h2>
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            💡 PO number will be auto-generated: PO000000
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>🏭 Supplier *</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  required
                >
                  <option value="">Select Supplier...</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_code} - {supplier.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>📅 Expected Delivery Date</label>
                <input
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                />
              </div>
            </div>

            <div className="card" style={{ marginTop: '1rem', backgroundColor: 'rgba(45, 27, 14, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>📋 PO Items</h3>
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
                          <option key={p.id} value={p.id}>{p.sku} - {p.name} (Cost: ${p.cost || 0})</option>
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
              <button type="submit" className="btn btn-primary">✨ Create PO</button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>❌ Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>🛒 Purchase Orders ({totalItems})</h2>
        {purchaseOrders.length === 0 && !loading ? (
          <p>No purchase orders found. Create your first purchase order above.</p>
        ) : (
          <>
            <SortableTable
              data={purchaseOrders}
              columns={[
                { key: 'po_number', label: 'PO #', render: (value) => <strong>{value}</strong> },
                { key: 'supplier', label: 'Supplier', render: (_, row) => row.supplier?.company_name || '-' },
                { key: 'order_date', label: 'Date', render: (value) => new Date(value).toLocaleDateString() },
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

export default Purchasing
