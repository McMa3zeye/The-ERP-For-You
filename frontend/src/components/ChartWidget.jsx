import { useMemo, memo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts'

const CHART_COLORS = ['#a8c090', '#8ba672', '#d4a574', '#b8966d', '#7a9565', '#f0b86e', '#9bb570', '#7b9a6a']

const ChartWidget = memo(function ChartWidget({ title, children, onExport, onToggle, onDelete, onEdit, isCustom, chartConfig, isDefault }) {
  // Render custom chart if chartConfig is provided
  const renderedChart = useMemo(() => {
    if (!isCustom || !chartConfig) {
      return children
    }

    // Handle both old format (with yAxisFields as array of strings) and new format (with yAxisFields as array of objects)
    const { type, chartType = type, xAxisField = chartConfig.xAxis, yAxisFields = chartConfig.yAxis, processedData } = chartConfig
    
    // Convert yAxisFields to array of field names if needed
    let yAxisFieldNames = []
    if (Array.isArray(yAxisFields) && yAxisFields.length > 0) {
      yAxisFieldNames = yAxisFields.map(field => {
        if (typeof field === 'string') return field
        if (field && typeof field === 'object' && field.field) return field.field
        return null
      }).filter(f => f !== null)
    }
    
    // If processedData is not available, show message
    if (!processedData || !Array.isArray(processedData) || processedData.length === 0) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--brown-200)' }}>
          <p>⚠️ Chart data not available. Please recreate this chart to view it.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Chart config: {chartConfig.title || 'Untitled'} ({chartType || type || 'unknown'})
          </p>
        </div>
      )
    }

    if (!processedData || !Array.isArray(processedData) || processedData.length === 0 || !xAxisField || !yAxisFieldNames || yAxisFieldNames.length === 0) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--brown-200)' }}>
          <p>No data available for this chart</p>
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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
              <XAxis dataKey={xAxisField} stroke="var(--brown-200)" />
              <YAxis stroke="var(--brown-200)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
              {yAxisFieldNames.map((field, idx) => (
                <Bar key={field} dataKey={field} fill={CHART_COLORS[idx % CHART_COLORS.length]} name={field} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
              <XAxis dataKey={xAxisField} stroke="var(--brown-200)" />
              <YAxis stroke="var(--brown-200)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
              {yAxisFieldNames.map((field, idx) => (
                <Line key={field} type="monotone" dataKey={field} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} name={field} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart {...commonProps}>
              <defs>
                {yAxisFieldNames.map((field, idx) => (
                  <linearGradient key={field} id={`color${field}${chartConfig.id || idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[idx]} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={CHART_COLORS[idx]} stopOpacity={0.1}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
              <XAxis dataKey={xAxisField} stroke="var(--brown-200)" />
              <YAxis stroke="var(--brown-200)" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
              {yAxisFieldNames.map((field, idx) => (
                <Area key={field} type="monotone" dataKey={field} stroke={CHART_COLORS[idx]} fill={`url(#color${field}${chartConfig.id || idx})`} name={field} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey={yAxisFieldNames[0] || 'value'}
                nameKey={xAxisField}
              >
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )

      default:
        return (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--brown-200)' }}>
            <p>Unsupported chart type: {chartType}</p>
          </div>
        )
    }
  }, [isCustom, chartConfig, children])

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>{title}</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onExport && (
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={onExport} 
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              title="Export Chart Data"
            >
              📥 Export
            </button>
          )}
          {onEdit && (
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={onEdit} 
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              title="Edit/Convert Chart"
            >
              ✏️ {isDefault ? 'Convert' : 'Edit'}
            </button>
          )}
          {onDelete && (
            <button 
              type="button"
              className="btn btn-danger" 
              onClick={onDelete} 
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              title="Delete Chart"
            >
              🗑️ Delete
            </button>
          )}
          {onToggle && (
            <button 
              type="button"
              className="btn btn-secondary" 
              onClick={onToggle} 
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
              title="Toggle Visibility"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {renderedChart}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if props actually change
  return (
    prevProps.title === nextProps.title &&
    prevProps.isCustom === nextProps.isCustom &&
    prevProps.chartConfig === nextProps.chartConfig &&
    prevProps.children === nextProps.children &&
    prevProps.onExport === nextProps.onExport &&
    prevProps.onToggle === nextProps.onToggle &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.isDefault === nextProps.isDefault
  )
})

ChartWidget.displayName = 'ChartWidget'

export default ChartWidget

