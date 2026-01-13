import { useState, useEffect, useCallback } from 'react'
import { paymentsAPI, invoicesAPI, customersAPI } from '../services/api'
import Pagination from '../components/Pagination'
import SortableTable from '../components/SortableTable'

function Payments() {
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [alert, setAlert] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    invoice_id: '',
    customer_id: '',
    amount: 0,
    payment_method: 'Cash',
    reference_number: '',
    notes: '',
  })

  useEffect(() => {
    loadData()
    loadInvoices()
    loadCustomers()
  }, [])

  useEffect(() => {
    loadData(currentPage)
  }, [currentPage])

  const loadInvoices = async () => {
    try {
      const response = await invoicesAPI.getAll({ limit: 100, status: 'Sent' })
      setInvoices(Array.isArray(response.data) ? response.data : (response.data.items || []))
    } catch (error) {
      console.error('Error loading invoices:', error)
    }
  }

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

      const response = await paymentsAPI.getAll(params)
      if (response.data.items) {
        setPayments(response.data.items)
        setTotalItems(response.data.total || 0)
      } else {
        setPayments(response.data)
        setTotalItems(response.data.length)
      }
    } catch (error) {
      showAlert('Error loading payments: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [itemsPerPage])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.amount || formData.amount <= 0) {
      showAlert('Please enter a valid payment amount', 'error')
      return
    }

    try {
      await paymentsAPI.create({
        ...formData,
        invoice_id: formData.invoice_id ? parseInt(formData.invoice_id) : null,
        customer_id: formData.customer_id ? parseInt(formData.customer_id) : null,
        amount: parseFloat(formData.amount),
      })
      showAlert('Payment recorded successfully!')
      resetForm()
      loadData()
      loadInvoices()
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) return
    try {
      await paymentsAPI.delete(id)
      showAlert('Payment deleted successfully')
      loadData()
      loadInvoices()
    } catch (error) {
      showAlert('Error deleting payment: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      invoice_id: '',
      customer_id: '',
      amount: 0,
      payment_method: 'Cash',
      reference_number: '',
      notes: '',
    })
    setShowForm(false)
  }

  if (loading && payments.length === 0) {
    return <div className="spinner"></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>💵 Payments</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Record Payment'}
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2>➕ Record Payment</h2>
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            💡 Payment number will be auto-generated: PAY000000
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>🧾 Invoice (Optional)</label>
                <select
                  value={formData.invoice_id}
                  onChange={(e) => {
                    const selectedInvoice = invoices.find(inv => inv.id === parseInt(e.target.value))
                    setFormData({
                      ...formData,
                      invoice_id: e.target.value,
                      customer_id: selectedInvoice?.customer_id || formData.customer_id,
                      amount: selectedInvoice?.amount_due || formData.amount,
                    })
                  }}
                >
                  <option value="">Select Invoice...</option>
                  {invoices.filter(inv => inv.amount_due > 0).map(invoice => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} - {invoice.customer_name} (Due: ${invoice.amount_due.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
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
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>💰 Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="form-group">
                <label>💳 Payment Method *</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Check">Check</option>
                </select>
              </div>
              <div className="form-group">
                <label>🔢 Reference Number</label>
                <input
                  type="text"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  placeholder="Check #, Transaction ID, etc."
                />
              </div>
            </div>

            <div className="form-group">
              <label>📝 Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="3"
              />
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">✨ Record Payment</button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>❌ Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>💵 Payments ({totalItems})</h2>
        {payments.length === 0 && !loading ? (
          <p>No payments found. Record your first payment above.</p>
        ) : (
          <>
            <SortableTable
              data={payments}
              columns={[
                { key: 'payment_number', label: 'Payment #', render: (value) => <strong>{value}</strong> },
                { key: 'invoice', label: 'Invoice', render: (_, row) => row.invoice?.invoice_number || '-' },
                { key: 'customer', label: 'Customer', render: (_, row) => row.customer?.company_name || row.invoice?.customer_name || '-' },
                { key: 'amount', label: 'Amount', render: (value) => `$${parseFloat(value || 0).toFixed(2)}` },
                { key: 'payment_method', label: 'Method' },
                { key: 'reference_number', label: 'Reference', render: (value) => value || '-' },
                { key: 'payment_date', label: 'Date', render: (value) => new Date(value).toLocaleDateString() },
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

export default Payments
