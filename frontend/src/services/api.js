import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
})

// Request interceptor for logging and error handling
api.interceptors.request.use(
  (config) => {
    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`, config.params || config.data)
    }
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error
      const status = error.response.status
      const message = error.response.data?.detail || error.response.data?.message || 'An error occurred'
      
      if (status === 401) {
        // Handle unauthorized
        console.error('Unauthorized access')
      } else if (status === 403) {
        console.error('Forbidden access')
      } else if (status === 404) {
        console.error('Resource not found')
      } else if (status >= 500) {
        console.error('Server error:', message)
      }
      
      // Return error with consistent format
      return Promise.reject({
        ...error,
        message: message,
        status: status
      })
    } else if (error.request) {
      // Request made but no response
      console.error('Network error:', error.message)
      return Promise.reject({
        ...error,
        message: 'Network error. Please check your connection.',
        status: 0
      })
    } else {
      // Something else happened
      console.error('Error:', error.message)
      return Promise.reject({
        ...error,
        message: error.message || 'An unexpected error occurred',
        status: null
      })
    }
  }
)

// Products API
export const productsAPI = {
  getAll: (params) => {
    // Normalize params - convert boolean to string for query parameter
    const normalizedParams = { ...params }
    if (normalizedParams.is_active !== undefined && normalizedParams.is_active !== null) {
      // Convert boolean to string "true" or "false" for query parameter
      normalizedParams.is_active = String(normalizedParams.is_active === true || normalizedParams.is_active === 'true' || normalizedParams.is_active === '1')
    }
    return api.get('/products', { params: normalizedParams })
  },
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  // Ingredients/BOM
  getIngredients: (productId) => api.get(`/products/${productId}/ingredients`),
  addIngredient: (productId, data) => api.post(`/products/${productId}/ingredients`, data),
  removeIngredient: (productId, ingredientId) => api.delete(`/products/${productId}/ingredients/${ingredientId}`),
  // Linked Sales Orders
  getSalesOrders: (productId) => api.get(`/products/${productId}/sales-orders`),
  // Categories
  getCategories: () => api.get('/products/categories'),
}

// Inventory API
export const inventoryAPI = {
  getItems: (params) => api.get('/inventory/items', { params }),
  getItem: (id) => api.get(`/inventory/items/${id}`),
  createItem: (data) => api.post('/inventory/items', data),
  updateItem: (id, data) => api.put(`/inventory/items/${id}`, data),
  getLowStock: () => api.get('/inventory/low-stock'),
  createMovement: (data) => api.post('/inventory/movements', data),
  getMovements: (params) => api.get('/inventory/movements', { params }),
}

// Sales Orders API
export const salesOrdersAPI = {
  getAll: (params) => api.get('/sales-orders', { params }),
  getById: (id) => api.get(`/sales-orders/${id}`),
  create: (data) => api.post('/sales-orders', data),
  update: (id, data) => api.put(`/sales-orders/${id}`, data),
  nextStatus: (id) => api.post(`/sales-orders/${id}/next-status`), // New status progression
  delete: (id) => api.delete(`/sales-orders/${id}`),
}

// Dashboard/Stats API
export const statsAPI = {
  getStats: (params) => api.get('/stats', { params }),
  getOverview: () => api.get('/stats/overview'),
}

// Customers API
export const customersAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  getOrders: (customerId) => api.get(`/customers/${customerId}/orders`),
}

// Quotes API
export const quotesAPI = {
  getAll: (params) => api.get('/quotes', { params }),
  getById: (id) => api.get(`/quotes/${id}`),
  create: (data) => api.post('/quotes', data),
  update: (id, data) => api.put(`/quotes/${id}`, data),
  delete: (id) => api.delete(`/quotes/${id}`),
}

// Invoices API
export const invoicesAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
}

// Payments API
export const paymentsAPI = {
  getAll: (params) => api.get('/payments', { params }),
  getById: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post('/payments', data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  delete: (id) => api.delete(`/payments/${id}`),
}

// Suppliers API
export const suppliersAPI = {
  getAll: (params) => api.get('/suppliers', { params }),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
}

// Purchasing API
export const purchasingAPI = {
  getAll: (params) => api.get('/purchasing', { params }),
  getById: (id) => api.get(`/purchasing/${id}`),
  create: (data) => api.post('/purchasing', data),
  update: (id, data) => api.put(`/purchasing/${id}`, data),
  delete: (id) => api.delete(`/purchasing/${id}`),
}

// Work Orders API
export const workOrdersAPI = {
  getAll: (params) => api.get('/work-orders', { params }),
  getById: (id) => api.get(`/work-orders/${id}`),
  create: (data) => api.post('/work-orders', data),
  update: (id, data) => api.put(`/work-orders/${id}`, data),
  delete: (id) => api.delete(`/work-orders/${id}`),
}

// Expenses API
export const expensesAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
}

// Projects API
export const projectsAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  createTask: (projectId, data) => api.post(`/projects/${projectId}/tasks`, data),
  updateTask: (taskId, data) => api.put(`/projects/tasks/${taskId}`, data),
  deleteTask: (taskId) => api.delete(`/projects/tasks/${taskId}`),
}

// Support Tickets API
export const supportTicketsAPI = {
  getAll: (params) => api.get('/support-tickets', { params }),
  getById: (id) => api.get(`/support-tickets/${id}`),
  create: (data) => api.post('/support-tickets', data),
  update: (id, data) => api.put(`/support-tickets/${id}`, data),
  delete: (id) => api.delete(`/support-tickets/${id}`),
}

// Leads API
export const leadsAPI = {
  getAll: (params) => api.get('/leads', { params }),
  getById: (id) => api.get(`/leads/${id}`),
  create: (data) => api.post('/leads', data),
  update: (id, data) => api.put(`/leads/${id}`, data),
  delete: (id) => api.delete(`/leads/${id}`),
}

// Warehousing API
export const warehousingAPI = {
  getAll: (params) => api.get('/warehousing', { params }),
  getById: (id) => api.get(`/warehousing/${id}`),
  create: (data) => api.post('/warehousing', data),
  update: (id, data) => api.put(`/warehousing/${id}`, data),
  delete: (id) => api.delete(`/warehousing/${id}`),
}

// Manufacturing/BOM API
export const manufacturingAPI = {
  getAll: (params) => api.get('/manufacturing', { params }),
  getById: (id) => api.get(`/manufacturing/${id}`),
  create: (data) => api.post('/manufacturing', data),
  update: (id, data) => api.put(`/manufacturing/${id}`, data),
  delete: (id) => api.delete(`/manufacturing/${id}`),
  addComponent: (bomId, data) => api.post(`/manufacturing/${bomId}/components`, data),
  removeComponent: (bomId, componentId) => api.delete(`/manufacturing/${bomId}/components/${componentId}`),
}

// Quality API
export const qualityAPI = {
  getAll: (params) => api.get('/quality', { params }),
  getById: (id) => api.get(`/quality/${id}`),
  create: (data) => api.post('/quality', data),
  update: (id, data) => api.put(`/quality/${id}`, data),
  delete: (id) => api.delete(`/quality/${id}`),
}

// Shipping API
export const shippingAPI = {
  getAll: (params) => api.get('/shipping', { params }),
  getById: (id) => api.get(`/shipping/${id}`),
  create: (data) => api.post('/shipping', data),
  update: (id, data) => api.put(`/shipping/${id}`, data),
  delete: (id) => api.delete(`/shipping/${id}`),
}

// Returns/RMA API
export const returnsAPI = {
  getAll: (params) => api.get('/returns', { params }),
  getById: (id) => api.get(`/returns/${id}`),
  create: (data) => api.post('/returns', data),
  update: (id, data) => api.put(`/returns/${id}`, data),
  delete: (id) => api.delete(`/returns/${id}`),
}

// Time & Attendance API
export const timeAttendanceAPI = {
  getAll: (params) => api.get('/time-attendance', { params }),
  getById: (id) => api.get(`/time-attendance/${id}`),
  create: (data) => api.post('/time-attendance', data),
  update: (id, data) => api.put(`/time-attendance/${id}`, data),
  delete: (id) => api.delete(`/time-attendance/${id}`),
}

// HR/Employees API
export const hrAPI = {
  getAll: (params) => api.get('/hr', { params }),
  getById: (id) => api.get(`/hr/${id}`),
  create: (data) => api.post('/hr', data),
  update: (id, data) => api.put(`/hr/${id}`, data),
  delete: (id) => api.delete(`/hr/${id}`),
}

// Assets API
export const assetsAPI = {
  getAll: (params) => api.get('/assets', { params }),
  getById: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post('/assets', data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`),
}

