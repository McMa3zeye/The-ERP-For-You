import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'

const ALL_PAGES = [
  { path: '/', name: 'Dashboard', icon: '📊' },
  { path: '/products', name: 'Products', icon: '📦' },
  { path: '/inventory', name: 'Inventory', icon: '📊' },
  { path: '/leads', name: 'Leads & Pipeline', icon: '🎯' },
  { path: '/quotes', name: 'Quotes', icon: '💰' },
  { path: '/sales-orders', name: 'Sales Orders', icon: '📋' },
  { path: '/invoicing', name: 'Invoicing', icon: '🧾' },
  { path: '/payments', name: 'Payments', icon: '💵' },
  { path: '/suppliers', name: 'Suppliers', icon: '🏭' },
  { path: '/purchasing', name: 'Purchasing', icon: '🛒' },
  { path: '/warehousing', name: 'Warehousing', icon: '🏬' },
  { path: '/manufacturing', name: 'Manufacturing (BOM)', icon: '⚙️' },
  { path: '/work-orders', name: 'Work Orders', icon: '🔧' },
  { path: '/production-planning', name: 'Production Planning', icon: '🗓️' },
  { path: '/quality', name: 'Quality Control', icon: '✅' },
  { path: '/shipping', name: 'Shipping & Delivery', icon: '🚚' },
  { path: '/returns', name: 'Returns & RMA', icon: '↩️' },
  { path: '/expenses', name: 'Expenses', icon: '💳' },
  { path: '/accounting', name: 'Accounting & GL', icon: '📔' },
  { path: '/projects', name: 'Projects', icon: '📋' },
  { path: '/support-tickets', name: 'Support Tickets', icon: '🎫' },
  { path: '/time-attendance', name: 'Time & Attendance', icon: '⏰' },
  { path: '/payroll', name: 'Payroll', icon: '💰' },
  { path: '/hr', name: 'Human Resources', icon: '👔' },
  { path: '/assets', name: 'Assets & Maintenance', icon: '🏗️' },
  { path: '/tooling', name: 'Tooling & Consumables', icon: '🔧' },
  { path: '/documents', name: 'Document Management', icon: '📂' },
  { path: '/pos', name: 'Point of Sale', icon: '🛒' },
  { path: '/portal', name: 'Customer/Supplier Portal', icon: '🌐' },
  { path: '/customers', name: 'Customers', icon: '👥' },
  { path: '/reporting', name: 'Reporting', icon: '📈' },
  { path: '/admin', name: 'Admin & Security', icon: '🛡️' },
  { path: '/settings', name: 'System Settings', icon: '⚙️' },
]

function HamburgerMenu({ onFavoritesChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [favorites, setFavorites] = useState([])
  const location = useLocation()

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem('favoritePages')
      if (savedFavorites) {
        const parsed = JSON.parse(savedFavorites)
        if (Array.isArray(parsed)) {
          setFavorites(parsed)
        } else {
          // Invalid format, reset to defaults
          const defaultFavorites = ALL_PAGES.map(p => p.path)
          setFavorites(defaultFavorites)
          localStorage.setItem('favoritePages', JSON.stringify(defaultFavorites))
        }
      } else {
        // Default: all pages are favorites initially
        const defaultFavorites = ALL_PAGES.map(p => p.path)
        setFavorites(defaultFavorites)
        localStorage.setItem('favoritePages', JSON.stringify(defaultFavorites))
      }
    } catch (error) {
      console.error('Error loading favorites:', error)
      // Reset to defaults on error
      const defaultFavorites = ALL_PAGES.map(p => p.path)
      setFavorites(defaultFavorites)
      localStorage.setItem('favoritePages', JSON.stringify(defaultFavorites))
    }
  }, [])

  // Save favorites to localStorage
  const saveFavorites = (newFavorites) => {
    try {
      if (!Array.isArray(newFavorites)) {
        console.error('Favorites must be an array')
        return
      }
      setFavorites(newFavorites)
      localStorage.setItem('favoritePages', JSON.stringify(newFavorites))
      if (onFavoritesChange && typeof onFavoritesChange === 'function') {
        onFavoritesChange()
      }
      // Dispatch event for same-window updates
      window.dispatchEvent(new Event('favoritesUpdated'))
    } catch (error) {
      console.error('Error saving favorites:', error)
    }
  }

  const toggleFavorite = (e, path) => {
    e.preventDefault()
    e.stopPropagation()
    const isFavorited = favorites.includes(path)
    if (isFavorited) {
      saveFavorites(favorites.filter(p => p !== path))
    } else {
      saveFavorites([...favorites, path])
    }
  }

  const isFavorited = (path) => favorites.includes(path)

  const currentPath = location.pathname

  const sortedPages = useMemo(() => {
    const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    const fav = ALL_PAGES.filter((p) => isFavorited(p.path)).sort(byName)
    const rest = ALL_PAGES.filter((p) => !isFavorited(p.path)).sort(byName)
    return [...fav, ...rest]
  }, [favorites])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  return (
    <div style={{ position: 'relative', zIndex: 10000 }}>
      {/* Hamburger Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="hamburger-button"
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isOpen}
      >
        <span className={`hamburger-line ${isOpen ? 'hamburger-line-1-open' : ''}`}></span>
        <span className={`hamburger-line ${isOpen ? 'hamburger-line-2-open' : ''}`}></span>
        <span className={`hamburger-line ${isOpen ? 'hamburger-line-3-open' : ''}`}></span>
      </button>

      {/* Drawer (rendered in a portal so it is always on top and not affected by global nav styles) */}
      {isOpen && createPortal(
        <>
          <div
            className="hamburger-backdrop"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsOpen(false)
            }}
          />

          <aside
            className="hamburger-menu-panel hamburger-menu-panel-open"
            role="dialog"
            aria-label="Navigation menu"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hamburger-menu-header">
              <h3 className="hamburger-menu-title">Navigation</h3>
              <button
                type="button"
                className="hamburger-close-button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsOpen(false)
                }}
                aria-label="Close menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="hamburger-menu-nav" role="navigation" aria-label="Main navigation">
              <ul className="hamburger-menu-list">
                {sortedPages.map((page) => {
                  const favorited = isFavorited(page.path)
                  const isActive = currentPath === page.path

                  return (
                    <li key={page.path} className="hamburger-menu-item">
                      <Link
                        to={page.path}
                        onClick={() => setIsOpen(false)}
                        className={`hamburger-menu-link ${isActive ? 'hamburger-menu-link-active' : ''}`}
                      >
                        <span className="hamburger-menu-link-content">
                          <span className="hamburger-menu-icon">{page.icon}</span>
                          <span className="hamburger-menu-text">{page.name}</span>
                        </span>
                        <button
                          type="button"
                          className="hamburger-favorite-button"
                          onClick={(e) => toggleFavorite(e, page.path)}
                          aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
                          title={favorited ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill={favorited ? '#f0b86e' : 'none'}
                            stroke={favorited ? '#f0b86e' : 'var(--brown-300)'}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="favorite-star-icon"
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                          </svg>
                        </button>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </aside>
        </>,
        document.body
      )}
    </div>
  )
}

export default HamburgerMenu
