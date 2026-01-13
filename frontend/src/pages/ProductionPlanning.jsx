import { useState, useEffect, useCallback } from 'react'
import { productionResourcesAPI, productionSchedulesAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const SCHEDULE_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'delayed']
const STATUS_COLORS = {
  scheduled: '#3498db', in_progress: '#f39c12', completed: '#27ae60', cancelled: '#95a5a6', delayed: '#e74c3c'
}

function ProductionPlanning() {
  const [activeTab, setActiveTab] = useState('schedules')
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(null)
  
  // Resources state
  const [resources, setResources] = useState([])
  const [resourcesTotal, setResourcesTotal] = useState(0)
  const [resourcesPage, setResourcesPage] = useState(1)
  const [showResourceForm, setShowResourceForm] = useState(false)
  const [editingResource, setEditingResource] = useState(null)
  
  // Schedules state
  const [schedules, setSchedules] = useState([])
  const [schedulesTotal, setSchedulesTotal] = useState(0)
  const [schedulesPage, setSchedulesPage] = useState(1)
  const [scheduleStatus, setScheduleStatus] = useState('')
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  
  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState([])
  const [calendarStart, setCalendarStart] = useState(new Date().toISOString().split('T')[0])
  const [calendarEnd, setCalendarEnd] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  
  const itemsPerPage = 20
  
  const [resourceForm, setResourceForm] = useState({
    resource_code: '', name: '', resource_type: 'machine', location: '', capacity_per_hour: 1, hourly_cost: 0
  })
  
  const [scheduleForm, setScheduleForm] = useState({
    title: '', resource_id: '', scheduled_start: '', scheduled_end: '', quantity_planned: 1, priority: 5, color: '#3498db', notes: ''
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadResources = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (resourcesPage - 1) * itemsPerPage, limit: itemsPerPage }
      const response = await productionResourcesAPI.getAll(params)
      setResources(response.data.items || [])
      setResourcesTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load resources', err)
    } finally {
      setLoading(false)
    }
  }, [resourcesPage])

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (schedulesPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (scheduleStatus) params.status = scheduleStatus
      const response = await productionSchedulesAPI.getAll(params)
      setSchedules(response.data.items || [])
      setSchedulesTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load schedules', err)
    } finally {
      setLoading(false)
    }
  }, [schedulesPage, scheduleStatus])

  const loadCalendar = useCallback(async () => {
    try {
      setLoading(true)
      const response = await productionSchedulesAPI.getCalendar({ start: calendarStart, end: calendarEnd })
      setCalendarEvents(response.data.events || [])
    } catch (err) {
      console.error('Failed to load calendar', err)
    } finally {
      setLoading(false)
    }
  }, [calendarStart, calendarEnd])

  useEffect(() => {
    loadResources()
  }, [loadResources])

  useEffect(() => {
    if (activeTab === 'schedules') loadSchedules()
    else if (activeTab === 'calendar') loadCalendar()
  }, [activeTab, loadSchedules, loadCalendar])

  const handleResourceSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingResource) {
        await productionResourcesAPI.update(editingResource.id, resourceForm)
        showAlert('Resource updated')
      } else {
        await productionResourcesAPI.create(resourceForm)
        showAlert('Resource created')
      }
      setShowResourceForm(false)
      setEditingResource(null)
      loadResources()
    } catch (err) {
      showAlert('Failed to save resource', 'error')
    }
  }

  const handleScheduleSubmit = async (e) => {
    e.preventDefault()
    try {
      await productionSchedulesAPI.create({
        ...scheduleForm,
        resource_id: scheduleForm.resource_id || null
      })
      showAlert('Schedule created')
      setShowScheduleForm(false)
      loadSchedules()
      loadCalendar()
    } catch (err) {
      showAlert('Failed to create schedule', 'error')
    }
  }

  const handleStartSchedule = async (id) => {
    try {
      await productionSchedulesAPI.start(id)
      showAlert('Schedule started')
      loadSchedules()
    } catch (err) {
      showAlert('Failed to start schedule', 'error')
    }
  }

  const handleCompleteSchedule = async (id) => {
    try {
      await productionSchedulesAPI.complete(id)
      showAlert('Schedule completed')
      loadSchedules()
    } catch (err) {
      showAlert('Failed to complete schedule', 'error')
    }
  }

  const handleDeleteResource = async (id) => {
    if (!window.confirm('Delete this resource?')) return
    try {
      await productionResourcesAPI.delete(id)
      showAlert('Resource deleted')
      loadResources()
    } catch (err) {
      showAlert('Failed to delete resource', 'error')
    }
  }

  // Simple calendar view
  const getDaysInRange = () => {
    const days = []
    const start = new Date(calendarStart)
    const end = new Date(calendarEnd)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d))
    }
    return days
  }

  const getEventsForDay = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return calendarEvents.filter(e => {
      const start = e.start?.split('T')[0]
      const end = e.end?.split('T')[0]
      return start <= dateStr && end >= dateStr
    })
  }

  if (loading && resources.length === 0) return <div className="loading">Loading...</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          🗓️ Production Planning
          <PageHelpCorner />
        </h1>
      </div>

      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        {['schedules', 'calendar', 'resources'].map(tab => (
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

      {activeTab === 'schedules' && (
        <>
          <div className="filters-row">
            <select value={scheduleStatus} onChange={(e) => setScheduleStatus(e.target.value)} className="filter-select">
              <option value="">All Status</option>
              {SCHEDULE_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <button onClick={() => setShowScheduleForm(true)} className="btn btn-primary">+ New Schedule</button>
          </div>

          {showScheduleForm && (
            <div className="modal-overlay" onClick={() => setShowScheduleForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>New Production Schedule</h2>
                <form onSubmit={handleScheduleSubmit}>
                  <div className="form-group">
                    <label>Title *</label>
                    <input type="text" value={scheduleForm.title} onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })} required />
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Resource</label>
                      <select value={scheduleForm.resource_id} onChange={(e) => setScheduleForm({ ...scheduleForm, resource_id: e.target.value })}>
                        <option value="">No specific resource</option>
                        {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Priority (1-10)</label>
                      <input type="number" value={scheduleForm.priority} onChange={(e) => setScheduleForm({ ...scheduleForm, priority: parseInt(e.target.value) })} min="1" max="10" />
                    </div>
                    <div className="form-group">
                      <label>Start *</label>
                      <input type="datetime-local" value={scheduleForm.scheduled_start} onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_start: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>End *</label>
                      <input type="datetime-local" value={scheduleForm.scheduled_end} onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_end: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Quantity</label>
                      <input type="number" value={scheduleForm.quantity_planned} onChange={(e) => setScheduleForm({ ...scheduleForm, quantity_planned: parseFloat(e.target.value) })} min="0" step="0.01" />
                    </div>
                    <div className="form-group">
                      <label>Color</label>
                      <input type="color" value={scheduleForm.color} onChange={(e) => setScheduleForm({ ...scheduleForm, color: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea value={scheduleForm.notes} onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })} rows="2" />
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowScheduleForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">Create</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Schedule #</th>
                  <th>Title</th>
                  <th>Resource</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Qty</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map(s => (
                  <tr key={s.id}>
                    <td>{s.schedule_number}</td>
                    <td><span style={{ borderLeft: `4px solid ${s.color || STATUS_COLORS[s.status]}`, paddingLeft: '0.5rem' }}>{s.title}</span></td>
                    <td>{s.resource?.name || '-'}</td>
                    <td>{new Date(s.scheduled_start).toLocaleString()}</td>
                    <td>{new Date(s.scheduled_end).toLocaleString()}</td>
                    <td>{s.quantity_completed}/{s.quantity_planned}</td>
                    <td>{s.priority}</td>
                    <td><span className={`status-badge`} style={{ background: STATUS_COLORS[s.status] }}>{s.status.replace('_', ' ')}</span></td>
                    <td className="actions-cell">
                      {s.status === 'scheduled' && <button onClick={() => handleStartSchedule(s.id)} className="btn-icon" title="Start">▶️</button>}
                      {s.status === 'in_progress' && <button onClick={() => handleCompleteSchedule(s.id)} className="btn-icon" title="Complete">✅</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={schedulesPage} totalItems={schedulesTotal} itemsPerPage={itemsPerPage} onPageChange={setSchedulesPage} />
        </>
      )}

      {activeTab === 'calendar' && (
        <>
          <div className="filters-row">
            <label>From: <input type="date" value={calendarStart} onChange={(e) => setCalendarStart(e.target.value)} /></label>
            <label>To: <input type="date" value={calendarEnd} onChange={(e) => setCalendarEnd(e.target.value)} /></label>
            <button onClick={loadCalendar} className="btn btn-secondary">Refresh</button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(getDaysInRange().length, 7)}, 1fr)`, gap: '0.5rem', marginTop: '1rem' }}>
            {getDaysInRange().map(day => (
              <div key={day.toISOString()} style={{ background: 'var(--brown-800)', padding: '0.5rem', borderRadius: '4px', minHeight: '150px' }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid var(--brown-600)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                  {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                {getEventsForDay(day).map(event => (
                  <div key={event.id} style={{ background: event.color || '#3498db', padding: '0.25rem 0.5rem', borderRadius: '3px', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#fff' }}>
                    {event.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'resources' && (
        <>
          <div className="filters-row">
            <button onClick={() => { setShowResourceForm(true); setEditingResource(null); }} className="btn btn-primary">+ New Resource</button>
          </div>

          {showResourceForm && (
            <div className="modal-overlay" onClick={() => setShowResourceForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>{editingResource ? 'Edit Resource' : 'New Resource'}</h2>
                <form onSubmit={handleResourceSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Resource Code</label>
                      <input type="text" value={resourceForm.resource_code} onChange={(e) => setResourceForm({ ...resourceForm, resource_code: e.target.value })} placeholder="Auto-generated if blank" />
                    </div>
                    <div className="form-group">
                      <label>Name *</label>
                      <input type="text" value={resourceForm.name} onChange={(e) => setResourceForm({ ...resourceForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Type</label>
                      <select value={resourceForm.resource_type} onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}>
                        <option value="machine">Machine</option>
                        <option value="workstation">Workstation</option>
                        <option value="labor">Labor</option>
                        <option value="tool">Tool</option>
                        <option value="area">Work Area</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Location</label>
                      <input type="text" value={resourceForm.location} onChange={(e) => setResourceForm({ ...resourceForm, location: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Capacity/Hour</label>
                      <input type="number" value={resourceForm.capacity_per_hour} onChange={(e) => setResourceForm({ ...resourceForm, capacity_per_hour: parseFloat(e.target.value) })} min="0" step="0.1" />
                    </div>
                    <div className="form-group">
                      <label>Hourly Cost</label>
                      <input type="number" value={resourceForm.hourly_cost} onChange={(e) => setResourceForm({ ...resourceForm, hourly_cost: parseFloat(e.target.value) })} min="0" step="0.01" />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowResourceForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">{editingResource ? 'Update' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Capacity/Hr</th>
                  <th>Hourly Cost</th>
                  <th>Available</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resources.map(r => (
                  <tr key={r.id}>
                    <td>{r.resource_code}</td>
                    <td>{r.name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.resource_type}</td>
                    <td>{r.location || '-'}</td>
                    <td>{r.capacity_per_hour}</td>
                    <td>${r.hourly_cost?.toFixed(2)}</td>
                    <td>{r.is_available ? '✅' : '❌'}</td>
                    <td className="actions-cell">
                      <button onClick={() => { setEditingResource(r); setResourceForm(r); setShowResourceForm(true); }} className="btn-icon">✏️</button>
                      <button onClick={() => handleDeleteResource(r.id)} className="btn-icon">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={resourcesPage} totalItems={resourcesTotal} itemsPerPage={itemsPerPage} onPageChange={setResourcesPage} />
        </>
      )}
    </div>
  )
}

export default ProductionPlanning
