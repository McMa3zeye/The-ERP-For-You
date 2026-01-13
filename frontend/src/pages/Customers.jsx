import { useState, useEffect, useMemo, useCallback } from 'react'
import { customersAPI, salesOrdersAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../contexts/AuthContext'

function Customers() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('customers.create')
  const canUpdate = hasPermission('customers.update')
  const canDelete = hasPermission('customers.delete')
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerOrders, setCustomerOrders] = useState([])
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [alert, setAlert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    company_name: '',
    email: '',
    phone: '',
    address: '',
    siret: '',
    contact_name: '',
    commentary: '',
  })

  useEffect(() => {
    loadCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadCustomers = useCallback(async (page = 1, skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true)
      const params = {
        skip: (page - 1) * itemsPerPage,
        limit: itemsPerPage
      }
      if (debouncedSearchTerm) params.search = debouncedSearchTerm
      
      const response = await customersAPI.getAll(params)
      
      if (response.data.items) {
        setCustomers(response.data.items)
        setTotalItems(response.data.total || 0)
      } else {
        setCustomers(response.data)
        setTotalItems(response.data.length)
      }
    } catch (error) {
      showAlert('Error loading customers: ' + (error.message || 'Unknown error'), 'error')
    } finally {
      if (!skipLoading) setLoading(false)
    }
  }, [debouncedSearchTerm, itemsPerPage])

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm])

  // Load data when page or search changes
  useEffect(() => {
    const shouldSkipLoading = currentPage === 1 && debouncedSearchTerm
    loadCustomers(currentPage, shouldSkipLoading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm])

  const refreshTable = useCallback(() => {
    loadCustomers(currentPage, true)
  }, [loadCustomers, currentPage])

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    const timeoutId = setTimeout(() => setAlert(null), 4000)
    return () => clearTimeout(timeoutId)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingCustomer) {
        await customersAPI.update(editingCustomer.id, formData)
        showAlert('✅ Customer updated successfully')
      } else {
        await customersAPI.create(formData)
        showAlert('✅ Customer created successfully')
      }
      resetForm()
      loadCustomers()
    } catch (error) {
      showAlert('⚠️ Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleEdit = (customer) => {
    setEditingCustomer(customer)
    setFormData({
      company_name: customer.company_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      siret: customer.siret || '',
      contact_name: customer.contact_name || '',
      commentary: customer.commentary || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('⚠️ Are you sure you want to delete this customer?')) return
    
    try {
      await customersAPI.delete(id)
      showAlert('✅ Customer deleted successfully')
      loadCustomers()
    } catch (error) {
      showAlert('⚠️ Error deleting customer: ' + error.message, 'error')
    }
  }

  const handleViewDetails = async (customer) => {
    setSelectedCustomer(customer)
    try {
      const response = await customersAPI.getOrders(customer.id)
      setCustomerOrders(response.data)
      setShowDetails(true)
    } catch (error) {
      showAlert('⚠️ Error loading customer details: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      company_name: '',
      email: '',
      phone: '',
      address: '',
      siret: '',
      contact_name: '',
      commentary: '',
    })
    setEditingCustomer(null)
    setShowForm(false)
  }

  const customerTableHeaders = [
    { key: 'company_name', label: 'Company Name', render: (value) => <strong>{value}</strong> },
    { key: 'contact_name', label: 'Contact Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'siret', label: 'SIRET' },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-info" onClick={() => handleViewDetails(row)} title="View Details">
            📋
          </button>
          {canUpdate && (
            <button className="btn btn-primary" onClick={() => handleEdit(row)}>
              ✏️
            </button>
          )}
          {canDelete && (
            <button className="btn btn-danger" onClick={() => handleDelete(row.id)}>
              🗑️
            </button>
          )}
        </div>
      )
    }
  ]

  if (loading && customers.length === 0) {
    return <div className="spinner"></div>
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>
          👥 Customers
          <PageHelpCorner />
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={refreshTable} title="Refresh Table Only">
            🔄 Refresh Table
          </button>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? '❌ Cancel' : '➕ Add Customer'}
            </button>
          )}
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      {/* Search */}
      <div className="search-bar">
        <input
          type="search"
          placeholder="🔍 Search by company name, email, or contact name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: '2', minWidth: '250px' }}
        />
        {searchTerm && (
          <button className="btn btn-secondary" onClick={() => setSearchTerm('')}>
            🗑️ Clear
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2>{editingCustomer ? '✏️ Edit Customer' : '➕ New Customer'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>🏢 Company Name *</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>📧 Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>📞 Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>📇 SIRET</label>
                <input
                  type="text"
                  value={formData.siret}
                  onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
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
              <label>📝 Commentary</label>
              <textarea
                value={formData.commentary}
                onChange={(e) => setFormData({ ...formData, commentary: e.target.value })}
                rows="4"
              />
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary">
                {editingCustomer ? '💾 Update' : '✨ Create'} Customer
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                ❌ Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customer Details Modal */}
      {showDetails && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>📋 Customer Details: {selectedCustomer.company_name}</h2>
              <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>✕</button>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3>👤 Customer Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong>🏢 Company Name:</strong>
                  <p>{selectedCustomer.company_name}</p>
                </div>
                <div>
                  <strong>👤 Contact Name:</strong>
                  <p>{selectedCustomer.contact_name || '-'}</p>
                </div>
                <div>
                  <strong>📧 Email:</strong>
                  <p>{selectedCustomer.email || '-'}</p>
                </div>
                <div>
                  <strong>📞 Phone:</strong>
                  <p>{selectedCustomer.phone || '-'}</p>
                </div>
                <div>
                  <strong>📇 SIRET:</strong>
                  <p>{selectedCustomer.siret || '-'}</p>
                </div>
                {selectedCustomer.address && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>📍 Address:</strong>
                    <p>{selectedCustomer.address}</p>
                  </div>
                )}
                {selectedCustomer.commentary && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>📝 Commentary:</strong>
                    <p>{selectedCustomer.commentary}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h3>📦 Sales Orders ({customerOrders.length})</h3>
              {customerOrders.length === 0 ? (
                <p style={{ color: 'var(--brown-200)' }}>No orders found for this customer.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Order Number</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerOrders.map(order => (
                        <tr key={order.id}>
                          <td><strong>{order.order_number}</strong></td>
                          <td>{new Date(order.order_date).toLocaleDateString()}</td>
                          <td>
                            <span className={`status-badge status-${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                              {order.status}
                            </span>
                          </td>
                          <td>${parseFloat(order.grand_total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>👥 Customer List ({totalItems})</h2>
          <button className="btn btn-secondary" onClick={refreshTable} title="Refresh Table Only">
            🔄 Refresh Table
          </button>
        </div>
        {customers.length === 0 && !loading ? (
          <p>No customers found. Create your first customer above.</p>
        ) : (
          <>
            <SortableTable
              data={customers}
              columns={customerTableHeaders}
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

export default Customers
