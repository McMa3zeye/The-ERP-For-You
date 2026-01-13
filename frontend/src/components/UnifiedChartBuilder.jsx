import { useState, useEffect } from 'react'
import { salesOrdersAPI, productsAPI, inventoryAPI } from '../services/api'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts'
import { exportChartData } from '../utils/export'

const CHART_COLORS = ['#a8c090', '#8ba672', '#d4a574', '#b8966d', '#7a9565', '#f0b86e', '#9bb570', '#7b9a6a']

const DATA_SOURCES = [
  { id: 'sales', name: '📋 Sales Orders', api: salesOrdersAPI, getAll: () => salesOrdersAPI.getAll({ limit: 1000 }) },
  { id: 'products', name: '📦 Products', api: productsAPI, getAll: () => productsAPI.getAll({ limit: 1000 }) },
  { id: 'inventory', name: '📊 Inventory', api: inventoryAPI, getAll: () => inventoryAPI.getItems({ limit: 1000 }) },
]

const DASHBOARD_SECTIONS = [
  { id: 'overview', name: '📊 Overview Tab' },
  { id: 'sales', name: '💰 Sales Analytics Tab' },
  { id: 'products', name: '📦 Products Tab' },
  { id: 'inventory', name: '📊 Inventory Tab' },
  { id: 'customers', name: '👥 Customers Tab' },
  { id: 'activity', name: '📋 Activity Feed Tab' },
]

const ALL_PAGES = [
  { id: 'dashboard', name: '📊 Dashboard' },
  { id: 'products', name: '📦 Products Page' },
  { id: 'inventory', name: '📊 Inventory Page' },
  { id: 'sales-orders', name: '📋 Sales Orders Page' },
]

