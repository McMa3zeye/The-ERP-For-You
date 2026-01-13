import { memo, useMemo } from 'react'

const Pagination = memo(function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) {
  // Validate props
  const safeCurrentPage = Math.max(1, Math.min(currentPage || 1, totalPages || 1))
  const safeTotalPages = Math.max(1, totalPages || 1)
  const safeTotalItems = Math.max(0, totalItems || 0)
  const safeItemsPerPage = Math.max(1, itemsPerPage || 20)
  
  // Memoize page calculations for better performance
  const { pages, startItem, endItem } = useMemo(() => {
    const pagesList = []
    const maxVisible = 7
    
    // Calculate page range
    let startPage = Math.max(1, safeCurrentPage - Math.floor(maxVisible / 2))
    let endPage = Math.min(safeTotalPages, startPage + maxVisible - 1)
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pagesList.push(i)
    }
    
    const start = safeTotalItems === 0 ? 0 : (safeCurrentPage - 1) * safeItemsPerPage + 1
    const end = Math.min(safeCurrentPage * safeItemsPerPage, safeTotalItems)
    
    return { pages: pagesList, startItem: start, endItem: end }
  }, [safeCurrentPage, safeTotalPages, safeTotalItems, safeItemsPerPage])
  
  // Validate onPageChange
  const handlePageChange = (page) => {
    if (onPageChange && typeof onPageChange === 'function') {
      const safePage = Math.max(1, Math.min(page, safeTotalPages))
      onPageChange(safePage)
    }
  }
  
  if (safeTotalPages <= 1) return null
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginTop: '1.5rem',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      <div style={{ color: 'var(--brown-200)', fontSize: '0.9rem' }}>
        Showing {startItem} to {endItem} of {safeTotalItems} items
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handlePageChange(1)}
          disabled={safeCurrentPage === 1}
          aria-label="First page"
          style={{ opacity: safeCurrentPage === 1 ? 0.5 : 1, cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
        >
          ⏮️ First
        </button>
        
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handlePageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          aria-label="Previous page"
          style={{ opacity: safeCurrentPage === 1 ? 0.5 : 1, cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
        >
          ⬅️ Prev
        </button>
        
        {pages[0] > 1 && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => handlePageChange(1)} aria-label="Page 1">1</button>
            {pages[0] > 2 && <span style={{ color: 'var(--brown-300)', padding: '0 0.5rem' }}>...</span>}
          </>
        )}
        
        {pages.map(page => (
          <button
            type="button"
            key={page}
            className={safeCurrentPage === page ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => handlePageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={safeCurrentPage === page ? 'page' : undefined}
            style={{
              minWidth: '40px'
            }}
          >
            {page}
          </button>
        ))}
        
        {pages[pages.length - 1] < safeTotalPages && (
          <>
            {pages[pages.length - 1] < safeTotalPages - 1 && <span style={{ color: 'var(--brown-300)', padding: '0 0.5rem' }}>...</span>}
            <button type="button" className="btn btn-secondary" onClick={() => handlePageChange(safeTotalPages)} aria-label={`Page ${safeTotalPages}`}>{safeTotalPages}</button>
          </>
        )}
        
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handlePageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === safeTotalPages}
          aria-label="Next page"
          style={{ opacity: safeCurrentPage === safeTotalPages ? 0.5 : 1, cursor: safeCurrentPage === safeTotalPages ? 'not-allowed' : 'pointer' }}
        >
          Next ➡️
        </button>
        
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handlePageChange(safeTotalPages)}
          disabled={safeCurrentPage === safeTotalPages}
          aria-label="Last page"
          style={{ opacity: safeCurrentPage === safeTotalPages ? 0.5 : 1, cursor: safeCurrentPage === safeTotalPages ? 'not-allowed' : 'pointer' }}
        >
          Last ⏭️
        </button>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if pagination props change
  return (
    prevProps.currentPage === nextProps.currentPage &&
    prevProps.totalPages === nextProps.totalPages &&
    prevProps.totalItems === nextProps.totalItems &&
    prevProps.itemsPerPage === nextProps.itemsPerPage &&
    prevProps.onPageChange === nextProps.onPageChange
  )
})

Pagination.displayName = 'Pagination'

export default Pagination
