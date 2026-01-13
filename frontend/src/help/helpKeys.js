export const HELP_KEY_BY_PATH = {
  '/': 'dashboard',
  '/products': 'products',
  '/inventory': 'inventory',
  '/leads': 'leads',
  '/quotes': 'quotes',
  '/sales-orders': 'salesOrders',
  '/invoicing': 'invoicing',
  '/payments': 'payments',
  '/suppliers': 'suppliers',
  '/purchasing': 'purchasing',
  '/warehousing': 'warehousing',
  '/manufacturing': 'manufacturing',
  '/work-orders': 'workOrders',
  '/quality': 'quality',
  '/shipping': 'shipping',
  '/returns': 'returns',
  '/expenses': 'expenses',
  '/projects': 'projects',
  '/support-tickets': 'supportTickets',
  '/time-attendance': 'timeAttendance',
  '/hr': 'hr',
  '/assets': 'assets',
  '/customers': 'customers',
  '/accounting': 'accounting',
  '/production-planning': 'productionPlanning',
  '/documents': 'documents',
  '/payroll': 'payroll',
  '/pos': 'pos',
  '/tooling': 'tooling',
  '/portal': 'portal',
  '/admin': 'admin',
  '/reporting': 'reporting',
  '/settings': 'settings',
  '/login': 'admin', // closest concept: auth/admin
}

export function getHelpKeyForPath(pathname) {
  return HELP_KEY_BY_PATH[pathname] || 'dashboard'
}

