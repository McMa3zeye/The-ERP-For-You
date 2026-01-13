import { useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart, ScatterChart, Scatter
} from 'recharts'
import { exportChartData } from '../utils/export'

const CHART_COLORS = {
  primary: '#a8c090',
  secondary: '#8ba672',
  accent: '#d4a574',
  chartColors: ['#a8c090', '#8ba672', '#d4a574', '#b8966d', '#7a9565', '#f0b86e', '#9bb570', '#7b9a6a']
}

function ChartBuilder({ data, onClose }) {
  const [chartType, setChartType] = useState('bar')
  const [xAxisField, setXAxisField] = useState('')
  const [yAxisFields, setYAxisFields] = useState([])
  const [filterField, setFilterField] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [groupBy, setGroupBy] = useState('')
  const [chartTitle, setChartTitle] = useState('Custom Chart')
  const [showFilters, setShowFilters] = useState(false)

  // Get available fields from data
  const availableFields = data && data.length > 0 ? Object.keys(data[0]) : []
  
  // Get unique values for filter dropdown
  const filterValues = filterField && data ? [...new Set(data.map(item => item[filterField]).filter(Boolean))] : []
  
  // Process data with filters
  let processedData = [...(data || [])]
  
  if (filterField && filterValue) {
    processedData = processedData.filter(item => item[filterField] === filterValue)
  }
  
  if (groupBy && xAxisField) {
    // Group and aggregate
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
        grouped[key][field] = (grouped[key][field] || 0) + (parseFloat(item[field]) || 0)
      })
    })
    processedData = Object.values(grouped)
  }

  const handleAddYAxis = () => {
    const available = availableFields.filter(f => f !== xAxisField && !yAxisFields.includes(f))
    if (available.length > 0) {
      setYAxisFields([...yAxisFields, available[0]])
    }
  }

  const handleRemoveYAxis = (field) => {
    setYAxisFields(yAxisFields.filter(f => f !== field))
  }

  const renderChart = () => {
    if (!processedData.length || !xAxisField || yAxisFields.length === 0) {
      return (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--brown-200)' }}>
          <p>📊 Select X-axis and at least one Y-axis field to display chart</p>
        </div>
      )
    }

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
              {yAxisFields.map((field, idx) => (
                <Bar key={field} dataKey={field} fill={CHART_COLORS.chartColors[idx % CHART_COLORS.chartColors.length]} />
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
              {yAxisFields.map((field, idx) => (
                <Line key={field} type="monotone" dataKey={field} stroke={CHART_COLORS.chartColors[idx % CHART_COLORS.chartColors.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...commonProps}>
              <defs>
                {yAxisFields.map((field, idx) => (
                  <linearGradient key={field} id={`color${field}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.chartColors[idx]} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={CHART_COLORS.chartColors[idx]} stopOpacity={0.1}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
              <XAxis dataKey={xAxisField} stroke="var(--brown-200)" />
              <YAxis stroke="var(--brown-200)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
              {yAxisFields.map((field, idx) => (
                <Area key={field} type="monotone" dataKey={field} stroke={CHART_COLORS.chartColors[idx]} fill={`url(#color${field})`} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'pie':
        if (yAxisFields.length === 0) return null
        const pieData = processedData.map(item => ({
          name: item[xAxisField] || 'Unknown',
          value: parseFloat(item[yAxisFields[0]]) || 0
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
                  <Cell key={`cell-${index}`} fill={CHART_COLORS.chartColors[index % CHART_COLORS.chartColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'composed':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
              <XAxis dataKey={xAxisField} stroke="var(--brown-200)" />
              <YAxis yAxisId="left" stroke="var(--brown-200)" />
              <YAxis yAxisId="right" orientation="right" stroke="var(--brown-200)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
              {yAxisFields.slice(0, 1).map((field, idx) => (
                <Area key={field} yAxisId="left" type="monotone" dataKey={field} fill={CHART_COLORS.chartColors[idx]} fillOpacity={0.6} />
              ))}
              {yAxisFields.slice(1).map((field, idx) => (
                <Line key={field} yAxisId="right" type="monotone" dataKey={field} stroke={CHART_COLORS.chartColors[idx + 1]} strokeWidth={2} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )

      case 'scatter':
        if (yAxisFields.length < 2) {
          return <p style={{ padding: '2rem', textAlign: 'center' }}>Scatter chart requires 2 Y-axis fields</p>
        }
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
              <XAxis dataKey={xAxisField} stroke="var(--brown-200)" />
              <YAxis dataKey={yAxisFields[0]} stroke="var(--brown-200)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
              <Scatter dataKey={yAxisFields[1]} fill={CHART_COLORS.primary} />
            </ScatterChart>
          </ResponsiveContainer>
        )

      default:
        return <p>Select a chart type</p>
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95vw', width: '1200px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>📊 Custom Chart Builder</h2>
          <button className="btn btn-secondary" onClick={onClose}>✕ Close</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
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
              <label>📊 Chart Type</label>
              <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
                <option value="bar">📊 Bar Chart</option>
                <option value="line">📈 Line Chart</option>
                <option value="area">📉 Area Chart</option>
                <option value="pie">🥧 Pie Chart</option>
                <option value="composed">📊 Composed (Area + Line)</option>
                <option value="scatter">🎯 Scatter Plot</option>
              </select>
            </div>

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
              <label>↕️ Y-Axis Fields</label>
              {yAxisFields.map((field, idx) => (
                <div key={field} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <select value={field} onChange={(e) => {
                    const newFields = [...yAxisFields]
                    newFields[idx] = e.target.value
                    setYAxisFields(newFields)
                  }}>
                    {availableFields.filter(f => f !== xAxisField).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <button className="btn btn-danger" onClick={() => handleRemoveYAxis(field)} style={{ padding: '0.25rem 0.5rem' }}>
                    ✕
                  </button>
                </div>
              ))}
              {yAxisFields.length < availableFields.length - 1 && (
                <button className="btn btn-success" onClick={handleAddYAxis} style={{ width: '100%', marginTop: '0.5rem' }}>
                  ➕ Add Y-Axis
                </button>
              )}
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
              <>
                <div className="form-group">
                  <label>🔍 Filter By Field</label>
                  <select value={filterField} onChange={(e) => {
                    setFilterField(e.target.value)
                    setFilterValue('')
                  }}>
                    <option value="">No filter...</option>
                    {availableFields.map(field => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>

                {filterField && filterValues.length > 0 && (
                  <div className="form-group">
                    <label>🎯 Filter Value</label>
                    <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
                      <option value="">All values...</option>
                      {filterValues.map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>📊 Group By (for aggregation)</label>
                  <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                    <option value="">No grouping...</option>
                    {availableFields.map(field => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <button
                className="btn btn-primary"
                onClick={() => exportChartData(processedData, chartTitle, 'csv')}
                disabled={!processedData.length}
              >
                📥 Export CSV
              </button>
              <button
                className="btn btn-primary"
                onClick={() => exportChartData(processedData, chartTitle, 'excel')}
                disabled={!processedData.length}
              >
                📥 Export Excel
              </button>
            </div>
          </div>

          {/* Chart Preview */}
          <div>
            <div className="card" style={{ minHeight: '500px' }}>
              <h3>{chartTitle}</h3>
              {renderChart()}
              
              {processedData.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <details>
                    <summary style={{ cursor: 'pointer', color: 'var(--green-300)', marginBottom: '0.5rem' }}>
                      📋 View Data ({processedData.length} rows)
                    </summary>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '0.5rem' }}>
                      <table style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            {availableFields.map(field => (
                              <th key={field}>{field}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {processedData.slice(0, 20).map((row, idx) => (
                            <tr key={idx}>
                              {availableFields.map(field => (
                                <td key={field}>{row[field] || '-'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {processedData.length > 20 && (
                        <p style={{ textAlign: 'center', marginTop: '0.5rem', color: 'var(--brown-200)' }}>
                          Showing first 20 of {processedData.length} rows
                        </p>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChartBuilder

