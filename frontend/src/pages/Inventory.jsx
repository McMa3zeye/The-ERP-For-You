import { useState, useEffect, useMemo, useCallback } from 'react'
import { inventoryAPI, productsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'
import UnifiedChartBuilder from '../components/UnifiedChartBuilder'
import ChartWidget from '../components/ChartWidget'
import ChartImporter from '../components/ChartImporter'
import { exportChartData } from '../utils/export'
import { useAuth } from '../contexts/AuthContext'

function Inventory() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('inventory.create')
  const canUpdate = hasPermission('inventory.update')
  const canDelete = hasPermission('inventory.delete')
  const canAdjust = hasPermission('inventory.adjust') || hasPermission('inventory.update')
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showMovementForm, setShowMovementForm] = useState(false)
  const [alert, setAlert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500) // 500ms debounce
  const [filterLocation, setFilterLocation] = useState('')
  const [filterLowStock, setFilterLowStock] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20
  
  const [formData, setFormData] = useState({
    product_id: '',
    location: 'main_warehouse',
    quantity_on_hand: 0,
    reorder_point: 0,
    reorder_quantity: 0,
  })
  const [movementData, setMovementData] = useState({
    inventory_item_id: '',
    movement_type: 'ADJUST',
    quantity: 0,
    notes: '',
  })

  // Chart builder
  const [showChartBuilder, setShowChartBuilder] = useState(false)
  const [savedCharts, setSavedCharts] = useState([])

  // Load saved charts for this page
  useEffect(() => {
    const loadSavedCharts = () => {
      const saved = localStorage.getItem('savedCharts')
      if (saved) {
        try {
          const allCharts = JSON.parse(saved)
          setSavedCharts(allCharts.filter(c => c.postToPage === 'inventory'))
        } catch (e) {
          console.error('Error loading saved charts:', e)
        }
      }
    }
    loadSavedCharts()
    window.addEventListener('chartsUpdated', loadSavedCharts)
    return () => window.removeEventListener('chartsUpdated', loadSavedCharts)
  }, [])

  const handleSaveChart = (chartConfig) => {
    const existing = JSON.parse(localStorage.getItem('savedCharts') || '[]')
    const newCharts = [...existing, chartConfig]
    localStorage.setItem('savedCharts', JSON.stringify(newCharts))
    setSavedCharts(newCharts.filter(c => c.postToPage === 'inventory'))
    window.dispatchEvent(new Event('chartsUpdated'))
  }

  useEffect(() => {
    loadData()
  }, [])

  // Load products once on mount
  useEffect(() => {
    const loadProductsOnce = async () => {
      try {
        const response = await productsAPI.getAll({ limit: 1000, is_active: true })
        const productList = Array.isArray(response.data) ? response.data : (response.data.items || [])
        setProducts(productList)
      } catch (error) {
        console.error('Error loading products:', error)
      }
    }
    loadProductsOnce()
  }, [])

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterLocation, filterLowStock])

  // Load data when page or filters change (table-only refresh when filters change)
  useEffect(() => {
    const shouldSkipLoading = currentPage === 1 && (debouncedSearchTerm || filterLocation || filterLowStock)
    loadData(currentPage, shouldSkipLoading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm, filterLocation, filterLowStock])

  const loadData = useCallback(async (page = 1, skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true)
      const params = {
        skip: (page - 1) * itemsPerPage,
        limit: itemsPerPage
      }
      if (debouncedSearchTerm) params.search = debouncedSearchTerm
      if (filterLocation) params.location = filterLocation
      if (filterLowStock) params.low_stock = true
      
      const itemsRes = await inventoryAPI.getItems(params)
      
      // Handle response format
      if (itemsRes.data.items) {
        setItems(itemsRes.data.items)
        setTotalItems(itemsRes.data.total || 0)
      } else {
        setItems(itemsRes.data)
        setTotalItems(itemsRes.data.length)
      }
    } catch (error) {
      showAlert('⚠️ Error loading data: ' + (error.message || 'Unknown error'), 'error')
    } finally {
      if (!skipLoading) setLoading(false)
    }
  }, [debouncedSearchTerm, filterLocation, filterLowStock, itemsPerPage])
  
  // Refresh table only (keeps search/filters static)
  const refreshTable = useCallback(() => {
    loadData(currentPage, true) // Skip loading spinner
  }, [currentPage])

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    const timeoutId = setTimeout(() => setAlert(null), 4000)
    return () => clearTimeout(timeoutId)
  }, [])

  const handleCreateItem = async (e) => {
    e.preventDefault()
    try {
      await inventoryAPI.createItem(formData)
      showAlert('Inventory item created successfully')
      resetForm()
      loadData()
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleCreateMovement = async (e) => {
    e.preventDefault()
    try {
      await inventoryAPI.createMovement(movementData)
      showAlert('Inventory movement recorded successfully')
      resetMovementForm()
      loadData()
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      product_id: '',
      location: 'main_warehouse',
      quantity_on_hand: 0,
      reorder_point: 0,
      reorder_quantity: 0,
    })
    setShowForm(false)
  }

  const resetMovementForm = () => {
    setMovementData({
      inventory_item_id: '',
      movement_type: 'ADJUST',
      quantity: 0,
      notes: '',
    })
    setShowMovementForm(false)
  }

  const lowStockItems = items.filter(item => item.quantity_on_hand <= item.reorder_point)

  if (loading) {
    return <div className="spinner"></div>
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>
          📦 Inventory Management
          <PageHelpCorner />
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? '❌ Cancel' : '➕ Add Inventory Item'}
            </button>
          )}
          {canAdjust && (
            <button className="btn btn-success" onClick={() => setShowMovementForm(!showMovementForm)}>
              {showMovementForm ? '❌ Cancel' : '📝 Record Movement'}
            </button>
          )}
          <button className="btn btn-info" onClick={() => setShowChartBuilder(true)}>
            📊 Create Custom Chart
          </button>
          <button className="btn btn-secondary" onClick={refreshTable}>
            🔄 Refresh Table
          </button>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      {/* Search and Filters */}
      <div className="search-bar">
        <input
          type="search"
          placeholder="🔍 Search by product name or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: '2', minWidth: '250px' }}
        />
        <input
          type="text"
          placeholder="📍 Filter by location..."
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filterLowStock}
            onChange={(e) => setFilterLowStock(e.target.checked)}
          />
          ⚠️ Low Stock Only
        </label>
        {(searchTerm || filterLocation || filterLowStock) && (
          <button className="btn btn-secondary" onClick={() => {
            setSearchTerm('')
            setFilterLocation('')
            setFilterLowStock(false)
          }}>
            🗑️ Clear
          </button>
        )}
      </div>

      {lowStockItems.length > 0 && (
        <div className="card" style={{ backgroundColor: 'rgba(240, 184, 110, 0.15)', border: '2px solid var(--accent-amber)' }}>
          <h3 style={{ color: 'var(--accent-amber)' }}>⚠️ Low Stock Alert ({lowStockItems.length} items)</h3>
          <ul style={{ color: 'var(--brown-200)' }}>
            {lowStockItems.map(item => (
              <li key={item.id} style={{ marginBottom: '0.5rem' }}>
                {item.product?.name || 'Unknown'} - {item.location}: {item.quantity_on_hand} (Reorder: {item.reorder_point})
              </li>
            ))}
          </ul>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2>➕ New Inventory Item</h2>
          <form onSubmit={handleCreateItem}>
            <div className="form-row">
              <div className="form-group">
                <label>📦 Product *</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>📍 Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>🔢 Quantity on Hand</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quantity_on_hand}
                  onChange={(e) => setFormData({ ...formData, quantity_on_hand: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="form-group">
                <label>⚠️ Reorder Point</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.reorder_point}
                  onChange={(e) => setFormData({ ...formData, reorder_point: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label>📊 Reorder Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.reorder_quantity}
                  onChange={(e) => setFormData({ ...formData, reorder_quantity: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary">✨ Create Item</button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>❌ Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showMovementForm && (
        <div className="card">
          <h2>📝 Record Inventory Movement</h2>
          <form onSubmit={handleCreateMovement}>
            <div className="form-row">
              <div className="form-group">
                <label>Inventory Item *</label>
                <select
                  value={movementData.inventory_item_id}
                  onChange={(e) => setMovementData({ ...movementData, inventory_item_id: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Select Item</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.product?.name || 'Unknown'} - {item.location} (Qty: {item.quantity_on_hand})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Movement Type *</label>
                <select
                  value={movementData.movement_type}
                  onChange={(e) => setMovementData({ ...movementData, movement_type: e.target.value })}
                  required
                >
                  <option value="IN">IN (Stock In)</option>
                  <option value="OUT">OUT (Stock Out)</option>
                  <option value="ADJUST">ADJUST (Adjustment)</option>
                  <option value="TRANSFER">TRANSFER</option>
                </select>
              </div>
              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  step="0.01"
                  value={movementData.quantity}
                  onChange={(e) => setMovementData({ ...movementData, quantity: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={movementData.notes}
                onChange={(e) => setMovementData({ ...movementData, notes: e.target.value })}
                rows="3"
              />
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary">💾 Record Movement</button>
              <button type="button" className="btn btn-secondary" onClick={resetMovementForm}>❌ Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>📦 Inventory Items ({totalItems})</h2>
          <button className="btn btn-secondary" onClick={refreshTable} title="Refresh Table Only">
            🔄 Refresh Table
          </button>
        </div>
        {items.length === 0 && !loading ? (
          <p>No inventory items found. Create your first inventory item above.</p>
        ) : (
          <>
          <SortableTable
            data={items}
            columns={[
              { key: 'product', label: '📦 Product', render: (_, row) => row.product?.name || '-' },
              { key: 'sku', label: '🏷️ SKU', render: (_, row) => <strong>{row.product?.sku || '-'}</strong> },
              { key: 'location', label: '📍 Location' },
              { key: 'quantity_on_hand', label: '📊 On Hand' },
              { key: 'quantity_reserved', label: '🔒 Reserved' },
              { key: 'quantity_available', label: '✅ Available' },
              { key: 'reorder_point', label: '⚠️ Reorder Point' },
              {
                key: 'status',
                label: 'Status',
                render: (_, row) => {
                  const isLowStock = row.quantity_on_hand <= row.reorder_point
                  return isLowStock ? (
                    <span className="badge badge-warning">⚠️ LOW STOCK</span>
                  ) : (
                    <span className="badge badge-success">✅ OK</span>
                  )
                }
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

      {/* Saved Custom Charts Section for Inventory page */}
      {savedCharts.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ✨ Custom Charts for Inventory Page
            <button className="btn btn-secondary btn-sm" onClick={() => {
              if (window.confirm('Are you sure you want to clear all custom charts for this page?')) {
                const newSavedCharts = JSON.parse(localStorage.getItem('savedCharts') || '[]').filter(chart => chart.postToPage !== 'inventory')
                localStorage.setItem('savedCharts', JSON.stringify(newSavedCharts))
                setSavedCharts([])
                window.dispatchEvent(new Event('chartsUpdated'))
              }
            }}>Clear Page Charts</button>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
            {savedCharts.map(chartConfig => (
              <ChartWidget
                key={chartConfig.id}
                title={chartConfig.title}
                onExport={() => exportChartData(chartConfig.processedData, chartConfig.title)}
                onDelete={() => {
                  if (window.confirm('Are you sure you want to delete this custom chart?')) {
                    const newSavedCharts = JSON.parse(localStorage.getItem('savedCharts') || '[]').filter(chart => chart.id !== chartConfig.id)
                    localStorage.setItem('savedCharts', JSON.stringify(newSavedCharts))
                    setSavedCharts(newSavedCharts.filter(c => c.postToPage === 'inventory'))
                    window.dispatchEvent(new Event('chartsUpdated'))
                  }
                }}
                isCustom={true}
                chartConfig={chartConfig}
              />
            ))}
          </div>
        </div>
      )}

      {/* Chart Builder Modal */}
      {showChartBuilder && (
        <div className="modal-overlay" onClick={() => setShowChartBuilder(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95vw', width: '1200px' }}>
            <UnifiedChartBuilder
              onClose={() => setShowChartBuilder(false)}
              onSaveChart={handleSaveChart}
            />
          </div>
        </div>
      )}

    </div>
  )
}

export default Inventory