// Authentication API
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (sessionId) => api.delete(`/auth/sessions/${sessionId}`),
  verifyToken: () => api.post('/auth/verify'),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
}

// Admin API - Users
export const usersAPI = {
  getAll: (params) => api.get('/admin/users', { params }),
  getById: (id) => api.get(`/admin/users/${id}`),
  create: (data) => api.post('/admin/users', data),
  update: (id, data) => api.put(`/admin/users/${id}`, data),
  delete: (id) => api.delete(`/admin/users/${id}`),
  resetPassword: (id, data) => api.post(`/admin/users/${id}/reset-password`, data),
}

// Admin API - Roles
export const rolesAPI = {
  getAll: (params) => api.get('/admin/roles', { params }),
  getById: (id) => api.get(`/admin/roles/${id}`),
  create: (data) => api.post('/admin/roles', data),
  update: (id, data) => api.put(`/admin/roles/${id}`, data),
  delete: (id) => api.delete(`/admin/roles/${id}`),
}

// Admin API - Permissions
export const permissionsAPI = {
  getAll: (params) => api.get('/admin/permissions', { params }),
  create: (data) => api.post('/admin/permissions', data),
  delete: (id) => api.delete(`/admin/permissions/${id}`),
  initializeDefaults: () => api.post('/admin/init-permissions'),
}

