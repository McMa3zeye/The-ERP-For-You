import { useState, useEffect, useCallback } from 'react'
import { suppliersAPI } from '../services/api'
import Pagination from '../components/Pagination'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'

function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [alert, setAlert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [filterActive, setFilterActive] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    supplier_code: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    contact_name: '',
    payment_terms: '',
    lead_time_days: 0,
    rating: 0.0,
    is_active: true,
    notes: '',
  })

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 4000)
  }

  const loadData = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      const params = { skip: (page - 1) * itemsPerPage, limit: itemsPerPage }
      if (debouncedSearchTerm) params.search = debouncedSearchTerm
      if (filterActive !== '') params.is_active = filterActive === 'true'

      const response = await suppliersAPI.getAll(params)
      if (response.data.items) {
        setSuppliers(response.data.items)
        setTotalItems(response.data.total || 0)
      } else {
        setSuppliers(response.data)
        setTotalItems(response.data.length)
      }
    } catch (error) {
      showAlert('Error loading suppliers: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearchTerm, filterActive, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterActive])

  useEffect(() => {
    loadData(currentPage)
  }, [currentPage, loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingSupplier) {
        await suppliersAPI.update(editingSupplier.id, formData)
        showAlert('Supplier updated successfully')
      } else {
        await suppliersAPI.create(formData)
        showAlert('Supplier created successfully')
      }
      resetForm()
      loadData()
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      supplier_code: supplier.supplier_code,
      company_name: supplier.company_name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      contact_name: supplier.contact_name || '',
      payment_terms: supplier.payment_terms || '',
      lead_time_days: supplier.lead_time_days || 0,
      rating: supplier.rating || 0.0,
      is_active: supplier.is_active,
      notes: supplier.notes || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return
    try {
      await suppliersAPI.delete(id)
      showAlert('Supplier deleted successfully')
      loadData()
    } catch (error) {
      showAlert('Error deleting supplier: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      supplier_code: '',
      company_name: '',
      email: '',
      phone: '',
      address: '',
      contact_name: '',
      payment_terms: '',
      lead_time_days: 0,
      rating: 0.0,
      is_active: true,
      notes: '',
    })
    setEditingSupplier(null)
    setShowForm(false)
  }

  if (loading && suppliers.length === 0) {
    return <div className="spinner"></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>🏭 Suppliers</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Add Supplier'}
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
          placeholder="🔍 Search by company name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: '2', minWidth: '250px' }}
        />
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">✅ Active</option>
          <option value="false">❌ Inactive</option>
        </select>
        {(searchTerm || filterActive) && (
          <button className="btn btn-secondary" onClick={() => {
            setSearchTerm('')
            setFilterActive('')
          }}>
            🗑️ Clear
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2>{editingSupplier ? '✏️ Edit Supplier' : '➕ New Supplier'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>🏢 Supplier Code *</label>
                <input
                  type="text"
                  value={formData.supplier_code}
                  onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value })}
                  required
                  disabled={!!editingSupplier}
                />
              </div>
              <div className="form-group">
                <label>🏢 Company Name *</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>📧 Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>📞 Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>👤 Contact Name</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>💳 Payment Terms</label>
                <input
                  type="text"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  placeholder="Net 30, Due on Receipt, etc."
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>⏱️ Lead Time (Days)</label>
                <input
                  type="number"
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label>⭐ Rating (0-5)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>📍 Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                {' '}✅ Active
              </label>
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
                {editingSupplier ? '💾 Update' : '✨ Create'} Supplier
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                ❌ Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>🏭 Suppliers ({totalItems})</h2>
        {suppliers.length === 0 && !loading ? (
          <p>No suppliers found. Create your first supplier above.</p>
        ) : (
          <>
            <SortableTable
              data={suppliers}
              columns={[
                { key: 'supplier_code', label: 'Code', render: (value) => <strong>{value}</strong> },
                { key: 'company_name', label: 'Company Name' },
                { key: 'contact_name', label: 'Contact' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'lead_time_days', label: 'Lead Time', render: (value) => `${value} days` },
                { key: 'rating', label: 'Rating', render: (value) => '⭐'.repeat(Math.round(value)) || '-' },
                {
                  key: 'is_active',
                  label: 'Status',
                  render: (value) => (
                    <span style={{ color: value ? 'var(--green-300)' : 'var(--brown-300)' }}>
                      {value ? '✅ Active' : '❌ Inactive'}
                    </span>
                  )
                },
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

export default Suppliers
