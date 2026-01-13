import { useState, useEffect, useCallback } from 'react'
import { shippingAPI, salesOrdersAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const STATUSES = ['Pending', 'Packed', 'Shipped', 'In Transit', 'Delivered', 'Failed']
const CARRIERS = ['UPS', 'FedEx', 'DHL', 'USPS', 'Local Delivery', 'Customer Pickup', 'Other']

function Shipping() {
  const [shipments, setShipments] = useState([])
  const [salesOrders, setSalesOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingShipment, setEditingShipment] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [alert, setAlert] = useState(null)
  const itemsPerPage = 20

  const [formData, setFormData] = useState({
    sales_order_id: '', carrier: '', tracking_number: '', ship_date: '',
    expected_delivery_date: '', actual_delivery_date: '', status: 'Pending',
    shipping_cost: 0, weight: 0, dimensions: '', ship_from: '', ship_to: '', notes: ''
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadSalesOrders = useCallback(async () => {
    try {
      const response = await salesOrdersAPI.getAll({ limit: 100 })
      setSalesOrders(response.data.items || [])
    } catch (err) {
      console.error('Failed to load sales orders', err)
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (currentPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (searchTerm) params.search = searchTerm
      if (statusFilter) params.status = statusFilter
      const response = await shippingAPI.getAll(params)
      setShipments(response.data.items || [])
      setTotalItems(response.data.total || 0)
    } catch (err) {
      setError('Failed to load shipments')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, statusFilter])

  useEffect(() => { loadSalesOrders() }, [loadSalesOrders])
  useEffect(() => { loadData() }, [loadData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const submitData = { ...formData }
      if (submitData.sales_order_id) submitData.sales_order_id = parseInt(submitData.sales_order_id)
      else delete submitData.sales_order_id
      if (!submitData.ship_date) delete submitData.ship_date
      if (!submitData.expected_delivery_date) delete submitData.expected_delivery_date
      if (!submitData.actual_delivery_date) delete submitData.actual_delivery_date
      if (editingShipment) {
        await shippingAPI.update(editingShipment.id, submitData)
        showAlert('Shipment updated successfully')
      } else {
        await shippingAPI.create(submitData)
        showAlert('Shipment created successfully')
      }
      setShowForm(false)
      setEditingShipment(null)
      resetForm()
      loadData()
    } catch (err) {
      showAlert(err.message || 'Failed to save shipment', 'error')
    }
  }

  const handleEdit = (shipment) => {
    setEditingShipment(shipment)
    setFormData({
      sales_order_id: shipment.sales_order_id || '',
      carrier: shipment.carrier || '',
      tracking_number: shipment.tracking_number || '',
      ship_date: shipment.ship_date ? shipment.ship_date.split('T')[0] : '',
      expected_delivery_date: shipment.expected_delivery_date ? shipment.expected_delivery_date.split('T')[0] : '',
      actual_delivery_date: shipment.actual_delivery_date ? shipment.actual_delivery_date.split('T')[0] : '',
      status: shipment.status || 'Pending',
      shipping_cost: shipment.shipping_cost || 0,
      weight: shipment.weight || 0,
      dimensions: shipment.dimensions || '',
      ship_from: shipment.ship_from || '',
      ship_to: shipment.ship_to || '',
      notes: shipment.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await shippingAPI.delete(id)
      showAlert('Shipment deleted successfully')
      loadData()
    } catch (err) {
      showAlert('Failed to delete shipment', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      sales_order_id: '', carrier: '', tracking_number: '', ship_date: '',
      expected_delivery_date: '', actual_delivery_date: '', status: 'Pending',
      shipping_cost: 0, weight: 0, dimensions: '', ship_from: '', ship_to: '', notes: ''
    })
  }

  const getStatusColor = (status) => {
    const colors = { Pending: '#f59e0b', Packed: '#8b5cf6', Shipped: '#3b82f6', 'In Transit': '#06b6d4', Delivered: '#22c55e', Failed: '#ef4444' }
    return colors[status] || '#6b7280'
  }

  if (loading && shipments.length === 0) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          Shipping & Delivery
          <PageHelpCorner />
        </h1>
        <button onClick={() => { setShowForm(true); setEditingShipment(null); resetForm() }} className="btn btn-primary">+ New Shipment</button>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Search shipments..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingShipment ? 'Edit Shipment' : 'New Shipment'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Sales Order</label>
                  <select value={formData.sales_order_id} onChange={(e) => setFormData({ ...formData, sales_order_id: e.target.value })}>
                    <option value="">Select Order</option>
                    {salesOrders.map(o => <option key={o.id} value={o.id}>{o.order_number} - {o.customer_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Carrier</label>
                  <select value={formData.carrier} onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}>
                    <option value="">Select Carrier</option>
                    {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tracking Number</label>
                  <input type="text" value={formData.tracking_number} onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Ship Date</label>
                  <input type="date" value={formData.ship_date} onChange={(e) => setFormData({ ...formData, ship_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Expected Delivery</label>
                  <input type="date" value={formData.expected_delivery_date} onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Actual Delivery</label>
                  <input type="date" value={formData.actual_delivery_date} onChange={(e) => setFormData({ ...formData, actual_delivery_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Shipping Cost</label>
                  <input type="number" step="0.01" value={formData.shipping_cost} onChange={(e) => setFormData({ ...formData, shipping_cost: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input type="number" step="0.01" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Dimensions</label>
                  <input type="text" placeholder="L x W x H" value={formData.dimensions} onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Ship From</label>
                <textarea value={formData.ship_from} onChange={(e) => setFormData({ ...formData, ship_from: e.target.value })} rows="2" />
              </div>
              <div className="form-group">
                <label>Ship To</label>
                <textarea value={formData.ship_to} onChange={(e) => setFormData({ ...formData, ship_to: e.target.value })} rows="2" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="2" />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingShipment ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Shipment #</th>
              <th>Carrier</th>
              <th>Tracking</th>
              <th>Status</th>
              <th>Ship Date</th>
              <th>Expected</th>
              <th>Cost</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map(ship => (
              <tr key={ship.id}>
                <td>{ship.shipment_number}</td>
                <td>{ship.carrier || '-'}</td>
                <td>{ship.tracking_number || '-'}</td>
                <td><span className="status-badge" style={{ backgroundColor: getStatusColor(ship.status) }}>{ship.status}</span></td>
                <td>{ship.ship_date ? new Date(ship.ship_date).toLocaleDateString() : '-'}</td>
                <td>{ship.expected_delivery_date ? new Date(ship.expected_delivery_date).toLocaleDateString() : '-'}</td>
                <td>${(ship.shipping_cost || 0).toFixed(2)}</td>
                <td className="actions-cell">
                  <button onClick={() => handleEdit(ship)} className="btn-icon" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(ship.id)} className="btn-icon" title="Delete">🗑️</button>
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

export default Shipping