// Admin API - Audit Logs
export const auditLogsAPI = {
  getAll: (params) => api.get('/admin/audit-logs', { params }),
  getById: (id) => api.get(`/admin/audit-logs/${id}`),
}

// Admin API - System Settings
export const settingsAPI = {
  getAll: (params) => api.get('/admin/settings', { params }),
  getByKey: (key) => api.get(`/admin/settings/${key}`),
  create: (data) => api.post('/admin/settings', data),
  update: (key, data) => api.put(`/admin/settings/${key}`, data),
  delete: (key) => api.delete(`/admin/settings/${key}`),
}

// Admin API - Initialization
export const adminAPI = {
  initPermissions: () => api.post('/admin/init-permissions'),
  initAdminUser: () => api.post('/admin/init-admin'),
}

// Reporting API - Templates
export const reportTemplatesAPI = {
  getAll: (params) => api.get('/reporting/templates', { params }),
  getById: (id) => api.get(`/reporting/templates/${id}`),
  create: (data) => api.post('/reporting/templates', data),
  update: (id, data) => api.put(`/reporting/templates/${id}`, data),
  delete: (id) => api.delete(`/reporting/templates/${id}`),
  initDefaults: () => api.post('/reporting/init-templates'),
}

// Reporting API - Saved Reports
export const savedReportsAPI = {
  getAll: (params) => api.get('/reporting/saved', { params }),
  getById: (id) => api.get(`/reporting/saved/${id}`),
  create: (data) => api.post('/reporting/saved', data),
  update: (id, data) => api.put(`/reporting/saved/${id}`, data),
  delete: (id) => api.delete(`/reporting/saved/${id}`),
  toggleFavorite: (id) => api.post(`/reporting/saved/${id}/toggle-favorite`),
}

// Reporting API - Execution
export const reportingAPI = {
  runReport: (templateId, filters) => api.post(`/reporting/run/${templateId}`, filters),
  exportReport: (templateId, format = 'csv') => api.get(`/reporting/export/${templateId}`, { params: { format } }),
  getExecutions: (params) => api.get('/reporting/executions', { params }),
  getModules: () => api.get('/reporting/modules'),
}

// =====================================================
// ACCOUNTING API
// =====================================================
export const accountsAPI = {
  getAll: (params) => api.get('/accounting/accounts', { params }),
  getById: (id) => api.get(`/accounting/accounts/${id}`),
  create: (data) => api.post('/accounting/accounts', data),
  update: (id, data) => api.put(`/accounting/accounts/${id}`, data),
  delete: (id) => api.delete(`/accounting/accounts/${id}`),
  initDefaults: () => api.post('/accounting/init-accounts'),
}

export const journalEntriesAPI = {
  getAll: (params) => api.get('/accounting/journal-entries', { params }),
  getById: (id) => api.get(`/accounting/journal-entries/${id}`),
  create: (data) => api.post('/accounting/journal-entries', data),
  post: (id) => api.post(`/accounting/journal-entries/${id}/post`),
  reverse: (id) => api.post(`/accounting/journal-entries/${id}/reverse`),
  delete: (id) => api.delete(`/accounting/journal-entries/${id}`),
}

export const fiscalPeriodsAPI = {
  getAll: () => api.get('/accounting/fiscal-periods'),
  create: (data) => api.post('/accounting/fiscal-periods', data),
  close: (id) => api.post(`/accounting/fiscal-periods/${id}/close`),
}

export const accountingReportsAPI = {
  trialBalance: (asOfDate) => api.get('/accounting/trial-balance', { params: { as_of_date: asOfDate } }),
  balanceSheet: () => api.get('/accounting/balance-sheet'),
}

// =====================================================
// PRODUCTION PLANNING API
// =====================================================
export const productionResourcesAPI = {
  getAll: (params) => api.get('/production/resources', { params }),
  getById: (id) => api.get(`/production/resources/${id}`),
  create: (data) => api.post('/production/resources', data),
  update: (id, data) => api.put(`/production/resources/${id}`, data),
  delete: (id) => api.delete(`/production/resources/${id}`),
  getTypes: () => api.get('/production/resource-types'),
  getUtilization: (params) => api.get('/production/resource-utilization', { params }),
}

export const productionSchedulesAPI = {
  getAll: (params) => api.get('/production/schedules', { params }),
  getCalendar: (params) => api.get('/production/schedules/calendar', { params }),
  getById: (id) => api.get(`/production/schedules/${id}`),
  create: (data) => api.post('/production/schedules', data),
  update: (id, data) => api.put(`/production/schedules/${id}`, data),
  start: (id) => api.post(`/production/schedules/${id}/start`),
  complete: (id, quantity) => api.post(`/production/schedules/${id}/complete`, null, { params: { quantity_completed: quantity } }),
  delete: (id) => api.delete(`/production/schedules/${id}`),
}