function UnifiedChartBuilder({ onClose, onSaveChart, initialConfig }) {
  const [selectedSources, setSelectedSources] = useState(initialConfig?.sources || [])
  const [data, setData] = useState(initialConfig?.data || [])
  const [loading, setLoading] = useState(false)
  const [chartType, setChartType] = useState(initialConfig?.type || 'bar')
  const [xAxisField, setXAxisField] = useState(initialConfig?.xAxis || '')
  const [yAxisFields, setYAxisFields] = useState(initialConfig?.yAxis || [])
  const [filters, setFilters] = useState(initialConfig?.filters || [])
  const [chartTitle, setChartTitle] = useState(initialConfig?.title || 'Custom Chart')
  const [showFilters, setShowFilters] = useState(false)
  const [postToPage, setPostToPage] = useState(initialConfig?.postToPage || 'dashboard')
  const [postToSection, setPostToSection] = useState(initialConfig?.postToSection || 'overview')

  // Load data from selected sources
  useEffect(() => {
    const loadData = async () => {
      if (!selectedSources || selectedSources.length === 0) {
        setData([])
        return
      }

      setLoading(true)
      try {
        const allData = []
        const loadPromises = []
        
        for (const sourceId of selectedSources) {
          const source = DATA_SOURCES.find(s => s.id === sourceId)
          if (source && source.getAll && typeof source.getAll === 'function') {
            loadPromises.push(
              source.getAll().then(response => {
                const items = Array.isArray(response.data) ? response.data : (response.data?.items || [])
                // Add source identifier
                items.forEach(item => {
                  if (item && typeof item === 'object') {
                    item._source = sourceId
                  }
                })
                return items
              }).catch(error => {
                console.error(`Error loading data from ${sourceId}:`, error)
                return [] // Return empty array on error
              })
            )
          }
        }
        
        const results = await Promise.all(loadPromises)
        const flattened = results.flat().filter(item => item != null)
        setData(flattened)
      } catch (error) {
        console.error('Error loading data:', error)
        alert('Failed to load data: ' + (error.message || 'Unknown error'))
        setData([])
      } finally {
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSources])

  const toggleSource = (sourceId) => {
    if (selectedSources.includes(sourceId)) {
      setSelectedSources(selectedSources.filter(id => id !== sourceId))
    } else {
      setSelectedSources([...selectedSources, sourceId])
    }
  }

  const availableFields = data && data.length > 0 ? Object.keys(data[0]).filter(f => !f.startsWith('_')) : []

  // Process data with filters
  let processedData = [...(data || [])]

  filters.forEach(filter => {
    if (filter.field && filter.value) {
      processedData = processedData.filter(item => {
        const itemValue = item[filter.field]
        if (filter.operator === 'equals') {
          return String(itemValue) === String(filter.value)
        } else if (filter.operator === 'contains') {
          return String(itemValue).toLowerCase().includes(String(filter.value).toLowerCase())
        } else if (filter.operator === 'greater') {
          return parseFloat(itemValue) > parseFloat(filter.value)
        } else if (filter.operator === 'less') {
          return parseFloat(itemValue) < parseFloat(filter.value)
        }
        return true
      })
    }
  })

  // Calculate custom values (like "products sold the most")
  const calculateCustomValues = () => {
    if (xAxisField && yAxisFields.length > 0) {
      const grouped = {}
      processedData.forEach(item => {
        const key = item[xAxisField] || 'Unknown'
        if (!grouped[key]) {
          grouped[key] = { [xAxisField]: key }
          yAxisFields.forEach(field => {
            grouped[key][field] = 0
          })
        }
        yAxisFields.forEach(field => {
          if (field.type === 'count') {
            grouped[key][field.name] = (grouped[key][field.name] || 0) + 1
          } else if (field.type === 'sum') {
            grouped[key][field.name] = (grouped[key][field.name] || 0) + (parseFloat(item[field.field]) || 0)
          } else if (field.type === 'avg') {
            // Store sum and count for average calculation
            if (!grouped[key][`${field.name}_sum`]) {
              grouped[key][`${field.name}_sum`] = 0
              grouped[key][`${field.name}_count`] = 0
            }
            grouped[key][`${field.name}_sum`] += parseFloat(item[field.field]) || 0
            grouped[key][`${field.name}_count`] += 1
          } else {
            grouped[key][field.name] = (grouped[key][field.name] || 0) + (parseFloat(item[field.field]) || 0)
          }
        })
      })

      // Calculate averages
      Object.keys(grouped).forEach(key => {
        yAxisFields.forEach(field => {
          if (field.type === 'avg') {
            const sum = grouped[key][`${field.name}_sum`] || 0
            const count = grouped[key][`${field.name}_count`] || 0
            grouped[key][field.name] = count > 0 ? sum / count : 0
            delete grouped[key][`${field.name}_sum`]
            delete grouped[key][`${field.name}_count`]
          }
        })
      })

      processedData = Object.values(grouped)
    }
  }

  if (yAxisFields.length > 0 && yAxisFields.some(f => f.type)) {
    calculateCustomValues()
  }

  const handleAddYAxis = () => {
    setYAxisFields([...yAxisFields, { name: `Value ${yAxisFields.length + 1}`, field: '', type: 'sum' }])
  }

  const handleRemoveYAxis = (index) => {
    setYAxisFields(yAxisFields.filter((_, i) => i !== index))
  }

  const handleAddFilter = () => {
    setFilters([...filters, { field: '', operator: 'equals', value: '' }])
  }

  const handleRemoveFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index))
  }

  const renderChart = () => {
    if (!processedData.length || !xAxisField || yAxisFields.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--brown-200)' }}>
          <p>📊 Select data sources, X-axis, and at least one Y-axis field to display chart</p>
        </div>
      )
    }

    const fieldNames = yAxisFields.map(f => f.name || f.field || f)

    const commonProps = {
      data: processedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
              <XAxis dataKey={xAxisField} stroke="var(--brown-200)" />
              <YAxis stroke="var(--brown-200)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
              {fieldNames.map((field, idx) => (
                <Bar key={field} dataKey={field} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
              <XAxis dataKey={xAxisField} stroke="var(--brown-200)" />
              <YAxis stroke="var(--brown-200)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
              {fieldNames.map((field, idx) => (
                <Line key={field} type="monotone" dataKey={field} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
      case 'pie':
        if (fieldNames.length === 0) return null
        const pieData = processedData.map(item => ({
          name: item[xAxisField] || 'Unknown',
          value: parseFloat(item[fieldNames[0]]) || 0
        }))
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )
      default:
        return <p>Select a chart type</p>
    }
  }

  const handleSave = () => {
    const chartConfig = {
      id: Date.now(),
      title: chartTitle,
      type: chartType,
      chartType: chartType, // Alias for compatibility
      sources: selectedSources,
      xAxis: xAxisField,
      xAxisField: xAxisField, // Alias for compatibility
      yAxis: yAxisFields,
      yAxisFields: yAxisFields, // Alias for compatibility
      filters,
      processedData: processedData, // Include processed data so charts can be rendered
      postToPage,
      postToSection: postToPage === 'dashboard' ? postToSection : null,
      sharedPages: [postToPage], // Initialize with current page for sharing
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // Save to localStorage with page/section info
    const savedCharts = JSON.parse(localStorage.getItem('savedCharts') || '[]')
    savedCharts.push(chartConfig)
    localStorage.setItem('savedCharts', JSON.stringify(savedCharts))
    
    if (onSaveChart) {
      onSaveChart(chartConfig)
    }
    
    const sectionText = postToPage === 'dashboard' && postToSection ? ` in the ${DASHBOARD_SECTIONS.find(s => s.id === postToSection)?.name || postToSection} section` : ''
    alert(`✅ Chart saved! It will appear on the ${ALL_PAGES.find(p => p.id === postToPage)?.name || postToPage}${sectionText}.`)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95vw', width: '1400px', maxHeight: '95vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>📊 Unified Chart Builder</h2>
          <button className="btn btn-secondary" onClick={onClose}>✕ Close</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1.5rem' }}>
          {/* Configuration Panel */}
          <div style={{ borderRight: '2px solid var(--brown-500)', paddingRight: '1.5rem' }}>
            <div className="form-group">
              <label>📝 Chart Title</label>
              <input
                type="text"
                value={chartTitle}
                onChange={(e) => setChartTitle(e.target.value)}
                placeholder="My Custom Chart"
              />
            </div>

            <div className="form-group">
              <label>📍 Post Chart To Page</label>
              <select value={postToPage} onChange={(e) => {
                setPostToPage(e.target.value)
                if (e.target.value !== 'dashboard') {
                  setPostToSection('overview')
                }
              }}>
                {ALL_PAGES.map(page => (
                  <option key={page.id} value={page.id}>{page.name}</option>
                ))}
              </select>
            </div>

            {postToPage === 'dashboard' && (
              <div className="form-group">
                <label>📂 Dashboard Section</label>
                <select value={postToSection} onChange={(e) => setPostToSection(e.target.value)}>
                  {DASHBOARD_SECTIONS.map(section => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
                </select>
                <p style={{ fontSize: '0.85rem', color: 'var(--brown-200)', marginTop: '0.5rem' }}>
                  💡 Select which dashboard tab to post this chart to
                </p>
              </div>
            )}

            <div className="form-group">
              <label>📊 Data Sources (Select Multiple)</label>
              {DATA_SOURCES.map(source => (
                <label key={source.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(source.id)}
                    onChange={() => toggleSource(source.id)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  {source.name}
                </label>
              ))}
            </div>

            <div className="form-group">
              <label>📊 Chart Type</label>
              <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
                <option value="bar">📊 Bar Chart</option>
                <option value="line">📈 Line Chart</option>
                <option value="pie">🥧 Pie Chart</option>
              </select>
            </div>

            <div className="form-group">
              <label>📍 Post Chart To Page</label>
              <select value={postToPage} onChange={(e) => setPostToPage(e.target.value)}>
                {ALL_PAGES.map(page => (
                  <option key={page.id} value={page.id}>{page.name}</option>
                ))}
              </select>
            </div>

            {postToPage === 'dashboard' && (
              <div className="form-group">
                <label>📂 Dashboard Section</label>
                <select value={postToSection} onChange={(e) => setPostToSection(e.target.value)}>
                  {DASHBOARD_SECTIONS.map(section => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>↔️ X-Axis Field</label>
              <select value={xAxisField} onChange={(e) => setXAxisField(e.target.value)}>
                <option value="">Select field...</option>
                {availableFields.map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>↕️ Y-Axis Values (Multiple Lines)</label>
              {yAxisFields.map((field, idx) => (
                <div key={idx} style={{ border: '1px solid var(--brown-500)', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '4px' }}>
                  <input
                    type="text"
                    placeholder="Value name (e.g., 'Total Sales')"
                    value={field.name || ''}
                    onChange={(e) => {
                      const newFields = [...yAxisFields]
                      newFields[idx].name = e.target.value
                      setYAxisFields(newFields)
                    }}
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  />
                  <select
                    value={field.type || 'sum'}
                    onChange={(e) => {
                      const newFields = [...yAxisFields]
                      newFields[idx].type = e.target.value
                      setYAxisFields(newFields)
                    }}
                    style={{ width: '100%', marginBottom: '0.5rem' }}
                  >
                    <option value="sum">Sum</option>
                    <option value="count">Count</option>
                    <option value="avg">Average</option>
                  </select>
                  <select
                    value={field.field || ''}
                    onChange={(e) => {
                      const newFields = [...yAxisFields]
                      newFields[idx].field = e.target.value
                      setYAxisFields(newFields)
                    }}
                  >
                    <option value="">Select field...</option>
                    {availableFields.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <button className="btn btn-danger" onClick={() => handleRemoveYAxis(idx)} style={{ width: '100%', marginTop: '0.5rem', padding: '0.25rem' }}>
                    ✕ Remove
                  </button>
                </div>
              ))}
              <button className="btn btn-success" onClick={handleAddYAxis} style={{ width: '100%', marginTop: '0.5rem' }}>
                ➕ Add Value/Line
              </button>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={showFilters}
                  onChange={(e) => setShowFilters(e.target.checked)}
                />
                {' '}🔍 Enable Filters
              </label>
            </div>

            {showFilters && (
              <div className="form-group">
                <label>Filters</label>
                {filters.map((filter, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--brown-500)', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '4px' }}>
                    <select
                      value={filter.field}
                      onChange={(e) => {
                        const newFilters = [...filters]
                        newFilters[idx].field = e.target.value
                        setFilters(newFilters)
                      }}
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                    >
                      <option value="">Select field...</option>
                      {availableFields.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <select
                      value={filter.operator}
                      onChange={(e) => {
                        const newFilters = [...filters]
                        newFilters[idx].operator = e.target.value
                        setFilters(newFilters)
                      }}
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="greater">Greater Than</option>
                      <option value="less">Less Than</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Filter value"
                      value={filter.value}
                      onChange={(e) => {
                        const newFilters = [...filters]
                        newFilters[idx].value = e.target.value
                        setFilters(newFilters)
                      }}
                      style={{ width: '100%' }}
                    />
                    <button className="btn btn-danger" onClick={() => handleRemoveFilter(idx)} style={{ width: '100%', marginTop: '0.5rem', padding: '0.25rem' }}>
                      ✕ Remove Filter
                    </button>
                  </div>
                ))}
                <button className="btn btn-success" onClick={handleAddFilter} style={{ width: '100%', marginTop: '0.5rem' }}>
                  ➕ Add Filter
                </button>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!chartTitle || !xAxisField || yAxisFields.length === 0}
              >
                💾 Save Chart to Page
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => exportChartData(processedData, chartTitle, 'csv')}
                disabled={!processedData.length}
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          {/* Chart Preview */}
          <div>
            {loading ? (
              <div className="spinner"></div>
            ) : (
              <div className="card" style={{ minHeight: '500px' }}>
                <h3>{chartTitle}</h3>
                {renderChart()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnifiedChartBuilder

