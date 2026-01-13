import { useState, useEffect, useCallback } from 'react'
import { returnsAPI, customersAPI, productsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const STATUSES = ['Requested', 'Approved', 'Received', 'Inspected', 'Refunded', 'Closed']
const REASONS = ['Defective', 'Wrong Item', 'Not Needed', 'Damaged', 'Quality Issue', 'Other']
const DISPOSITIONS = ['Restock', 'Scrap', 'Repair', 'Return to Vendor']

function Returns() {
  const [returns, setReturns] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingReturn, setEditingReturn] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [alert, setAlert] = useState(null)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    customer_id: '', reason: '', status: 'Requested', disposition: '',
    refund_amount: 0, restocking_fee: 0, notes: '', items: []
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadCustomers = useCallback(async () => {
    try {
      const response = await customersAPI.getAll({ limit: 100 })
      setCustomers(response.data.items || [])
    } catch (err) {
      console.error('Failed to load customers', err)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      const response = await productsAPI.getAll({ limit: 100 })
      setProducts(response.data.items || [])
    } catch (err) {
      console.error('Failed to load products', err)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (currentPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      const response = await returnsAPI.getAll(params)
      setReturns(response.data.items || [])
      setTotalItems(response.data.total || 0)
    } catch (err) {
      setError('Failed to load returns')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, statusFilter])

  useEffect(() => { loadCustomers(); loadProducts() }, [loadCustomers, loadProducts])
  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = { ...formData }
      if (submitData.customer_id) submitData.customer_id = parseInt(submitData.customer_id)
      else delete submitData.customer_id
      submitData.items = submitData.items.map(item => ({
        ...item,
        product_id: parseInt(item.product_id),
        quantity: parseFloat(item.quantity) || 1
      }))
      if (editingReturn) {
        const { items, customer_id, ...updateData } = submitData
        await returnsAPI.update(editingReturn.id, updateData)
        showAlert('Return updated successfully')
      } else {
        await returnsAPI.create(submitData)
        showAlert('Return created successfully')
      }
      setShowForm(false)
      setEditingReturn(null)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(err.message || 'Failed to save return', 'error')
    }
  }

  const handleEdit = (ret) => {
    setEditingReturn(ret)
    setFormData({
      customer_id: ret.customer_id || '',
      reason: ret.reason || '',
      status: ret.status || 'Requested',
      disposition: ret.disposition || '',
      refund_amount: ret.refund_amount || 0,
      restocking_fee: ret.restocking_fee || 0,
      notes: ret.notes || '',
      items: ret.items || []
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await returnsAPI.delete(id)
      showAlert('Return deleted successfully')
      loadData()
    } catch (err) {
      showAlert('Failed to delete return', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      customer_id: '', reason: '', status: 'Requested', disposition: '',
      refund_amount: 0, restocking_fee: 0, notes: '', items: []
    })
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', quantity: 1, reason: '', condition: '' }]
    })
  }

  const updateItem = (index, field, value) => {
    const updated = [...formData.items]
    updated[index][field] = value
    setFormData({ ...formData, items: updated })
  }

  const removeItem = (index) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) })
  }

  const getStatusColor = (status) => {
    const colors = { Requested: '#f59e0b', Approved: '#3b82f6', Received: '#8b5cf6', Inspected: '#06b6d4', Refunded: '#22c55e', Closed: '#6b7280' }
    return colors[status] || '#6b7280'
  }

  if (loading && returns.length === 0) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          Returns & RMA
          <PageHelpCorner />
        </h1>
        <button onClick={() => { setShowForm(true); setEditingReturn(null); resetForm() }} className="btn btn-primary">+ New Return</button>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Search returns..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingReturn ? 'Edit Return' : 'New Return'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Customer</label>
                  <select value={formData.customer_id} onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })} disabled={!!editingReturn}>
                    <option value="">Select Customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <select value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })}>
                    <option value="">Select Reason</option>
                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Disposition</label>
                  <select value={formData.disposition} onChange={(e) => setFormData({ ...formData, disposition: e.target.value })}>
                    <option value="">Select Disposition</option>
                    {DISPOSITIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Refund Amount</label>
                  <input type="number" step="0.01" value={formData.refund_amount} onChange={(e) => setFormData({ ...formData, refund_amount: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Restocking Fee</label>
                  <input type="number" step="0.01" value={formData.restocking_fee} onChange={(e) => setFormData({ ...formData, restocking_fee: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              
              {!editingReturn && (
                <div className="form-section">
                  <div className="section-header">
                    <h3>Return Items</h3>
                    <button type="button" onClick={addItem} className="btn btn-sm">+ Add Item</button>
                  </div>
                  {formData.items.map((item, idx) => (
                    <div key={idx} className="item-row">
                      <select value={item.product_id} onChange={(e) => updateItem(idx, 'product_id', e.target.value)} required>
                        <option value="">Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="number" step="1" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                      <select value={item.reason} onChange={(e) => updateItem(idx, 'reason', e.target.value)}>
                        <option value="">Reason</option>
                        {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button type="button" onClick={() => removeItem(idx)} className="btn-icon">🗑️</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingReturn ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>RMA #</th>
              <th>Customer</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Disposition</th>
              <th>Refund</th>
              <th>Items</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {returns.map(ret => (
              <tr key={ret.id}>
                <td>{ret.rma_number}</td>
                <td>{ret.customer?.company_name || '-'}</td>
                <td>{ret.reason || '-'}</td>
                <td><span className="status-badge" style={{ backgroundColor: getStatusColor(ret.status) }}>{ret.status}</span></td>
                <td>{ret.disposition || '-'}</td>
                <td>${(ret.refund_amount || 0).toFixed(2)}</td>
                <td>{ret.items?.length || 0}</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(ret)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(ret.id)} className="btn-icon" title="Delete">🗑️</button>
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

export default Returns