// =====================================================
// DOCUMENTS API
// =====================================================
export const documentsAPI = {
  getAll: (params) => api.get('/documents', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  create: (data) => api.post('/documents', data),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  addVersion: (id, data) => api.post(`/documents/${id}/versions`, null, { params: data }),
  getVersions: (id) => api.get(`/documents/${id}/versions`),
  archive: (id) => api.post(`/documents/${id}/archive`),
  unarchive: (id) => api.post(`/documents/${id}/unarchive`),
  getLinked: (entityType, entityId) => api.get(`/documents/linked/${entityType}/${entityId}`),
  link: (id, entityType, entityId) => api.post(`/documents/${id}/link`, null, { params: { entity_type: entityType, entity_id: entityId } }),
  getCategories: () => api.get('/documents/categories/list'),
  getEntityTypes: () => api.get('/documents/entity-types/list'),
}

// =====================================================
// PAYROLL API
// =====================================================
export const payrollPeriodsAPI = {
  getAll: (params) => api.get('/payroll/periods', { params }),
  getById: (id) => api.get(`/payroll/periods/${id}`),
  create: (data) => api.post('/payroll/periods', data),
  update: (id, data) => api.put(`/payroll/periods/${id}`, data),
  process: (id) => api.post(`/payroll/periods/${id}/process`),
  close: (id) => api.post(`/payroll/periods/${id}/close`),
  delete: (id) => api.delete(`/payroll/periods/${id}`),
}

export const payslipsAPI = {
  getAll: (params) => api.get('/payroll/payslips', { params }),
  getById: (id) => api.get(`/payroll/payslips/${id}`),
  create: (data) => api.post('/payroll/payslips', data),
  update: (id, data) => api.put(`/payroll/payslips/${id}`, data),
  approve: (id) => api.post(`/payroll/payslips/${id}/approve`),
  pay: (id, method, ref) => api.post(`/payroll/payslips/${id}/pay`, null, { params: { payment_method: method, payment_reference: ref } }),
  delete: (id) => api.delete(`/payroll/payslips/${id}`),
}

export const payrollReportsAPI = {
  summary: (params) => api.get('/payroll/reports/summary', { params }),
}

// =====================================================
// POS API
// =====================================================
export const posTerminalsAPI = {
  getAll: () => api.get('/pos/terminals'),
  create: (data) => api.post('/pos/terminals', data),
}

export const posSessionsAPI = {
  getAll: (params) => api.get('/pos/sessions', { params }),
  getActive: (terminalId) => api.get('/pos/sessions/active', { params: { terminal_id: terminalId } }),
  getById: (id) => api.get(`/pos/sessions/${id}`),
  open: (data) => api.post('/pos/sessions', data),
  close: (id, data) => api.post(`/pos/sessions/${id}/close`, data),
}

export const posTransactionsAPI = {
  getAll: (params) => api.get('/pos/transactions', { params }),
  getById: (id) => api.get(`/pos/transactions/${id}`),
  create: (data) => api.post('/pos/transactions', data),
  void: (id) => api.post(`/pos/transactions/${id}/void`),
  quickSale: (params) => api.post('/pos/quick-sale', null, { params }),
}

export const posReportsAPI = {
  daily: (date) => api.get('/pos/reports/daily', { params: { date } }),
}

// =====================================================
// TOOLING & CONSUMABLES API
// =====================================================
export const toolsAPI = {
  getAll: (params) => api.get('/tooling/tools', { params }),
  getById: (id) => api.get(`/tooling/tools/${id}`),
  create: (data) => api.post('/tooling/tools', data),
  update: (id, data) => api.put(`/tooling/tools/${id}`, data),
  delete: (id) => api.delete(`/tooling/tools/${id}`),
  logUsage: (id, hours, units) => api.post(`/tooling/tools/${id}/log-usage`, null, { params: { hours, units } }),
  logMaintenance: (id, data) => api.post(`/tooling/tools/${id}/maintenance`, data),
  getMaintenanceDue: () => api.get('/tooling/tools/maintenance-due'),
  getCategories: () => api.get('/tooling/categories/tools'),
}

export const consumablesAPI = {
  getAll: (params) => api.get('/tooling/consumables', { params }),
  getById: (id) => api.get(`/tooling/consumables/${id}`),
  create: (data) => api.post('/tooling/consumables', data),
  update: (id, data) => api.put(`/tooling/consumables/${id}`, data),
  delete: (id) => api.delete(`/tooling/consumables/${id}`),
  use: (id, data) => api.post(`/tooling/consumables/${id}/use`, data),
  restock: (id, quantity, cost) => api.post(`/tooling/consumables/${id}/restock`, null, { params: { quantity, unit_cost: cost } }),
  getLowStock: () => api.get('/tooling/consumables/low-stock'),
  getCategories: () => api.get('/tooling/categories/consumables'),
}

// =====================================================
// PORTAL API
// =====================================================
export const portalUsersAPI = {
  getAll: (params) => api.get('/portal/users', { params }),
  getById: (id) => api.get(`/portal/users/${id}`),
  create: (data) => api.post('/portal/users', data),
  update: (id, data) => api.put(`/portal/users/${id}`, data),
  delete: (id) => api.delete(`/portal/users/${id}`),
  getStats: (id) => api.get(`/portal/stats/${id}`),
}

export const portalAuthAPI = {
  login: (data) => api.post('/portal/login', data),
  logout: () => api.post('/portal/logout'),
}

export const portalMessagesAPI = {
  getAll: (params) => api.get('/portal/messages', { params }),
  send: (data) => api.post('/portal/messages', data),
  markRead: (id) => api.post(`/portal/messages/${id}/read`),
}

export const portalNotificationsAPI = {
  getAll: (portalUserId, isRead) => api.get('/portal/notifications', { params: { portal_user_id: portalUserId, is_read: isRead } }),
  create: (data) => api.post('/portal/notifications', data),
  markRead: (id) => api.post(`/portal/notifications/${id}/read`),
}

export default api

