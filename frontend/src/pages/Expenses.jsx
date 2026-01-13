import { useState, useEffect, useCallback } from 'react'
import { expensesAPI } from '../services/api'
import Pagination from '../components/Pagination'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'

function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [alert, setAlert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    category: '',
    description: '',
    amount: 0,
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'Cash',
    vendor: '',
    receipt_number: '',
    status: 'Pending',
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
      if (filterStatus) params.status = filterStatus
      if (filterCategory) params.category = filterCategory

      const response = await expensesAPI.getAll(params)
      if (response.data.items) {
        setExpenses(response.data.items)
        setTotalItems(response.data.total || 0)
      } else {
        setExpenses(response.data)
        setTotalItems(response.data.length)
      }
    } catch (error) {
      showAlert('Error loading expenses: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterCategory, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterStatus, filterCategory])

  useEffect(() => {
    loadData(currentPage)
  }, [currentPage, loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.description || !formData.amount) {
      showAlert('Description and amount are required', 'error')
      return
    }

    try {
      await expensesAPI.create({
        ...formData,
        amount: parseFloat(formData.amount),
        expense_date: formData.expense_date ? new Date(formData.expense_date).toISOString() : new Date().toISOString(),
      })
      showAlert('Expense created successfully!')
      resetForm()
      loadData()
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return
    try {
      await expensesAPI.delete(id)
      showAlert('Expense deleted successfully')
      loadData()
    } catch (error) {
      showAlert('Error deleting expense: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      category: '',
      description: '',
      amount: 0,
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash',
      vendor: '',
      receipt_number: '',
      status: 'Pending',
      notes: '',
    })
    setShowForm(false)
  }

  const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))]

  if (loading && expenses.length === 0) {
    return <div className="spinner"></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>💳 Expenses</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '❌ Cancel' : '➕ Add Expense'}
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      <div className="search-bar">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Reimbursed">Reimbursed</option>
          <option value="Rejected">Rejected</option>
        </select>
        {(filterCategory || filterStatus) && (
          <button className="btn btn-secondary" onClick={() => {
            setFilterCategory('')
            setFilterStatus('')
          }}>
            🗑️ Clear
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2>➕ New Expense</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>📂 Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  list="categories"
                  placeholder="Travel, Supplies, Utilities, etc."
                />
                <datalist id="categories">
                  {categories.map(cat => <option key={cat} value={cat} />)}
                  <option value="Travel" />
                  <option value="Supplies" />
                  <option value="Utilities" />
                  <option value="Office" />
                  <option value="Meals" />
                  <option value="Other" />
                </datalist>
              </div>
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
                <label>📅 Expense Date *</label>
                <input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>📝 Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>🏪 Vendor</label>
                <input
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>💳 Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Check">Check</option>
                </select>
              </div>
              <div className="form-group">
                <label>🧾 Receipt Number</label>
                <input
                  type="text"
                  value={formData.receipt_number}
                  onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
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
              <button type="submit" className="btn btn-primary">✨ Create Expense</button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>❌ Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2>💳 Expenses ({totalItems})</h2>
        {expenses.length === 0 && !loading ? (
          <p>No expenses found. Add your first expense above.</p>
        ) : (
          <>
            <SortableTable
              data={expenses}
              columns={[
                { key: 'expense_number', label: 'Expense #', render: (value) => <strong>{value}</strong> },
                { key: 'category', label: 'Category', render: (value) => value || '-' },
                { key: 'description', label: 'Description' },
                { key: 'vendor', label: 'Vendor', render: (value) => value || '-' },
                { key: 'amount', label: 'Amount', render: (value) => `$${parseFloat(value || 0).toFixed(2)}` },
                { key: 'expense_date', label: 'Date', render: (value) => new Date(value).toLocaleDateString() },
                { key: 'payment_method', label: 'Method' },
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

export default Expenses
