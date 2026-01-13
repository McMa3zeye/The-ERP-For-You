import { useState, useEffect, useCallback } from 'react'
import { usersAPI, rolesAPI, permissionsAPI, auditLogsAPI, adminAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'

const TABS = ['Users', 'Roles', 'Permissions', 'Audit Logs', 'Settings']
const USER_STATUSES = [{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]

function Admin() {
  const [activeTab, setActiveTab] = useState('Users')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [alert, setAlert] = useState(null)
  
  // Users state
  const [users, setUsers] = useState([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  
  // Roles state
  const [roles, setRoles] = useState([])
  const [rolesTotal, setRolesTotal] = useState(0)
  const [rolesPage, setRolesPage] = useState(1)
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  
  // Permissions state
  const [permissions, setPermissions] = useState([])
  const [permissionsTotal, setPermissionsTotal] = useState(0)
  const [permissionsPage, setPermissionsPage] = useState(1)
  const [permissionModule, setPermissionModule] = useState('')
  
  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [auditModule, setAuditModule] = useState('')
  const [auditAction, setAuditAction] = useState('')
  
  const itemsPerPage = 20

  // Form data
  const [userFormData, setUserFormData] = useState({
    username: '', email: '', password: '', first_name: '', last_name: '',
    phone: '', is_active: true, is_superuser: false, role_ids: []
  })
  
  const [roleFormData, setRoleFormData] = useState({
    name: '', description: '', is_active: true, permission_ids: []
  })

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  // Load Users
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (usersPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (userSearch) params.search = userSearch
      const response = await usersAPI.getAll(params)
      setUsers(response.data.items || [])
      setUsersTotal(response.data.total || 0)
    } catch (err) {
      setError('Failed to load users')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [usersPage, userSearch])

  // Load Roles
  const loadRoles = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (rolesPage - 1) * itemsPerPage, limit: itemsPerPage }
      const response = await rolesAPI.getAll(params)
      setRoles(response.data.items || [])
      setRolesTotal(response.data.total || 0)
    } catch (err) {
      setError('Failed to load roles')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [rolesPage])

  // Load Permissions
  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (permissionsPage - 1) * itemsPerPage, limit: 100 }
      if (permissionModule) params.module = permissionModule
      const response = await permissionsAPI.getAll(params)
      setPermissions(response.data.items || [])
      setPermissionsTotal(response.data.total || 0)
    } catch (err) {
      setError('Failed to load permissions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [permissionsPage, permissionModule])

  // Load Audit Logs
  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true)
      const params = { skip: (auditPage - 1) * itemsPerPage, limit: itemsPerPage }
      if (auditModule) params.module = auditModule
      if (auditAction) params.action = auditAction
      const response = await auditLogsAPI.getAll(params)
      setAuditLogs(response.data.items || [])
      setAuditTotal(response.data.total || 0)
    } catch (err) {
      setError('Failed to load audit logs')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [auditPage, auditModule, auditAction])

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'Users') loadUsers()
    else if (activeTab === 'Roles') loadRoles()
    else if (activeTab === 'Permissions') loadPermissions()
    else if (activeTab === 'Audit Logs') loadAuditLogs()
  }, [activeTab, loadUsers, loadRoles, loadPermissions, loadAuditLogs])

  // User handlers
  const handleUserSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingUser) {
        const { password, ...updateData } = userFormData
        await usersAPI.update(editingUser.id, updateData)
        showAlert('User updated successfully')
      } else {
        await usersAPI.create(userFormData)
        showAlert('User created successfully')
      }
      setShowUserForm(false)
      setEditingUser(null)
      resetUserForm()
      loadUsers()
    } catch (err) {
      showAlert(err.message || 'Failed to save user', 'error')
    }
  }

  const handleEditUser = (user) => {
    setEditingUser(user)
    setUserFormData({
      username: user.username || '', email: user.email || '', password: '',
      first_name: user.first_name || '', last_name: user.last_name || '',
      phone: user.phone || '', is_active: user.is_active !== false,
      is_superuser: user.is_superuser || false,
      role_ids: user.roles?.map(r => r.id) || []
    })
    setShowUserForm(true)
  }

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return
    try {
      await usersAPI.delete(id)
      showAlert('User deleted successfully')
      loadUsers()
    } catch (err) {
      showAlert('Failed to delete user', 'error')
    }
  }

  const resetUserForm = () => {
    setUserFormData({
      username: '', email: '', password: '', first_name: '', last_name: '',
      phone: '', is_active: true, is_superuser: false, role_ids: []
    })
  }

  // Role handlers
  const handleRoleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingRole) {
        await rolesAPI.update(editingRole.id, roleFormData)
        showAlert('Role updated successfully')
      } else {
        await rolesAPI.create(roleFormData)
        showAlert('Role created successfully')
      }
      setShowRoleForm(false)
      setEditingRole(null)
      resetRoleForm()
      loadRoles()
    } catch (err) {
      showAlert(err.message || 'Failed to save role', 'error')
    }
  }

  const handleEditRole = (role) => {
    setEditingRole(role)
    setRoleFormData({
      name: role.name || '', description: role.description || '',
      is_active: role.is_active !== false,
      permission_ids: role.permissions?.map(p => p.id) || []
    })
    setShowRoleForm(true)
  }

  const handleDeleteRole = async (id) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return
    try {
      await rolesAPI.delete(id)
      showAlert('Role deleted successfully')
      loadRoles()
    } catch (err) {
      showAlert('Failed to delete role', 'error')
    }
  }

  const resetRoleForm = () => {
    setRoleFormData({ name: '', description: '', is_active: true, permission_ids: [] })
  }

  // Initialize system
  const handleInitPermissions = async () => {
    try {
      const response = await adminAPI.initPermissions()
      showAlert(response.data.message)
      loadPermissions()
    } catch (err) {
      showAlert('Failed to initialize permissions', 'error')
    }
  }

  const handleInitAdmin = async () => {
    try {
      const response = await adminAPI.initAdminUser()
      showAlert(`${response.data.message} - Username: ${response.data.username}, Password: ${response.data.default_password}`)
    } catch (err) {
      showAlert('Failed to create admin user', 'error')
    }
  }

  // Get unique modules from permissions
  const modules = [...new Set(permissions.map(p => p.module))].sort()

  if (loading && users.length === 0 && roles.length === 0) return <div className="loading">Loading...</div>
  if (error) return <div className="error">{error}</div>

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          🛡️ Admin & Security
          <PageHelpCorner />
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleInitPermissions} className="btn btn-secondary">Init Permissions</button>
          <button onClick={handleInitAdmin} className="btn btn-secondary">Init Admin User</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === tab ? 'var(--green-500)' : 'var(--brown-700)',
              color: activeTab === tab ? 'var(--brown-900)' : 'var(--brown-200)',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              marginRight: '2px'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'Users' && (
        <>
          <div className="filters-row">
            <input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="search-input"
            />
            <button onClick={() => { setShowUserForm(true); setEditingUser(null); resetUserForm() }} className="btn btn-primary">+ New User</button>
          </div>

          {showUserForm && (
            <div className="modal-overlay" onClick={() => setShowUserForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>{editingUser ? 'Edit User' : 'New User'}</h2>
                <form onSubmit={handleUserSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Username *</label>
                      <input type="text" value={userFormData.username} onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Email *</label>
                      <input type="email" value={userFormData.email} onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })} required />
                    </div>
                    {!editingUser && (
                      <div className="form-group">
                        <label>Password *</label>
                        <input type="password" value={userFormData.password} onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })} required={!editingUser} minLength={8} />
                      </div>
                    )}
                    <div className="form-group">
                      <label>First Name</label>
                      <input type="text" value={userFormData.first_name} onChange={(e) => setUserFormData({ ...userFormData, first_name: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input type="text" value={userFormData.last_name} onChange={(e) => setUserFormData({ ...userFormData, last_name: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input type="text" value={userFormData.phone} onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>
                        <input type="checkbox" checked={userFormData.is_active} onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })} />
                        Active
                      </label>
                    </div>
                    <div className="form-group">
                      <label>
                        <input type="checkbox" checked={userFormData.is_superuser} onChange={(e) => setUserFormData({ ...userFormData, is_superuser: e.target.checked })} />
                        Superuser
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Roles</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {roles.map(role => (
                        <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="checkbox"
                            checked={userFormData.role_ids.includes(role.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setUserFormData({ ...userFormData, role_ids: [...userFormData.role_ids, role.id] })
                              } else {
                                setUserFormData({ ...userFormData, role_ids: userFormData.role_ids.filter(id => id !== role.id) })
                              }
                            }}
                          />
                          {role.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowUserForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">{editingUser ? 'Update' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.username} {user.is_superuser && '👑'}</td>
                    <td>{user.email}</td>
                    <td>{[user.first_name, user.last_name].filter(Boolean).join(' ') || '-'}</td>
                    <td>{user.roles?.map(r => r.name).join(', ') || '-'}</td>
                    <td><span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</td>
                    <td className="actions-cell">
                      <button onClick={() => handleEditUser(user)} className="btn-icon" title="Edit">✏️</button>
                      <button onClick={() => handleDeleteUser(user.id)} className="btn-icon" title="Delete">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={usersPage} totalItems={usersTotal} itemsPerPage={itemsPerPage} onPageChange={setUsersPage} />
        </>
      )}

      {/* Roles Tab */}
      {activeTab === 'Roles' && (
        <>
          <div className="filters-row">
            <button onClick={() => { setShowRoleForm(true); setEditingRole(null); resetRoleForm() }} className="btn btn-primary">+ New Role</button>
          </div>

          {showRoleForm && (
            <div className="modal-overlay" onClick={() => setShowRoleForm(false)}>
              <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                <h2>{editingRole ? 'Edit Role' : 'New Role'}</h2>
                <form onSubmit={handleRoleSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Role Name *</label>
                      <input type="text" value={roleFormData.name} onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>
                        <input type="checkbox" checked={roleFormData.is_active} onChange={(e) => setRoleFormData({ ...roleFormData, is_active: e.target.checked })} />
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea value={roleFormData.description} onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })} rows="2" />
                  </div>
                  <div className="form-group">
                    <label>Permissions</label>
                    <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid var(--brown-600)', borderRadius: '4px', padding: '0.5rem' }}>
                      {modules.map(module => (
                        <div key={module} style={{ marginBottom: '0.5rem' }}>
                          <strong style={{ textTransform: 'capitalize' }}>{module.replace('_', ' ')}</strong>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginLeft: '1rem' }}>
                            {permissions.filter(p => p.module === module).map(perm => (
                              <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
                                <input
                                  type="checkbox"
                                  checked={roleFormData.permission_ids.includes(perm.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setRoleFormData({ ...roleFormData, permission_ids: [...roleFormData.permission_ids, perm.id] })
                                    } else {
                                      setRoleFormData({ ...roleFormData, permission_ids: roleFormData.permission_ids.filter(id => id !== perm.id) })
                                    }
                                  }}
                                />
                                {perm.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowRoleForm(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">{editingRole ? 'Update' : 'Create'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Description</th>
                  <th>Permissions</th>
                  <th>System</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <tr key={role.id}>
                    <td>{role.name}</td>
                    <td>{role.description || '-'}</td>
                    <td>{role.permissions?.length || 0} permissions</td>
                    <td>{role.is_system ? '🔒 System' : 'Custom'}</td>
                    <td><span className={`status-badge ${role.is_active ? 'active' : 'inactive'}`}>{role.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="actions-cell">
                      <button onClick={() => handleEditRole(role)} className="btn-icon" title="Edit" disabled={role.is_system}>✏️</button>
                      <button onClick={() => handleDeleteRole(role.id)} className="btn-icon" title="Delete" disabled={role.is_system}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={rolesPage} totalItems={rolesTotal} itemsPerPage={itemsPerPage} onPageChange={setRolesPage} />
        </>
      )}

      {/* Permissions Tab */}
      {activeTab === 'Permissions' && (
        <>
          <div className="filters-row">
            <select value={permissionModule} onChange={(e) => setPermissionModule(e.target.value)} className="filter-select">
              <option value="">All Modules</option>
              {modules.map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
            </select>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Permission Name</th>
                  <th>Code</th>
                  <th>Module</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map(perm => (
                  <tr key={perm.id}>
                    <td>{perm.name}</td>
                    <td><code>{perm.code}</code></td>
                    <td style={{ textTransform: 'capitalize' }}>{perm.module.replace('_', ' ')}</td>
                    <td>{perm.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={permissionsPage} totalItems={permissionsTotal} itemsPerPage={100} onPageChange={setPermissionsPage} />
        </>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'Audit Logs' && (
        <>
          <div className="filters-row">
            <select value={auditModule} onChange={(e) => setAuditModule(e.target.value)} className="filter-select">
              <option value="">All Modules</option>
              <option value="auth">Authentication</option>
              <option value="products">Products</option>
              <option value="orders">Orders</option>
              <option value="inventory">Inventory</option>
              <option value="admin">Admin</option>
            </select>
            <select value={auditAction} onChange={(e) => setAuditAction(e.target.value)} className="filter-select">
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
            </select>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Entity</th>
                  <th>Status</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.user_id || 'System'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{log.action}</td>
                    <td style={{ textTransform: 'capitalize' }}>{log.module}</td>
                    <td>{log.entity_type ? `${log.entity_type} #${log.entity_id}` : '-'}</td>
                    <td><span className={`status-badge ${log.status === 'success' ? 'active' : 'inactive'}`}>{log.status}</span></td>
                    <td>{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={auditPage} totalItems={auditTotal} itemsPerPage={itemsPerPage} onPageChange={setAuditPage} />
        </>
      )}

      {/* Settings Tab */}
      {activeTab === 'Settings' && (
        <div style={{ padding: '2rem' }}>
          <h2>System Settings</h2>
          <p style={{ color: 'var(--brown-300)' }}>System settings configuration will be available here. Use the buttons above to initialize permissions and create the default admin user.</p>
          
          <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--brown-700)', padding: '1.5rem', borderRadius: '8px' }}>
              <h3>Security</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--brown-300)' }}>Configure password policies, session timeouts, and security settings.</p>
            </div>
            <div style={{ background: 'var(--brown-700)', padding: '1.5rem', borderRadius: '8px' }}>
              <h3>Email</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--brown-300)' }}>Configure SMTP settings for email notifications.</p>
            </div>
            <div style={{ background: 'var(--brown-700)', padding: '1.5rem', borderRadius: '8px' }}>
              <h3>Backups</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--brown-300)' }}>Configure database backup schedules and retention.</p>
            </div>
            <div style={{ background: 'var(--brown-700)', padding: '1.5rem', borderRadius: '8px' }}>
              <h3>Integrations</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--brown-300)' }}>Configure third-party integrations and API keys.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
