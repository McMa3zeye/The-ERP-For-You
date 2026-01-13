import { useState, useEffect, useCallback } from 'react'
import { toolsAPI, consumablesAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const TOOL_STATUSES = ['available', 'in_use', 'maintenance', 'retired']
const TOOL_CONDITIONS = ['new', 'good', 'fair', 'poor', 'worn']

function Tooling() {
  const [activeTab, setActiveTab] = useState('tools')
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(null)
  
  // Tools state
  const [tools, setTools] = useState([])
  const [toolsTotal, setToolsTotal] = useState(0)
  const [toolsPage, setToolsPage] = useState(1)
  const [toolStatus, setToolStatus] = useState('')
  const [showToolForm, setShowToolForm] = useState(false)
  const [editingTool, setEditingTool] = useState(null)
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
  const [selectedToolId, setSelectedToolId] = useState(null)
  
  // Consumables state
  const [consumables, setConsumables] = useState([])
  const [consumablesTotal, setConsumablesTotal] = useState(0)
  const [consumablesPage, setConsumablesPage] = useState(1)
  const [showLowStock, setShowLowStock] = useState(false)
  const [showConsumableForm, setShowConsumableForm] = useState(false)
  const [editingConsumable, setEditingConsumable] = useState(null)
  
  const itemsPerPage = 20
  
  const [toolForm, setToolForm] = useState({
    name: '', category: '', brand: '', model: '', size: '', description: '', location: '', lifespan_hours: '', purchase_cost: 0
  })
  
  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_type: 'inspection', performed_by: '', cost: 0, condition_after: 'good', notes: ''
  })
  
  const [consumableForm, setConsumableForm] = useState({
    name: '', category: '', brand: '', unit_of_measure: 'pcs', quantity_on_hand: 0, reorder_point: 10, unit_cost: 0, location: ''
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadTools = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (toolsPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (toolStatus) params.status = toolStatus
      const response = await toolsAPI.getAll(params)
      setTools(response.data.items || [])
      setToolsTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load tools', err)
    } finally {
      setLoading(false)
    }
  }, [toolsPage, toolStatus])

  const loadConsumables = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (consumablesPage - 1) * itemsPerPage, limit: itemsPerPage, low_stock: showLowStock }
      const response = await consumablesAPI.getAll(params)
      setConsumables(response.data.items || [])
      setConsumablesTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load consumables', err)
    } finally {
      setLoading(false)
    }
  }, [consumablesPage, showLowStock])

  useEffect(() => {
    if (activeTab === 'tools') loadTools()
    else if (activeTab === 'consumables') loadConsumables()
  }, [activeTab, loadTools, loadConsumables])

  const handleToolSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingTool) {
        await toolsAPI.update(editingTool.id, toolForm)
        showAlert('Tool updated')
      } else {
        await toolsAPI.create(toolForm)
        showAlert('Tool created')
      }
      setShowToolForm(false)
      setEditingTool(null)
      loadTools()
    } catch (err) {
      showAlert('Failed to save tool', 'error')
    }
  }

  const handleMaintenanceSubmit = async (e) => {
    e.preventDefault()
    try {
      await toolsAPI.logMaintenance(selectedToolId, maintenanceForm)
      showAlert('Maintenance logged')
      setShowMaintenanceForm(false)
      loadTools()
    } catch (err) {
      showAlert('Failed to log maintenance', 'error')
    }
  }

  const handleConsumableSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingConsumable) {
        await consumablesAPI.update(editingConsumable.id, consumableForm)
        showAlert('Consumable updated')
      } else {
        await consumablesAPI.create(consumableForm)
        showAlert('Consumable created')
      }
      setShowConsumableForm(false)
      setEditingConsumable(null)
      loadConsumables()
    } catch (err) {
      showAlert('Failed to save consumable', 'error')
    }
  }

  const handleRestock = async (id) => {
    const qty = prompt('Enter quantity to add:')
    if (!qty) return
    try {
      await consumablesAPI.restock(id, parseFloat(qty))
      showAlert('Restocked successfully')
      loadConsumables()
    } catch (err) {
      showAlert('Failed to restock', 'error')
    }
  }

  const handleUseConsumable = async (id) => {
    const qty = prompt('Enter quantity used:')
    if (!qty) return
    try {
      await consumablesAPI.use(id, { consumable_id: id, quantity_used: parseFloat(qty) })
      showAlert('Usage logged')
      loadConsumables()
    } catch (err) {
      showAlert('Failed to log usage', 'error')
    }
  }

  const getConditionColor = (condition) => {
    const colors = { new: '#27ae60', good: '#2ecc71', fair: '#f39c12', poor: '#e67e22', worn: '#e74c3c' }
    return colors[condition] || '#95a5a6'
  }

  if (loading && tools.length === 0) return <div className="loading">Loading...</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          🔧 Tooling & Consumables
          <PageHelpCorner />
        </h1>
      </div>

      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        {['tools', 'consumables'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem', border: 'none', textTransform: 'capitalize',
              background: activeTab === tab ? 'var(--green-500)' : 'var(--brown-700)',
              color: activeTab === tab ? 'var(--brown-900)' : 'var(--brown-200)',
              cursor: 'pointer', borderRadius: '4px 4px 0 0', marginRight: '2px'
            }}
          >{tab}</button>
        ))}
      </div>

      {activeTab === 'tools' && (
        <>
          <div className="filters-row">
            <select value={toolStatus} onChange={(e) => setToolStatus(e.target.value)} className="filter-select">
              <option value="">All Status</option>
              {TOOL_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <button onClick={() => { setShowToolForm(true); setEditingTool(null); setToolForm({ name: '', category: '', brand: '', model: '', size: '', description: '', location: '', lifespan_hours: '', purchase_cost: 0 }) }} className="btn btn-primary">+ New Tool</button>
          </div>

          {showToolForm && (
            <div className="modal-overlay" onClick={() => setShowToolForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>{editingTool ? 'Edit Tool' : 'New Tool'}</h2>
                <form onSubmit={handleToolSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Name *</label>
                      <input type="text" value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select value={toolForm.category} onChange={(e) => setToolForm({ ...toolForm, category: e.target.value })}>
                        <option value="">Select...</option>
                        <option value="saw_blade">Saw Blade</option>
                        <option value="router_bit">Router Bit</option>
                        <option value="drill_bit">Drill Bit</option>
                        <option value="sanding_disc">Sanding Disc</option>
                        <option value="chisel">Chisel</option>
                        <option value="hand_tool">Hand Tool</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Brand</label>
                      <input type="text" value={toolForm.brand} onChange={(e) => setToolForm({ ...toolForm, brand: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Model</label>
                      <input type="text" value={toolForm.model} onChange={(e) => setToolForm({ ...toolForm, model: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Size</label>
                      <input type="text" value={toolForm.size} onChange={(e) => setToolForm({ ...toolForm, size: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Location</label>
                      <input type="text" value={toolForm.location} onChange={(e) => setToolForm({ ...toolForm, location: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Lifespan (Hours)</label>
                      <input type="number" value={toolForm.lifespan_hours} onChange={(e) => setToolForm({ ...toolForm, lifespan_hours: e.target.value })} min="0" />
                    </div>
                    <div className="form-group">
                      <label>Purchase Cost</label>
                      <input type="number" value={toolForm.purchase_cost} onChange={(e) => setToolForm({ ...toolForm, purchase_cost: parseFloat(e.target.value) || 0 })} min="0" step="0.01" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea value={toolForm.description} onChange={(e) => setToolForm({ ...toolForm, description: e.target.value })} rows="2" />
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowToolForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">{editingTool ? 'Update' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showMaintenanceForm && (
            <div className="modal-overlay" onClick={() => setShowMaintenanceForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>Log Maintenance</h2>
                <form onSubmit={handleMaintenanceSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Type</label>
                      <select value={maintenanceForm.maintenance_type} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenance_type: e.target.value })}>
                        <option value="inspection">Inspection</option>
                        <option value="sharpening">Sharpening</option>
                        <option value="cleaning">Cleaning</option>
                        <option value="repair">Repair</option>
                        <option value="replacement">Replacement</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Performed By</label>
                      <input type="text" value={maintenanceForm.performed_by} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performed_by: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Cost</label>
                      <input type="number" value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: parseFloat(e.target.value) || 0 })} min="0" step="0.01" />
                    </div>
                    <div className="form-group">
                      <label>Condition After</label>
                      <select value={maintenanceForm.condition_after} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, condition_after: e.target.value })}>
                        {TOOL_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea value={maintenanceForm.notes} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })} rows="2" />
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowMaintenanceForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">Log Maintenance</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tool #</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th>Location</th>
                  <th>Hours Used</th>
                  <th>Condition</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tools.map(t => (
                  <tr key={t.id}>
                    <td>{t.tool_number}</td>
                    <td>{t.name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{t.category?.replace('_', ' ') || '-'}</td>
                    <td>{t.brand || '-'}</td>
                    <td>{t.location || '-'}</td>
                    <td>{t.hours_used} {t.lifespan_hours ? `/ ${t.lifespan_hours}` : ''}</td>
                    <td><span style={{ color: getConditionColor(t.condition), textTransform: 'capitalize' }}>{t.condition}</span></td>
                    <td><span className={`status-badge`} style={{ textTransform: 'capitalize' }}>{t.status?.replace('_', ' ')}</span></td>
                    <td className="actions-cell">
                      <button onClick={() => { setEditingTool(t); setToolForm(t); setShowToolForm(true) }} className="btn-icon" title="Edit">✏️</button>
                      <button onClick={() => { setSelectedToolId(t.id); setShowMaintenanceForm(true) }} className="btn-icon" title="Log Maintenance">🔧</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={toolsPage} totalItems={toolsTotal} itemsPerPage={itemsPerPage} onPageChange={setToolsPage} />
        </>
      )}

      {activeTab === 'consumables' && (
        <>
          <div className="filters-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={showLowStock} onChange={(e) => setShowLowStock(e.target.checked)} />
              Show Low Stock Only
            </label>
            <button onClick={() => { setShowConsumableForm(true); setEditingConsumable(null); setConsumableForm({ name: '', category: '', brand: '', unit_of_measure: 'pcs', quantity_on_hand: 0, reorder_point: 10, unit_cost: 0, location: '' }) }} className="btn btn-primary">+ New Consumable</button>
          </div>

          {showConsumableForm && (
            <div className="modal-overlay" onClick={() => setShowConsumableForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>{editingConsumable ? 'Edit Consumable' : 'New Consumable'}</h2>
                <form onSubmit={handleConsumableSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Name *</label>
                      <input type="text" value={consumableForm.name} onChange={(e) => setConsumableForm({ ...consumableForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select value={consumableForm.category} onChange={(e) => setConsumableForm({ ...consumableForm, category: e.target.value })}>
                        <option value="">Select...</option>
                        <option value="sandpaper">Sandpaper</option>
                        <option value="glue">Glue & Adhesives</option>
                        <option value="finish">Finishes</option>
                        <option value="screws">Screws</option>
                        <option value="nails">Nails</option>
                        <option value="hardware">Hardware</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Brand</label>
                      <input type="text" value={consumableForm.brand} onChange={(e) => setConsumableForm({ ...consumableForm, brand: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Unit</label>
                      <select value={consumableForm.unit_of_measure} onChange={(e) => setConsumableForm({ ...consumableForm, unit_of_measure: e.target.value })}>
                        <option value="pcs">Pieces</option>
                        <option value="sheets">Sheets</option>
                        <option value="liters">Liters</option>
                        <option value="kg">Kilograms</option>
                        <option value="box">Boxes</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Qty on Hand</label>
                      <input type="number" value={consumableForm.quantity_on_hand} onChange={(e) => setConsumableForm({ ...consumableForm, quantity_on_hand: parseFloat(e.target.value) || 0 })} min="0" />
                    </div>
                    <div className="form-group">
                      <label>Reorder Point</label>
                      <input type="number" value={consumableForm.reorder_point} onChange={(e) => setConsumableForm({ ...consumableForm, reorder_point: parseFloat(e.target.value) || 0 })} min="0" />
                    </div>
                    <div className="form-group">
                      <label>Unit Cost</label>
                      <input type="number" value={consumableForm.unit_cost} onChange={(e) => setConsumableForm({ ...consumableForm, unit_cost: parseFloat(e.target.value) || 0 })} min="0" step="0.01" />
                    </div>
                    <div className="form-group">
                      <label>Location</label>
                      <input type="text" value={consumableForm.location} onChange={(e) => setConsumableForm({ ...consumableForm, location: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowConsumableForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">{editingConsumable ? 'Update' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item #</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>On Hand</th>
                  <th>Reorder Pt</th>
                  <th>Unit Cost</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {consumables.map(c => (
                  <tr key={c.id} style={{ background: c.quantity_on_hand <= c.reorder_point ? 'rgba(231, 76, 60, 0.1)' : 'transparent' }}>
                    <td>{c.consumable_number}</td>
                    <td>{c.name} {c.quantity_on_hand <= c.reorder_point && '⚠️'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{c.category || '-'}</td>
                    <td style={{ color: c.quantity_on_hand <= c.reorder_point ? 'var(--red-400)' : 'inherit' }}>{c.quantity_on_hand} {c.unit_of_measure}</td>
                    <td>{c.reorder_point}</td>
                    <td>${c.unit_cost?.toFixed(2)}</td>
                    <td>{c.location || '-'}</td>
                    <td className="actions-cell">
                      <button onClick={() => { setEditingConsumable(c); setConsumableForm(c); setShowConsumableForm(true) }} className="btn-icon" title="Edit">✏️</button>
                      <button onClick={() => handleRestock(c.id)} className="btn-icon" title="Restock">📦</button>
                      <button onClick={() => handleUseConsumable(c.id)} className="btn-icon" title="Log Usage">➖</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={consumablesPage} totalItems={consumablesTotal} itemsPerPage={itemsPerPage} onPageChange={setConsumablesPage} />
        </>
      )}
    </div>
  )
}

export default Tooling
