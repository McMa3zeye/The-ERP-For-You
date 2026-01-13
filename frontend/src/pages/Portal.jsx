import { useState, useEffect, useCallback } from 'react'
import { portalUsersAPI, portalMessagesAPI, portalNotificationsAPI, customersAPI, suppliersAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

function Portal() {
  const [activeTab, setActiveTab] = useState('users')
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(null)
  
  // Users state
  const [users, setUsers] = useState([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [userType, setUserType] = useState('')
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  
  // Messages state
  const [messages, setMessages] = useState([])
  const [messagesTotal, setMessagesTotal] = useState(0)
  const [showMessageForm, setShowMessageForm] = useState(false)
  
  // Support data
  const [customers, setCustomers] = useState([])
  const [suppliers, setSuppliers] = useState([])
  
  const itemsPerPage = 20
  
  const [userForm, setUserForm] = useState({
    email: '', password: '', user_type: 'customer', first_name: '', last_name: '', phone: '', linked_customer_id: '', linked_supplier_id: ''
  })
  
  const [messageForm, setMessageForm] = useState({
    portal_user_id: '', subject: '', message: '', direction: 'outbound'
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (usersPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (userType) params.user_type = userType
      const response = await portalUsersAPI.getAll(params)
      setUsers(response.data.items || [])
      setUsersTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load portal users', err)
    } finally {
      setLoading(false)
    }
  }, [usersPage, userType])

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)
      const params = { limit: 50 }
      if (selectedUser) params.portal_user_id = selectedUser.id
      const response = await portalMessagesAPI.getAll(params)
      setMessages(response.data.items || [])
      setMessagesTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load messages', err)
    } finally {
      setLoading(false)
    }
  }, [selectedUser])

  const loadSupportData = useCallback(async () => {
    try {
      const [custRes, suppRes] = await Promise.all([
        customersAPI.getAll({ limit: 100 }),
        suppliersAPI.getAll({ limit: 100 })
      ])
      setCustomers(custRes.data.items || [])
      setSuppliers(suppRes.data.items || [])
    } catch (err) {
      console.error('Failed to load support data', err)
    }
  }, [])

  useEffect(() => {
    loadSupportData()
  }, [loadSupportData])

  useEffect(() => {
    if (activeTab === 'users') loadUsers()
    else if (activeTab === 'messages') loadMessages()
  }, [activeTab, loadUsers, loadMessages])

  const handleUserSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = { ...userForm }
      if (data.linked_customer_id === '') data.linked_customer_id = null
      if (data.linked_supplier_id === '') data.linked_supplier_id = null
      
      if (editingUser) {
        const { password, ...updateData } = data
        await portalUsersAPI.update(editingUser.id, updateData)
        showAlert('Portal user updated')
      } else {
        await portalUsersAPI.create(data)
        showAlert('Portal user created')
      }
      setShowUserForm(false)
      setEditingUser(null)
      loadUsers()
    } catch (err) {
      showAlert('Failed to save user: ' + (err.response?.data?.detail || err.message), 'error')
    }
  }

  const handleMessageSubmit = async (e) => {
    e.preventDefault()
    try {
      await portalMessagesAPI.send(messageForm)
      showAlert('Message sent')
      setShowMessageForm(false)
      loadMessages()
    } catch (err) {
      showAlert('Failed to send message', 'error')
    }
  }

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete this portal user?')) return
    try {
      await portalUsersAPI.delete(id)
      showAlert('User deleted')
      loadUsers()
    } catch (err) {
      showAlert('Failed to delete user', 'error')
    }
  }

  const handleEditUser = (user) => {
    setEditingUser(user)
    setUserForm({
      email: user.email,
      password: '',
      user_type: user.user_type,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      linked_customer_id: user.linked_customer_id || '',
      linked_supplier_id: user.linked_supplier_id || ''
    })
    setShowUserForm(true)
  }

  const viewUserDetails = async (user) => {
    try {
      const statsRes = await portalUsersAPI.getStats(user.id)
      setSelectedUser({ ...user, stats: statsRes.data })
    } catch (err) {
      setSelectedUser(user)
    }
  }

  const resetUserForm = () => {
    setUserForm({
      email: '', password: '', user_type: 'customer', first_name: '', last_name: '', phone: '', linked_customer_id: '', linked_supplier_id: ''
    })
  }

  if (loading && users.length === 0) return <div className="loading">Loading...</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          🌐 Customer/Supplier Portal
          <PageHelpCorner />
        </h1>
      </div>

      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        {['users', 'messages'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem', border: 'none', textTransform: 'capitalize',
              background: activeTab === tab ? 'var(--green-500)' : 'var(--brown-700)',
              color: activeTab === tab ? 'var(--brown-900)' : 'var(--brown-200)',
              cursor: 'pointer', borderRadius: '4px 4px 0 0', marginRight: '2px'
            }}
          >{tab === 'users' ? 'Portal Users' : 'Messages'}</button>
        ))}
      </div>

      {activeTab === 'users' && (
        <>
          <div className="filters-row">
            <select value={userType} onChange={(e) => setUserType(e.target.value)} className="filter-select">
              <option value="">All Types</option>
              <option value="customer">Customers</option>
              <option value="supplier">Suppliers</option>
            </select>
            <button onClick={() => { setShowUserForm(true); setEditingUser(null); resetUserForm() }} className="btn btn-primary">+ New Portal User</button>
          </div>

          {showUserForm && (
            <div className="modal-overlay" onClick={() => setShowUserForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>{editingUser ? 'Edit Portal User' : 'New Portal User'}</h2>
                <form onSubmit={handleUserSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Email *</label>
                      <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
                    </div>
                    {!editingUser && (
                      <div className="form-group">
                        <label>Password *</label>
                        <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required minLength={6} />
                      </div>
                    )}
                    <div className="form-group">
                      <label>User Type</label>
                      <select value={userForm.user_type} onChange={(e) => setUserForm({ ...userForm, user_type: e.target.value })} disabled={!!editingUser}>
                        <option value="customer">Customer</option>
                        <option value="supplier">Supplier</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>First Name</label>
                      <input type="text" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input type="text" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input type="text" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
                    </div>
                    {userForm.user_type === 'customer' && (
                      <div className="form-group">
                        <label>Link to Customer</label>
                        <select value={userForm.linked_customer_id} onChange={(e) => setUserForm({ ...userForm, linked_customer_id: e.target.value })}>
                          <option value="">Select customer...</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                        </select>
                      </div>
                    )}
                    {userForm.user_type === 'supplier' && (
                      <div className="form-group">
                        <label>Link to Supplier</label>
                        <select value={userForm.linked_supplier_id} onChange={(e) => setUserForm({ ...userForm, linked_supplier_id: e.target.value })}>
                          <option value="">Select supplier...</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowUserForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">{editingUser ? 'Update' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {selectedUser && (
            <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>Portal User Details</h2>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Name:</strong> {selectedUser.first_name} {selectedUser.last_name}</p>
                <p><strong>Type:</strong> {selectedUser.user_type}</p>
                <p><strong>Status:</strong> {selectedUser.is_active ? 'Active' : 'Inactive'} {selectedUser.is_verified && '✓ Verified'}</p>
                <p><strong>Last Login:</strong> {selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never'}</p>
                
                {selectedUser.stats && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--brown-700)', borderRadius: '4px' }}>
                    <h4>Statistics</h4>
                    <p>Unread Messages: {selectedUser.stats.unread_messages}</p>
                    <p>Unread Notifications: {selectedUser.stats.unread_notifications}</p>
                    {selectedUser.stats.total_orders !== undefined && <p>Total Orders: {selectedUser.stats.total_orders}</p>}
                    {selectedUser.stats.pending_invoices !== undefined && <p>Pending Invoices: {selectedUser.stats.pending_invoices}</p>}
                    {selectedUser.stats.total_purchase_orders !== undefined && <p>Purchase Orders: {selectedUser.stats.total_purchase_orders}</p>}
                  </div>
                )}
                
                <div className="form-actions">
                  <button onClick={() => { setSelectedUser(null); setActiveTab('messages') }} className="btn btn-secondary">View Messages</button>
                  <button onClick={() => setSelectedUser(null)} className="btn btn-primary">Close</button>
                </div>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Linked To</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><a href="#" onClick={(e) => { e.preventDefault(); viewUserDetails(u) }} style={{ color: 'var(--green-400)' }}>{u.email}</a></td>
                    <td>{u.first_name} {u.last_name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{u.user_type}</td>
                    <td>
                      {u.linked_customer_id && `Customer #${u.linked_customer_id}`}
                      {u.linked_supplier_id && `Supplier #${u.linked_supplier_id}`}
                      {!u.linked_customer_id && !u.linked_supplier_id && '-'}
                    </td>
                    <td>{u.is_active ? <span style={{ color: 'var(--green-400)' }}>Active</span> : <span style={{ color: 'var(--red-400)' }}>Inactive</span>} {u.is_verified && '✓'}</td>
                    <td>{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                    <td className="actions-cell">
                      <button onClick={() => handleEditUser(u)} className="btn-icon" title="Edit">✏️</button>
                      <button onClick={() => handleDeleteUser(u.id)} className="btn-icon" title="Delete">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={usersPage} totalItems={usersTotal} itemsPerPage={itemsPerPage} onPageChange={setUsersPage} />
        </>
      )}

      {activeTab === 'messages' && (
        <>
          <div className="filters-row">
            <select value={selectedUser?.id || ''} onChange={(e) => {
              const userId = e.target.value
              if (userId) {
                const user = users.find(u => u.id === parseInt(userId))
                setSelectedUser(user)
              } else {
                setSelectedUser(null)
              }
            }} className="filter-select">
              <option value="">All Users</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
            <button onClick={() => setShowMessageForm(true)} className="btn btn-primary">+ Send Message</button>
          </div>

          {showMessageForm && (
            <div className="modal-overlay" onClick={() => setShowMessageForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>Send Message</h2>
                <form onSubmit={handleMessageSubmit}>
                  <div className="form-group">
                    <label>To Portal User *</label>
                    <select value={messageForm.portal_user_id} onChange={(e) => setMessageForm({ ...messageForm, portal_user_id: e.target.value })} required>
                      <option value="">Select user...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Subject *</label>
                    <input type="text" value={messageForm.subject} onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Message *</label>
                    <textarea value={messageForm.message} onChange={(e) => setMessageForm({ ...messageForm, message: e.target.value })} rows="4" required />
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowMessageForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">Send</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Direction</th>
                  <th>User</th>
                  <th>Subject</th>
                  <th>Read</th>
                </tr>
              </thead>
              <tbody>
                {messages.map(m => (
                  <tr key={m.id}>
                    <td>{new Date(m.created_at).toLocaleString()}</td>
                    <td>{m.direction === 'inbound' ? '📥 Inbound' : '📤 Outbound'}</td>
                    <td>{users.find(u => u.id === m.portal_user_id)?.email || `User #${m.portal_user_id}`}</td>
                    <td>
                      <strong>{m.subject}</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--brown-400)', marginTop: '0.25rem' }}>{m.message.substring(0, 100)}{m.message.length > 100 && '...'}</div>
                    </td>
                    <td>{m.is_read ? '✅' : '⏳'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default Portal
