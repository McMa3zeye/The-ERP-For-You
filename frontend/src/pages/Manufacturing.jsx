import { useState, useEffect, useCallback } from 'react'
import { manufacturingAPI, productsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const STATUSES = ['Draft', 'Active', 'Obsolete']

function Manufacturing() {
  const [boms, setBoms] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingBom, setEditingBom] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [alert, setAlert] = useState(null)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    product_id: '', version: '1.0', status: 'Draft', effective_date: '',
    quantity: 1, labor_hours: 0, labor_cost: 0, overhead_cost: 0, notes: '',
    components: []
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
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
      const response = await manufacturingAPI.getAll(params)
      setBoms(response.data.items || [])
      setTotalItems(response.data.total || 0)
    } catch (err) {
      setError('Failed to load BOMs')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, statusFilter])

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = { ...formData, product_id: parseInt(formData.product_id) }
      if (!submitData.effective_date) delete submitData.effective_date
      if (editingBom) {
        const { product_id, components, ...updateData } = submitData
        await manufacturingAPI.update(editingBom.id, updateData)
        showAlert('BOM updated successfully')
      } else {
        await manufacturingAPI.create(submitData)
        showAlert('BOM created successfully')
      }
      setShowForm(false)
      setEditingBom(null)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(err.message || 'Failed to save BOM', 'error')
    }
  }

  const handleEdit = (bom) => {
    setEditingBom(bom)
    setFormData({
      product_id: bom.product_id || '', version: bom.version || '1.0',
      status: bom.status || 'Draft',
      effective_date: bom.effective_date ? bom.effective_date.split('T')[0] : '',
      quantity: bom.quantity || 1, labor_hours: bom.labor_hours || 0,
      labor_cost: bom.labor_cost || 0, overhead_cost: bom.overhead_cost || 0,
      notes: bom.notes || '', components: bom.components || []
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await manufacturingAPI.delete(id)
      showAlert('BOM deleted successfully')
      loadData()
    } catch (err) {
      showAlert('Failed to delete BOM', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      product_id: '', version: '1.0', status: 'Draft', effective_date: '',
      quantity: 1, labor_hours: 0, labor_cost: 0, overhead_cost: 0, notes: '',
      components: []
    })
  }

  const addComponent = () => {
    setFormData({
      ...formData,
      components: [...formData.components, { component_id: '', quantity: 1, unit_of_measure: 'pcs', scrap_rate: 0, notes: '' }]
    })
  }

  const updateComponent = (index, field, value) => {
    const updated = [...formData.components]
    updated[index][field] = value
    setFormData({ ...formData, components: updated })
  }

  const removeComponent = (index) => {
    setFormData({ ...formData, components: formData.components.filter((_, i) => i !== index) })
  }

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId)
    return product ? product.name : 'Unknown'
  }

  if (loading && boms.length === 0) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          Manufacturing (BOM)
          <PageHelpCorner />
        </h1>
        <button onClick={() => { setShowForm(true); setEditingBom(null); resetForm() }} className="btn btn-primary">+ New BOM</button>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Search BOMs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingBom ? 'Edit BOM' : 'New BOM'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Product *</label>
                  <select value={formData.product_id} onChange={(e) => setFormData({ ...formData, product_id: e.target.value })} required disabled={!!editingBom}>
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Version</label>
                  <input type="text" value={formData.version} onChange={(e) => setFormData({ ...formData, version: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Effective Date</label>
                  <input type="date" value={formData.effective_date} onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Batch Quantity</label>
                  <input type="number" step="0.01" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 1 })} />
                </div>
                <div className="form-group">
                  <label>Labor Hours</label>
                  <input type="number" step="0.01" value={formData.labor_hours} onChange={(e) => setFormData({ ...formData, labor_hours: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Labor Cost</label>
                  <input type="number" step="0.01" value={formData.labor_cost} onChange={(e) => setFormData({ ...formData, labor_cost: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Overhead Cost</label>
                  <input type="number" step="0.01" value={formData.overhead_cost} onChange={(e) => setFormData({ ...formData, overhead_cost: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              
              {!editingBom && (
                <div className="form-section">
                  <div className="section-header">
                    <h3>Components</h3>
                    <button type="button" onClick={addComponent} className="btn btn-sm">+ Add Component</button>
                  </div>
                  {formData.components.map((comp, idx) => (
                    <div key={idx} className="component-row">
                      <select value={comp.component_id} onChange={(e) => updateComponent(idx, 'component_id', e.target.value)} required>
                        <option value="">Select Component</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input type="number" step="0.01" placeholder="Qty" value={comp.quantity} onChange={(e) => updateComponent(idx, 'quantity', parseFloat(e.target.value) || 1)} />
                      <input type="text" placeholder="UoM" value={comp.unit_of_measure} onChange={(e) => updateComponent(idx, 'unit_of_measure', e.target.value)} />
                      <input type="number" step="0.01" placeholder="Scrap %" value={comp.scrap_rate} onChange={(e) => updateComponent(idx, 'scrap_rate', parseFloat(e.target.value) || 0)} />
                      <button type="button" onClick={() => removeComponent(idx)} className="btn-icon">🗑️</button>
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
                <button type="submit" className="btn btn-primary">{editingBom ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>BOM #</th>
              <th>Product</th>
              <th>Version</th>
              <th>Status</th>
              <th>Batch Qty</th>
              <th>Labor Hours</th>
              <th>Components</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {boms.map(bom => (
              <tr key={bom.id}>
                <td>{bom.bom_number}</td>
                <td>{bom.product?.name || getProductName(bom.product_id)}</td>
                <td>{bom.version}</td>
                <td><span className={`status-badge status-${bom.status?.toLowerCase()}`}>{bom.status}</span></td>
                <td>{bom.quantity}</td>
                <td>{bom.labor_hours}h</td>
                <td>{bom.components?.length || 0}</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(bom)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(bom.id)} className="btn-icon" title="Delete">🗑️</button>
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

export default Manufacturing
