import { useState, useEffect } from 'react'

const ALL_PAGES = [
  { id: 'dashboard', name: '📊 Dashboard' },
  { id: 'products', name: '📦 Products Page' },
  { id: 'inventory', name: '📊 Inventory Page' },
  { id: 'sales-orders', name: '📋 Sales Orders Page' },
]

function ChartImporter({ currentPage, onImport }) {
  const [isOpen, setIsOpen] = useState(false)
  const [availableCharts, setAvailableCharts] = useState([])
  const [selectedCharts, setSelectedCharts] = useState([])

  useEffect(() => {
    if (isOpen) {
      loadAvailableCharts()
    }
  }, [isOpen, currentPage])

  const loadAvailableCharts = () => {
    const saved = localStorage.getItem('savedCharts')
    if (saved) {
      try {
        const allCharts = JSON.parse(saved)
        // Get charts from other pages that aren't already shared with this page
        const chartsFromOtherPages = allCharts.filter(chart => {
          const isOnCurrentPage = chart.postToPage === currentPage
          const isAlreadyShared = chart.sharedPages && chart.sharedPages.includes(currentPage)
          return !isOnCurrentPage && !isAlreadyShared
        })
        setAvailableCharts(chartsFromOtherPages)
      } catch (e) {
        console.error('Error loading charts:', e)
        setAvailableCharts([])
      }
    } else {
      setAvailableCharts([])
    }
  }

  const handleImport = () => {
    if (selectedCharts.length === 0) {
      alert('Please select at least one chart to import')
      return
    }

    const saved = JSON.parse(localStorage.getItem('savedCharts') || '[]')
    
    // Update selected charts to be shared with current page
    selectedCharts.forEach(chartId => {
      const chartIndex = saved.findIndex(c => c.id === chartId)
      if (chartIndex !== -1) {
        const originalPage = saved[chartIndex].postToPage
        // Initialize sharedPages array if it doesn't exist
        if (!saved[chartIndex].sharedPages) {
          saved[chartIndex].sharedPages = [originalPage]
        }
        // Add current page to shared pages if not already there
        if (!saved[chartIndex].sharedPages.includes(currentPage)) {
          saved[chartIndex].sharedPages.push(currentPage)
        }
      }
    })

    localStorage.setItem('savedCharts', JSON.stringify(saved))
    window.dispatchEvent(new Event('chartsUpdated'))
    
    if (onImport) {
      onImport()
    }

    setIsOpen(false)
    setSelectedCharts([])
    alert(`✅ Imported ${selectedCharts.length} chart(s)! They will update simultaneously across all pages.`)
  }

  const toggleChartSelection = (chartId) => {
    setSelectedCharts(prev => 
      prev.includes(chartId)
        ? prev.filter(id => id !== chartId)
        : [...prev, chartId]
    )
  }

  const getPageName = (pageId) => {
    return ALL_PAGES.find(p => p.id === pageId)?.name || pageId
  }

  if (!isOpen) {
    return (
      <button 
        type="button"
        className="btn btn-info" 
        onClick={() => setIsOpen(true)}
        title="Import Charts from Other Pages"
      >
        📥 Import Charts
      </button>
    )
  }

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>📥 Import Charts</h2>
          <button className="btn btn-secondary" onClick={() => setIsOpen(false)}>✕</button>
        </div>

        {availableCharts.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--brown-200)', padding: '2rem' }}>
            No charts available from other pages.
          </p>
        ) : (
          <>
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem' }}>
              {availableCharts.map(chart => (
                <div
                  key={chart.id}
                  className="card"
                  style={{
                    marginBottom: '1rem',
                    backgroundColor: selectedCharts.includes(chart.id) 
                      ? 'rgba(168, 192, 144, 0.2)' 
                      : 'rgba(45, 27, 14, 0.3)',
                    cursor: 'pointer',
                    border: selectedCharts.includes(chart.id) 
                      ? '2px solid var(--green-300)' 
                      : '1px solid var(--brown-500)'
                  }}
                  onClick={() => toggleChartSelection(chart.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedCharts.includes(chart.id)}
                      onChange={() => toggleChartSelection(chart.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 0.5rem 0' }}>{chart.title}</h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--brown-200)' }}>
                        From: {getPageName(chart.postToPage)} | Type: {chart.type || chart.chartType}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setIsOpen(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleImport}
                disabled={selectedCharts.length === 0}
              >
                Import {selectedCharts.length > 0 ? `(${selectedCharts.length})` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ChartImporter

