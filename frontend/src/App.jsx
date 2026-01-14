import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import HamburgerMenu from './components/HamburgerMenu'
import { useTheme } from './contexts/ThemeContext'
import { useAuth, RequireAuth } from './contexts/AuthContext'

// Lazy load pages for code splitting (loads only when needed)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Products = lazy(() => import('./pages/Products'))
const Inventory = lazy(() => import('./pages/Inventory'))
const SalesOrders = lazy(() => import('./pages/SalesOrders'))
const Customers = lazy(() => import('./pages/Customers'))
const Quotes = lazy(() => import('./pages/Quotes'))
const Invoicing = lazy(() => import('./pages/Invoicing'))
const Payments = lazy(() => import('./pages/Payments'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const Purchasing = lazy(() => import('./pages/Purchasing'))
const WorkOrders = lazy(() => import('./pages/WorkOrders'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Projects = lazy(() => import('./pages/Projects'))
const SupportTickets = lazy(() => import('./pages/SupportTickets'))
const Leads = lazy(() => import('./pages/Leads'))
const Warehousing = lazy(() => import('./pages/Warehousing'))
const Manufacturing = lazy(() => import('./pages/Manufacturing'))
const Quality = lazy(() => import('./pages/Quality'))
const Shipping = lazy(() => import('./pages/Shipping'))
const Returns = lazy(() => import('./pages/Returns'))
const TimeAttendance = lazy(() => import('./pages/TimeAttendance'))
const HR = lazy(() => import('./pages/HR'))
const Assets = lazy(() => import('./pages/Assets'))
const Admin = lazy(() => import('./pages/Admin'))
const Reporting = lazy(() => import('./pages/Reporting'))
const Accounting = lazy(() => import('./pages/Accounting'))
const ProductionPlanning = lazy(() => import('./pages/ProductionPlanning'))
const Documents = lazy(() => import('./pages/Documents'))
const Payroll = lazy(() => import('./pages/Payroll'))
const POS = lazy(() => import('./pages/POS'))
const Tooling = lazy(() => import('./pages/Tooling'))
const Portal = lazy(() => import('./pages/Portal'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

// Loading fallback component
const PageLoader = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: '400px',
    color: 'var(--brown-200)'
  }}>
    <div className="spinner"></div>
    <span style={{ marginLeft: '1rem' }}>Loading...</span>
  </div>
)

const ALL_PAGES = [
  { path: '/', name: '📊 Dashboard', icon: '📊' },
  { path: '/products', name: '📦 Products', icon: '📦' },
  { path: '/inventory', name: '📊 Inventory', icon: '📊' },
  { path: '/leads', name: '🎯 Leads', icon: '🎯' },
  { path: '/quotes', name: '💰 Quotes', icon: '💰' },
  { path: '/sales-orders', name: '📋 Sales Orders', icon: '📋' },
  { path: '/invoicing', name: '🧾 Invoicing', icon: '🧾' },
  { path: '/payments', name: '💵 Payments', icon: '💵' },
  { path: '/suppliers', name: '🏭 Suppliers', icon: '🏭' },
  { path: '/purchasing', name: '🛒 Purchasing', icon: '🛒' },
  { path: '/warehousing', name: '🏬 Warehousing', icon: '🏬' },
  { path: '/manufacturing', name: '⚙️ Manufacturing', icon: '⚙️' },
  { path: '/work-orders', name: '🔧 Work Orders', icon: '🔧' },
  { path: '/quality', name: '✅ Quality', icon: '✅' },
  { path: '/shipping', name: '🚚 Shipping', icon: '🚚' },
  { path: '/returns', name: '↩️ Returns', icon: '↩️' },
  { path: '/expenses', name: '💳 Expenses', icon: '💳' },
  { path: '/projects', name: '📋 Projects', icon: '📋' },
  { path: '/support-tickets', name: '🎫 Support', icon: '🎫' },
  { path: '/time-attendance', name: '⏰ Time', icon: '⏰' },
  { path: '/hr', name: '👔 HR', icon: '👔' },
  { path: '/assets', name: '🏗️ Assets', icon: '🏗️' },
  { path: '/customers', name: '👥 Customers', icon: '👥' },
  { path: '/accounting', name: '📔 Accounting', icon: '📔' },
  { path: '/production-planning', name: '🗓️ Production', icon: '🗓️' },
  { path: '/documents', name: '📂 Documents', icon: '📂' },
  { path: '/payroll', name: '💰 Payroll', icon: '💰' },
  { path: '/pos', name: '🛒 POS', icon: '🛒' },
  { path: '/tooling', name: '🔧 Tooling', icon: '🔧' },
  { path: '/portal', name: '🌐 Portal', icon: '🌐' },
  { path: '/admin', name: '🔐 Admin', icon: '🔐' },
  { path: '/reporting', name: '📈 Reports', icon: '📈' },
  { path: '/settings', name: '⚙️ Settings', icon: '⚙️' },
]

function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [favorites, setFavorites] = useState([])
  const { theme, themes, setTheme } = useTheme()
  const { user, isAuthenticated, logout } = useAuth()
  
  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favoritePages')
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites))
    } else {
      // Default: all pages are favorites initially
      const defaultFavorites = ALL_PAGES.map(p => p.path)
      setFavorites(defaultFavorites)
      localStorage.setItem('favoritePages', JSON.stringify(defaultFavorites))
    }
  }, [])
  
  // Listen for favorite changes (from hamburger menu)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedFavorites = localStorage.getItem('favoritePages')
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites))
      }
    }
    window.addEventListener('storage', handleStorageChange)
    // Also listen for custom event for same-window updates
    window.addEventListener('favoritesUpdated', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('favoritesUpdated', handleStorageChange)
    }
  }, [])
  
  // Favorite pages shown in main navigation
  const favoritePages = ALL_PAGES.filter(page => favorites.includes(page.path))
  
  return (
    <nav>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>The ERP For You</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ul>
            {favoritePages.map(page => (
              <li key={page.path}>
                <Link 
                  to={page.path} 
                  className={location.pathname === page.path ? 'active' : ''}
                >
                  {page.name}
                </Link>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-2)', fontWeight: 600 }}>
              <span style={{ fontSize: '0.9rem' }}>Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-1)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.55rem',
                  cursor: 'pointer',
                }}
              >
                {themes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {isAuthenticated ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  await logout()
                  navigate('/login', { replace: true })
                }}
                title="Logout"
                style={{ margin: 0 }}
              >
                Logout{user?.username ? ` (${user.username})` : ''}
              </button>
            ) : (
              <Link className="btn btn-secondary" to="/login" style={{ margin: 0 }}>
                Login
              </Link>
            )}
          </div>
          <HamburgerMenu onFavoritesChange={() => {
            const savedFavorites = localStorage.getItem('favoritePages')
            if (savedFavorites) {
              setFavorites(JSON.parse(savedFavorites))
            }
            window.dispatchEvent(new Event('favoritesUpdated'))
          }} />
        </div>
      </div>
    </nav>
  )
}

