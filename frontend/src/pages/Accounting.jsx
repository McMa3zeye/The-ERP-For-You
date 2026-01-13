import { useState, useEffect, useCallback } from 'react'
import { accountsAPI, journalEntriesAPI, accountingReportsAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense']
const TABS = ['Chart of Accounts', 'Journal Entries', 'Trial Balance', 'Balance Sheet']

function Accounting() {
  const [activeTab, setActiveTab] = useState('Chart of Accounts')
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(null)
  
  // Accounts state
  const [accounts, setAccounts] = useState([])
  const [accountsTotal, setAccountsTotal] = useState(0)
  const [accountsPage, setAccountsPage] = useState(1)
  const [accountType, setAccountType] = useState('')
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  
  // Journal entries state
  const [entries, setEntries] = useState([])
  const [entriesTotal, setEntriesTotal] = useState(0)
  const [entriesPage, setEntriesPage] = useState(1)
  const [entryStatus, setEntryStatus] = useState('')
  const [showEntryForm, setShowEntryForm] = useState(false)
  
  // Reports state
  const [trialBalance, setTrialBalance] = useState(null)
  const [balanceSheet, setBalanceSheet] = useState(null)
  
  const itemsPerPage = 20
  
  const [accountForm, setAccountForm] = useState({
    account_number: '', name: '', account_type: 'asset', description: '', normal_balance: 'debit'
  })
  
  const [entryForm, setEntryForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '', reference: '', notes: '',
    lines: [{ account_id: '', debit: 0, credit: 0, description: '' }, { account_id: '', debit: 0, credit: 0, description: '' }]
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (accountsPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (accountType) params.account_type = accountType
      const response = await accountsAPI.getAll(params)
      setAccounts(response.data.items || [])
      setAccountsTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load accounts', err)
    } finally {
      setLoading(false)
    }
  }, [accountsPage, accountType])

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (entriesPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (entryStatus) params.status = entryStatus
      const response = await journalEntriesAPI.getAll(params)
      setEntries(response.data.items || [])
      setEntriesTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load entries', err)
    } finally {
      setLoading(false)
    }
  }, [entriesPage, entryStatus])

  const loadTrialBalance = useCallback(async () => {
    try {
      setLoading(true)
      const response = await accountingReportsAPI.trialBalance()
      setTrialBalance(response.data)
    } catch (err) {
      console.error('Failed to load trial balance', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadBalanceSheet = useCallback(async () => {
    try {
      setLoading(true)
      const response = await accountingReportsAPI.balanceSheet()
      setBalanceSheet(response.data)
    } catch (err) {
      console.error('Failed to load balance sheet', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'Chart of Accounts') loadAccounts()
    else if (activeTab === 'Journal Entries') loadEntries()
    else if (activeTab === 'Trial Balance') loadTrialBalance()
    else if (activeTab === 'Balance Sheet') loadBalanceSheet()
  }, [activeTab, loadAccounts, loadEntries, loadTrialBalance, loadBalanceSheet])

  const handleInitAccounts = async () => {
    try {
      const response = await accountsAPI.initDefaults()
      showAlert(response.data.message)
      loadAccounts()
    } catch (err) {
      showAlert('Failed to initialize accounts', 'error')
    }
  }

  const handleAccountSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingAccount) {
        await accountsAPI.update(editingAccount.id, accountForm)
        showAlert('Account updated')
      } else {
        await accountsAPI.create(accountForm)
        showAlert('Account created')
      }
      setShowAccountForm(false)
      setEditingAccount(null)
      loadAccounts()
    } catch (err) {
      showAlert('Failed to save account', 'error')
    }
  }

  const handleEditAccount = (account) => {
    setEditingAccount(account)
    setAccountForm({
      account_number: account.account_number,
      name: account.name,
      account_type: account.account_type,
      description: account.description || '',
      normal_balance: account.normal_balance
    })
    setShowAccountForm(true)
  }

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('Delete this account?')) return
    try {
      await accountsAPI.delete(id)
      showAlert('Account deleted')
      loadAccounts()
    } catch (err) {
      showAlert('Failed to delete account', 'error')
    }
  }

  const handleEntrySubmit = async (e) => {
    e.preventDefault()
    try {
      const totalDebit = entryForm.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0)
      const totalCredit = entryForm.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0)
      
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        showAlert('Debits must equal credits', 'error')
        return
      }
      
      await journalEntriesAPI.create(entryForm)
      showAlert('Journal entry created')
      setShowEntryForm(false)
      loadEntries()
    } catch (err) {
      showAlert('Failed to create entry', 'error')
    }
  }

  const handlePostEntry = async (id) => {
    try {
      await journalEntriesAPI.post(id)
      showAlert('Entry posted')
      loadEntries()
    } catch (err) {
      showAlert('Failed to post entry', 'error')
    }
  }

  const addEntryLine = () => {
    setEntryForm({
      ...entryForm,
      lines: [...entryForm.lines, { account_id: '', debit: 0, credit: 0, description: '' }]
    })
  }

  const updateEntryLine = (index, field, value) => {
    const newLines = [...entryForm.lines]
    newLines[index][field] = value
    setEntryForm({ ...entryForm, lines: newLines })
  }

  if (loading && accounts.length === 0) return <div className="loading">Loading...</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          📔 Accounting & General Ledger
          <PageHelpCorner />
        </h1>
        <button onClick={handleInitAccounts} className="btn btn-secondary">Init Default Accounts</button>
      </div>

      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            style={{
              padding: '0.75rem 1.5rem', border: 'none',
              background: activeTab === tab ? 'var(--green-500)' : 'var(--brown-700)',
              color: activeTab === tab ? 'var(--brown-900)' : 'var(--brown-200)',
              cursor: 'pointer', borderRadius: '4px 4px 0 0', marginRight: '2px'
            }}
          >{tab}</button>
        ))}
      </div>

      {activeTab === 'Chart of Accounts' && (
        <>
          <div className="filters-row">
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className="filter-select">
              <option value="">All Types</option>
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <button onClick={() => { setShowAccountForm(true); setEditingAccount(null); setAccountForm({ account_number: '', name: '', account_type: 'asset', description: '', normal_balance: 'debit' }) }} className="btn btn-primary">+ New Account</button>
          </div>

          {showAccountForm && (
            <div className="modal-overlay" onClick={() => setShowAccountForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>{editingAccount ? 'Edit Account' : 'New Account'}</h2>
                <form onSubmit={handleAccountSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Account Number *</label>
                      <input type="text" value={accountForm.account_number} onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })} required disabled={!!editingAccount} />
                    </div>
                    <div className="form-group">
                      <label>Account Name *</label>
                      <input type="text" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Type *</label>
                      <select value={accountForm.account_type} onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })} disabled={!!editingAccount}>
                        {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Normal Balance</label>
                      <select value={accountForm.normal_balance} onChange={(e) => setAccountForm({ ...accountForm, normal_balance: e.target.value })}>
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea value={accountForm.description} onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })} rows="2" />
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowAccountForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">{editingAccount ? 'Update' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account #</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Normal Balance</th>
                  <th>Current Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => (
                  <tr key={account.id}>
                    <td>{account.account_number}</td>
                    <td>{account.name} {account.is_system && '🔒'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{account.account_type}</td>
                    <td style={{ textTransform: 'capitalize' }}>{account.normal_balance}</td>
                    <td style={{ textAlign: 'right' }}>${(account.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="actions-cell">
                      <button onClick={() => handleEditAccount(account)} className="btn-icon" disabled={account.is_system}>✏️</button>
                      <button onClick={() => handleDeleteAccount(account.id)} className="btn-icon" disabled={account.is_system}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={accountsPage} totalItems={accountsTotal} itemsPerPage={itemsPerPage} onPageChange={setAccountsPage} />
        </>
      )}

      {activeTab === 'Journal Entries' && (
        <>
          <div className="filters-row">
            <select value={entryStatus} onChange={(e) => setEntryStatus(e.target.value)} className="filter-select">
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="reversed">Reversed</option>
            </select>
            <button onClick={() => setShowEntryForm(true)} className="btn btn-primary">+ New Entry</button>
          </div>

          {showEntryForm && (
            <div className="modal-overlay" onClick={() => setShowEntryForm(false)}>
              <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                <h2>New Journal Entry</h2>
                <form onSubmit={handleEntrySubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Date *</label>
                      <input type="date" value={entryForm.entry_date} onChange={(e) => setEntryForm({ ...entryForm, entry_date: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Reference</label>
                      <input type="text" value={entryForm.reference} onChange={(e) => setEntryForm({ ...entryForm, reference: e.target.value })} placeholder="INV-001, etc." />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <input type="text" value={entryForm.description} onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })} />
                  </div>
                  
                  <h4>Entry Lines</h4>
                  <table className="data-table" style={{ marginBottom: '1rem' }}>
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Description</th>
                        <th>Debit</th>
                        <th>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entryForm.lines.map((line, idx) => (
                        <tr key={idx}>
                          <td>
                            <select value={line.account_id} onChange={(e) => updateEntryLine(idx, 'account_id', e.target.value)} required style={{ width: '100%' }}>
                              <option value="">Select Account</option>
                              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number} - {a.name}</option>)}
                            </select>
                          </td>
                          <td><input type="text" value={line.description} onChange={(e) => updateEntryLine(idx, 'description', e.target.value)} /></td>
                          <td><input type="number" value={line.debit} onChange={(e) => updateEntryLine(idx, 'debit', parseFloat(e.target.value) || 0)} min="0" step="0.01" /></td>
                          <td><input type="number" value={line.credit} onChange={(e) => updateEntryLine(idx, 'credit', parseFloat(e.target.value) || 0)} min="0" step="0.01" /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2"><button type="button" onClick={addEntryLine} className="btn btn-secondary">+ Add Line</button></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${entryForm.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${entryForm.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="form-actions">
                    <button type="button" onClick={() => setShowEntryForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">Create Entry</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entry #</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id}>
                    <td>{entry.entry_number}</td>
                    <td>{new Date(entry.entry_date).toLocaleDateString()}</td>
                    <td>{entry.description || '-'}</td>
                    <td>{entry.reference || '-'}</td>
                    <td style={{ textAlign: 'right' }}>${(entry.total_debit || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>${(entry.total_credit || 0).toFixed(2)}</td>
                    <td><span className={`status-badge ${entry.status}`}>{entry.status}</span></td>
                    <td className="actions-cell">
                      {entry.status === 'draft' && (
                        <button onClick={() => handlePostEntry(entry.id)} className="btn-icon" title="Post">✅</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={entriesPage} totalItems={entriesTotal} itemsPerPage={itemsPerPage} onPageChange={setEntriesPage} />
        </>
      )}

      {activeTab === 'Trial Balance' && trialBalance && (
        <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px' }}>
          <h3>Trial Balance as of {new Date(trialBalance.as_of_date).toLocaleDateString()}</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Account #</th>
                <th>Account Name</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.accounts?.map((acc, idx) => (
                <tr key={idx}>
                  <td>{acc.account_number}</td>
                  <td>{acc.account_name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{acc.account_type}</td>
                  <td style={{ textAlign: 'right' }}>{acc.debit > 0 ? `$${acc.debit.toFixed(2)}` : ''}</td>
                  <td style={{ textAlign: 'right' }}>{acc.credit > 0 ? `$${acc.credit.toFixed(2)}` : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--brown-500)' }}>
                <td colSpan="3">Totals</td>
                <td style={{ textAlign: 'right' }}>${trialBalance.total_debit?.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>${trialBalance.total_credit?.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: trialBalance.is_balanced ? 'var(--green-500)' : 'var(--red-500)' }}>
                  {trialBalance.is_balanced ? '✓ Balanced' : '⚠ Not Balanced'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {activeTab === 'Balance Sheet' && balanceSheet && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px' }}>
            <h3>Assets</h3>
            <table className="data-table">
              <tbody>
                {balanceSheet.assets?.map((acc, idx) => (
                  <tr key={idx}>
                    <td>{acc.account_name}</td>
                    <td style={{ textAlign: 'right' }}>${acc.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold' }}>
                  <td>Total Assets</td>
                  <td style={{ textAlign: 'right' }}>${balanceSheet.total_assets?.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div>
            <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <h3>Liabilities</h3>
              <table className="data-table">
                <tbody>
                  {balanceSheet.liabilities?.map((acc, idx) => (
                    <tr key={idx}>
                      <td>{acc.account_name}</td>
                      <td style={{ textAlign: 'right' }}>${acc.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 'bold' }}>
                    <td>Total Liabilities</td>
                    <td style={{ textAlign: 'right' }}>${balanceSheet.total_liabilities?.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px' }}>
              <h3>Equity</h3>
              <table className="data-table">
                <tbody>
                  {balanceSheet.equity?.map((acc, idx) => (
                    <tr key={idx}>
                      <td>{acc.account_name}</td>
                      <td style={{ textAlign: 'right' }}>${acc.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 'bold' }}>
                    <td>Total Equity</td>
                    <td style={{ textAlign: 'right' }}>${balanceSheet.total_equity?.toFixed(2)}</td>
                  </tr>
                  <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--brown-500)' }}>
                    <td>Total Liabilities + Equity</td>
                    <td style={{ textAlign: 'right' }}>${balanceSheet.total_liabilities_equity?.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Accounting
