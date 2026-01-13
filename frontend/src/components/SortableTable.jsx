import { useState, useMemo, memo } from 'react'

/**
 * Sortable Table Component (Memoized for performance)
 * @param {Array} data - Array of objects to display
 * @param {Array} columns - Column definitions [{ key, label, sortable?, render? }]
 * @param {Function} onSort - Optional callback when sort changes
 */
const SortableTable = memo(function SortableTable({ data = [], columns = [], headers = [], defaultSortKey, defaultSortDirection = 'asc', onSort }) {
  // Support both 'columns' and 'headers' props for compatibility
  const effectiveHeaders = headers.length > 0 ? headers : columns
  
  const [sortConfig, setSortConfig] = useState(() => ({
    key: defaultSortKey || null,
    direction: defaultSortDirection || 'asc'
  }))

  const handleSort = (key) => {
    const column = effectiveHeaders.find(col => col.key === key)
    if (!column || column.sortable === false) return

    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }

    setSortConfig({ key, direction })
    if (onSort) {
      onSort({ key, direction })
    }
  }

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !data || !Array.isArray(data) || data.length === 0) {
      return data || []
    }

    try {
      return [...data].sort((a, b) => {
        if (!a || !b) return 0
        
        // Handle nested keys (e.g., 'product.name')
        let aVal = a
        let bVal = b
        const keys = sortConfig.key.split('.')
        
        for (const key of keys) {
          if (aVal && typeof aVal === 'object') {
            aVal = aVal[key]
          } else {
            aVal = undefined
          }
          if (bVal && typeof bVal === 'object') {
            bVal = bVal[key]
          } else {
            bVal = undefined
          }
        }

        // Handle null/undefined
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1

        // Handle numbers
        const aNum = parseFloat(aVal)
        const bNum = parseFloat(bVal)
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
        }

        // Handle dates
        const aDate = new Date(aVal)
        const bDate = new Date(bVal)
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate
        }

        // Handle strings
        const aStr = String(aVal).toLowerCase().trim()
        const bStr = String(bVal).toLowerCase().trim()
        
        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    } catch (error) {
      console.error('Error sorting data:', error)
      return data
    }
  }, [data, sortConfig])

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <span style={{ marginLeft: '0.5rem', opacity: 0.3 }}>⇅</span>
    }
    return sortConfig.direction === 'asc' 
      ? <span style={{ marginLeft: '0.5rem' }}>↑</span>
      : <span style={{ marginLeft: '0.5rem' }}>↓</span>
  }

  return (
    <table className="table">
      <thead>
        <tr>
          {effectiveHeaders.map(column => (
            <th
              key={column.key}
              onClick={() => handleSort(column.key)}
              style={{
                cursor: column.sortable !== false ? 'pointer' : 'default',
                userSelect: 'none',
                position: 'relative'
              }}
              title={column.sortable !== false ? 'Click to sort' : ''}
            >
              {column.label}
              {column.sortable !== false && getSortIcon(column.key)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData && sortedData.length > 0 ? (
          sortedData.map((row, index) => {
            if (!row) return null
            const rowKey = row.id || row.key || `row-${index}`
            return (
              <tr key={rowKey}>
                {effectiveHeaders.map(column => {
                  const cellKey = `${rowKey}-${column.key}`
                  let cellValue
                  
                  try {
                    // Handle nested keys
                    if (column.key.includes('.')) {
                      const keys = column.key.split('.')
                      cellValue = row
                      for (const key of keys) {
                        cellValue = cellValue?.[key]
                      }
                    } else {
                      cellValue = row[column.key]
                    }
                    
                    // Use custom render function if provided
                    if (column.render) {
                      return (
                        <td key={cellKey}>
                          {column.render(cellValue, row, index)}
                        </td>
                      )
                    }
                    
                    // Default rendering
                    return (
                      <td key={cellKey}>
                        {cellValue != null ? String(cellValue) : '-'}
                      </td>
                    )
                  } catch (error) {
                    console.error(`Error rendering cell ${column.key}:`, error)
                    return <td key={cellKey}>-</td>
                  }
                })}
              </tr>
            )
          })
        ) : (
          <tr>
            <td colSpan={effectiveHeaders.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--brown-200)' }}>
              No data available
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if data or headers/columns change
  const prevHeaders = prevProps.headers || prevProps.columns
  const nextHeaders = nextProps.headers || nextProps.columns
  return (
    prevProps.data === nextProps.data &&
    prevHeaders === nextHeaders &&
    prevProps.defaultSortKey === nextProps.defaultSortKey &&
    prevProps.defaultSortDirection === nextProps.defaultSortDirection &&
    prevProps.onSort === nextProps.onSort
  )
})

SortableTable.displayName = 'SortableTable'

export default SortableTable