function App() {
  return (
    <Router>
      <Navigation />
      <div className="container">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/" element={<RequireAuth permission="reporting.view"><Dashboard /></RequireAuth>} />
            <Route path="/products" element={<RequireAuth permission="products.view"><Products /></RequireAuth>} />
            <Route path="/inventory" element={<RequireAuth permission="inventory.view"><Inventory /></RequireAuth>} />
            <Route path="/quotes" element={<RequireAuth permission="quotes.view"><Quotes /></RequireAuth>} />
            <Route path="/sales-orders" element={<RequireAuth permission="sales_orders.view"><SalesOrders /></RequireAuth>} />
            <Route path="/invoicing" element={<RequireAuth permission="invoicing.view"><Invoicing /></RequireAuth>} />
            <Route path="/payments" element={<RequireAuth permission="payments.view"><Payments /></RequireAuth>} />
            <Route path="/suppliers" element={<RequireAuth permission="suppliers.view"><Suppliers /></RequireAuth>} />
            <Route path="/purchasing" element={<RequireAuth permission="purchasing.view"><Purchasing /></RequireAuth>} />
            <Route path="/work-orders" element={<RequireAuth permission="work_orders.view"><WorkOrders /></RequireAuth>} />
            <Route path="/expenses" element={<RequireAuth permission="expenses.view"><Expenses /></RequireAuth>} />
            <Route path="/projects" element={<RequireAuth permission="projects.view"><Projects /></RequireAuth>} />
            <Route path="/support-tickets" element={<RequireAuth permission="support_tickets.view"><SupportTickets /></RequireAuth>} />
            <Route path="/leads" element={<RequireAuth permission="leads.view"><Leads /></RequireAuth>} />
            <Route path="/warehousing" element={<RequireAuth permission="warehousing.view"><Warehousing /></RequireAuth>} />
            <Route path="/manufacturing" element={<RequireAuth permission="manufacturing.view"><Manufacturing /></RequireAuth>} />
            <Route path="/quality" element={<RequireAuth permission="quality.view"><Quality /></RequireAuth>} />
            <Route path="/shipping" element={<RequireAuth permission="shipping.view"><Shipping /></RequireAuth>} />
            <Route path="/returns" element={<RequireAuth permission="returns.view"><Returns /></RequireAuth>} />
            <Route path="/time-attendance" element={<RequireAuth permission="time_attendance.view"><TimeAttendance /></RequireAuth>} />
            <Route path="/hr" element={<RequireAuth permission="hr.view"><HR /></RequireAuth>} />
            <Route path="/assets" element={<RequireAuth permission="assets.view"><Assets /></RequireAuth>} />
            <Route path="/customers" element={<RequireAuth permission="customers.view"><Customers /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth permission="admin.manage_users"><Admin /></RequireAuth>} />
            <Route path="/reporting" element={<RequireAuth permission="reporting.view"><Reporting /></RequireAuth>} />
            <Route path="/accounting" element={<RequireAuth permission="accounting.view"><Accounting /></RequireAuth>} />
            <Route path="/production-planning" element={<RequireAuth permission="production.view"><ProductionPlanning /></RequireAuth>} />
            <Route path="/documents" element={<RequireAuth permission="documents.view"><Documents /></RequireAuth>} />
            <Route path="/payroll" element={<RequireAuth permission="payroll.view"><Payroll /></RequireAuth>} />
            <Route path="/pos" element={<RequireAuth permission="pos.view"><POS /></RequireAuth>} />
            <Route path="/tooling" element={<RequireAuth permission="tooling.view"><Tooling /></RequireAuth>} />
            <Route path="/portal" element={<RequireAuth permission="portal.view"><Portal /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth permission="settings.manage"><Settings /></RequireAuth>} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  )
}

export default App

