import { useState, useEffect, useCallback } from 'react'
import { payrollPeriodsAPI, payslipsAPI, payrollReportsAPI } from '../services/api'
import PageHelpCorner from '../components/PageHelpCorner'
import Pagination from '../components/Pagination'

function Payroll() {
  const [activeTab, setActiveTab] = useState('periods')
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(null)
  
  const [periods, setPeriods] = useState([])
  const [periodsTotal, setPeriodsTotal] = useState(0)
  const [periodsPage, setPeriodsPage] = useState(1)
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  
  const [payslips, setPayslips] = useState([])
  const [payslipsTotal, setPayslipsTotal] = useState(0)
  const [payslipsPage, setPayslipsPage] = useState(1)
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  
  const [summary, setSummary] = useState(null)
  
  const itemsPerPage = 20
  
  const [periodForm, setPeriodForm] = useState({
    name: '', period_type: 'biweekly', start_date: '', end_date: '', pay_date: ''
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadPeriods = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (periodsPage - 1) * itemsPerPage, limit: itemsPerPage }
      const response = await payrollPeriodsAPI.getAll(params)
      setPeriods(response.data.items || [])
      setPeriodsTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load periods', err)
    } finally {
      setLoading(false)
    }
  }, [periodsPage])

  const loadPayslips = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (payslipsPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (selectedPeriod) params.period_id = selectedPeriod
      const response = await payslipsAPI.getAll(params)
      setPayslips(response.data.items || [])
      setPayslipsTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load payslips', err)
    } finally {
      setLoading(false)
    }
  }, [payslipsPage, selectedPeriod])

  const loadSummary = useCallback(async () => {
    try {
      const response = await payrollReportsAPI.summary({})
      setSummary(response.data)
    } catch (err) {
      console.error('Failed to load summary', err)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'periods') loadPeriods()
    else if (activeTab === 'payslips') loadPayslips()
    loadSummary()
  }, [activeTab, loadPeriods, loadPayslips, loadSummary])

  const handleCreatePeriod = async (e) => {
    e.preventDefault()
    try {
      await payrollPeriodsAPI.create(periodForm)
      showAlert('Payroll period created')
      setShowPeriodForm(false)
      loadPeriods()
    } catch (err) {
      showAlert('Failed to create period', 'error')
    }
  }

  const handleProcessPeriod = async (id) => {
    try {
      const response = await payrollPeriodsAPI.process(id)
      showAlert(`Processed ${response.data.payslips_created} payslips`)
      loadPeriods()
      loadPayslips()
    } catch (err) {
      showAlert('Failed to process payroll', 'error')
    }
  }

  const handleClosePeriod = async (id) => {
    if (!window.confirm('Close this payroll period? This cannot be undone.')) return
    try {
      await payrollPeriodsAPI.close(id)
      showAlert('Period closed')
      loadPeriods()
    } catch (err) {
      showAlert('Failed to close period', 'error')
    }
  }

  const handleApprovePayslip = async (id) => {
    try {
      await payslipsAPI.approve(id)
      showAlert('Payslip approved')
      loadPayslips()
    } catch (err) {
      showAlert('Failed to approve payslip', 'error')
    }
  }

  const handlePayPayslip = async (id) => {
    try {
      await payslipsAPI.pay(id, 'direct_deposit')
      showAlert('Payslip marked as paid')
      loadPayslips()
    } catch (err) {
      showAlert('Failed to mark as paid', 'error')
    }
  }

  if (loading && periods.length === 0) return <div className="loading">Loading...</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          💰 Payroll
          <PageHelpCorner />
        </h1>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--brown-800)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', color: 'var(--green-400)' }}>{summary.payslip_count}</div>
            <div style={{ color: 'var(--brown-300)' }}>Total Payslips</div>
          </div>
          <div style={{ background: 'var(--brown-800)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', color: 'var(--green-400)' }}>${summary.total_gross?.toLocaleString()}</div>
            <div style={{ color: 'var(--brown-300)' }}>Total Gross</div>
          </div>
          <div style={{ background: 'var(--brown-800)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', color: 'var(--orange-400)' }}>${summary.total_deductions?.toLocaleString()}</div>
            <div style={{ color: 'var(--brown-300)' }}>Deductions</div>
          </div>
          <div style={{ background: 'var(--brown-800)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', color: 'var(--green-400)' }}>${summary.total_net?.toLocaleString()}</div>
            <div style={{ color: 'var(--brown-300)' }}>Net Pay</div>
          </div>
        </div>
      )}

      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        {['periods', 'payslips'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem', border: 'none', textTransform: 'capitalize',
              background: activeTab === tab ? 'var(--green-500)' : 'var(--brown-700)',
              color: activeTab === tab ? 'var(--brown-900)' : 'var(--brown-200)',
              cursor: 'pointer', borderRadius: '4px 4px 0 0', marginRight: '2px'
            }}
          >{tab === 'periods' ? 'Payroll Periods' : 'Payslips'}</button>
        ))}
      </div>

      {activeTab === 'periods' && (
        <>
          <div className="filters-row">
            <button onClick={() => setShowPeriodForm(true)} className="btn btn-primary">+ New Period</button>
          </div>

          {showPeriodForm && (
            <div className="modal-overlay" onClick={() => setShowPeriodForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>New Payroll Period</h2>
                <form onSubmit={handleCreatePeriod}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Period Name *</label>
                      <input type="text" value={periodForm.name} onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })} required placeholder="Jan 1-15, 2026" />
                    </div>
                    <div className="form-group">
                      <label>Type</label>
                      <select value={periodForm.period_type} onChange={(e) => setPeriodForm({ ...periodForm, period_type: e.target.value })}>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Start Date *</label>
                      <input type="date" value={periodForm.start_date} onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>End Date *</label>
                      <input type="date" value={periodForm.end_date} onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Pay Date</label>
                      <input type="date" value={periodForm.pay_date} onChange={(e) => setPeriodForm({ ...periodForm, pay_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowPeriodForm(false)} className="btn btn-secondary">Cancel</button>
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
                  <th>Period Name</th>
                  <th>Type</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Pay Date</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {periods.map(p => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.period_type}</td>
                    <td>{new Date(p.start_date).toLocaleDateString()}</td>
                    <td>{new Date(p.end_date).toLocaleDateString()}</td>
                    <td>{p.pay_date ? new Date(p.pay_date).toLocaleDateString() : '-'}</td>
                    <td>${(p.total_gross || 0).toFixed(2)}</td>
                    <td>${(p.total_net || 0).toFixed(2)}</td>
                    <td><span className={`status-badge ${p.status}`}>{p.status}</span></td>
                    <td className="actions-cell">
                      {p.status === 'open' && <button onClick={() => handleProcessPeriod(p.id)} className="btn-icon" title="Process">⚙️</button>}
                      {p.status === 'processing' && <button onClick={() => handleClosePeriod(p.id)} className="btn-icon" title="Close">🔒</button>}
                      <button onClick={() => { setSelectedPeriod(p.id); setActiveTab('payslips') }} className="btn-icon" title="View Payslips">📋</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={periodsPage} totalItems={periodsTotal} itemsPerPage={itemsPerPage} onPageChange={setPeriodsPage} />
        </>
      )}

      {activeTab === 'payslips' && (
        <>
          <div className="filters-row">
            <select value={selectedPeriod || ''} onChange={(e) => setSelectedPeriod(e.target.value || null)} className="filter-select">
              <option value="">All Periods</option>
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payslip #</th>
                  <th>Employee ID</th>
                  <th>Regular Hrs</th>
                  <th>OT Hrs</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net Pay</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map(ps => (
                  <tr key={ps.id}>
                    <td>{ps.payslip_number}</td>
                    <td>EMP-{ps.employee_id}</td>
                    <td>{ps.regular_hours}</td>
                    <td>{ps.overtime_hours}</td>
                    <td>${ps.gross_pay?.toFixed(2)}</td>
                    <td>${ps.total_deductions?.toFixed(2)}</td>
                    <td style={{ fontWeight: 'bold' }}>${ps.net_pay?.toFixed(2)}</td>
                    <td><span className={`status-badge ${ps.status}`}>{ps.status}</span></td>
                    <td className="actions-cell">
                      {ps.status === 'draft' && <button onClick={() => handleApprovePayslip(ps.id)} className="btn-icon" title="Approve">✅</button>}
                      {ps.status === 'approved' && <button onClick={() => handlePayPayslip(ps.id)} className="btn-icon" title="Mark Paid">💵</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={payslipsPage} totalItems={payslipsTotal} itemsPerPage={itemsPerPage} onPageChange={setPayslipsPage} />
        </>
      )}
    </div>
  )
}

export default Payroll
