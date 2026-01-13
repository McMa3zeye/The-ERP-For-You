import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { statsAPI, inventoryAPI, salesOrdersAPI, productsAPI } from '../services/api'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart, RadialBarChart, RadialBar, Treemap
} from 'recharts'
import { exportToCSV, exportToExcel, exportDashboardToPDF, exportChartData } from '../utils/export'
import UnifiedChartBuilder from '../components/UnifiedChartBuilder'
import ChartWidget from '../components/ChartWidget'
import ChartImporter from '../components/ChartImporter'

// Color palette for charts matching the tree theme
const CHART_COLORS = {
  primary: '#a8c090',
  secondary: '#8ba672',
  accent: '#d4a574',
  brown: '#b8966d',
  green: '#7a9565',
  amber: '#f0b86e',
  chartColors: ['#a8c090', '#8ba672', '#d4a574', '#b8966d', '#7a9565', '#f0b86e', '#9bb570', '#7b9a6a', '#c89664', '#b88654']
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function Dashboard() {
  const hasLoadedRef = useRef(false)
  const [stats, setStats] = useState({
    products: 0,
    active_products: 0,
    low_stock: 0,
    orders: 0,
    pending_orders: 0,
    total_sales: 0,
    avg_order_value: 0,
    gross_profit: 0,
    profit_margin: 0,
    sales_growth: 0,
    inventory_turnover: 0,
    total_inventory_value: 0,
    sales_by_status: [],
    sales_over_time: [],
    products_by_category: [],
    top_products: [],
    inventory_by_location: [],
    orders_by_day: [],
    orders_by_hour: [],
    product_velocity: [],
    top_customers: [],
    recent_orders: [],
    date_range: {}
  })
  const [lowStockItems, setLowStockItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30days')
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [fullscreen, setFullscreen] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [visibleWidgets, setVisibleWidgets] = useState({
    summary: true,
    salesCharts: true,
    productCharts: true,
    inventoryCharts: true,
    activity: true,
    metrics: true
  })
  const [showUnifiedChartBuilder, setShowUnifiedChartBuilder] = useState(false)
  const [editingChartConfig, setEditingChartConfig] = useState(null) // For editing existing charts
  const [savedCharts, setSavedCharts] = useState([])
  const [hiddenDefaultCharts, setHiddenDefaultCharts] = useState(() => {
    const saved = localStorage.getItem('hiddenDefaultCharts')
    return saved ? JSON.parse(saved) : []
  })
  const dashboardRef = useRef(null)
  
  // Function to convert default chart to custom chart
  const convertDefaultChartToCustom = (chartId, chartData, chartType, xAxis, yAxis) => {
    const chartConfig = {
      id: Date.now(),
      title: chartData.title || 'Custom Chart',
      type: chartType,
      chartType: chartType,
      sources: ['dashboard'], // Default source
      xAxis: xAxis || 'date',
      xAxisField: xAxis || 'date',
      yAxis: Array.isArray(yAxis) ? yAxis : [yAxis || 'value'],
      yAxisFields: Array.isArray(yAxis) ? yAxis : [yAxis || 'value'],
      filters: {},
      processedData: chartData.data || [],
      postToPage: 'dashboard',
      postToSection: activeTab,
      sharedPages: ['dashboard'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDefaultConverted: true
    }
    
    const saved = JSON.parse(localStorage.getItem('savedCharts') || '[]')
    saved.push(chartConfig)
    localStorage.setItem('savedCharts', JSON.stringify(saved))
    setSavedCharts(saved)
    window.dispatchEvent(new Event('chartsUpdated'))
    alert('✅ Chart converted to custom chart! You can now edit, delete, and import it.')
  }
  
  // Function to hide default chart
  const hideDefaultChart = (chartId) => {
    const newHidden = [...hiddenDefaultCharts, chartId]
    setHiddenDefaultCharts(newHidden)
    localStorage.setItem('hiddenDefaultCharts', JSON.stringify(newHidden))
  }
  
  // Function to edit default chart (converts to custom first)
  const editDefaultChart = (chartId, chartData, chartType, xAxis, yAxis) => {
    convertDefaultChartToCustom(chartId, chartData, chartType, xAxis, yAxis)
    // After conversion, open chart builder to edit
    setEditingChartConfig({
      title: chartData.title || 'Custom Chart',
      type: chartType,
      sources: ['dashboard'],
      xAxis: xAxis || 'date',
      yAxis: Array.isArray(yAxis) ? yAxis : [yAxis || 'value'],
      data: chartData.data || []
    })
    setShowUnifiedChartBuilder(true)
  }

  // Load saved charts from localStorage
  useEffect(() => {
    const loadSavedCharts = () => {
      const saved = localStorage.getItem('savedCharts')
      if (saved) {
        try {
          setSavedCharts(JSON.parse(saved))
        } catch (e) {
          console.error('Error loading saved charts:', e)
        }
      }
    }
    loadSavedCharts()
    // Reload when charts are updated
    window.addEventListener('chartsUpdated', loadSavedCharts)
    return () => window.removeEventListener('chartsUpdated', loadSavedCharts)
  }, [])

  const handleSaveChart = (chartConfig) => {
    const existing = JSON.parse(localStorage.getItem('savedCharts') || '[]')
    const newCharts = [...existing, chartConfig]
    setSavedCharts(newCharts)
    localStorage.setItem('savedCharts', JSON.stringify(newCharts))
    window.dispatchEvent(new Event('chartsUpdated'))
  }

  const loadStats = useCallback(async () => {
    // Only show loading on initial load or when dateRange changes
    if (!hasLoadedRef.current) {
      setLoading(true)
    }
    
    try {
      const endDate = new Date()
      const startDate = new Date()
      
      switch(dateRange) {
        case '7days':
          startDate.setDate(endDate.getDate() - 7)
          break
        case '30days':
          startDate.setDate(endDate.getDate() - 30)
          break
        case '90days':
          startDate.setDate(endDate.getDate() - 90)
          break
        case 'all':
          startDate.setFullYear(2020)
          break
        default:
          startDate.setDate(endDate.getDate() - 30)
      }
      
      const params = {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      }
      
      const [statsRes, lowStockRes] = await Promise.all([
        statsAPI.getStats(params),
        inventoryAPI.getLowStock(),
      ])

      setStats(statsRes.data)
      setLowStockItems(lowStockRes.data.slice(0, 10))
      hasLoadedRef.current = true
      setLoading(false)
    } catch (error) {
      console.error('Error loading stats:', error)
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    loadStats()
    const interval = setInterval(() => {
      loadStats()
    }, 300000) // Refresh every 5 minutes
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [dateRange, loadStats])


  const toggleWidget = useCallback((widget) => {
    setVisibleWidgets(prev => ({ ...prev, [widget]: !prev[widget] }))
  }, [])

  const handleExportPDF = () => {
    exportDashboardToPDF('dashboard-content', `dashboard_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const handleExportCSV = () => {
    const data = {
      'Total Sales': stats.total_sales,
      'Total Orders': stats.orders,
      'Avg Order Value': stats.avg_order_value,
      'Gross Profit': stats.gross_profit,
      'Profit Margin %': stats.profit_margin,
      'Total Products': stats.products,
      'Low Stock Items': stats.low_stock
    }
    exportToCSV(Object.entries(data).map(([k, v]) => ({ Metric: k, Value: v })), 'dashboard_stats.csv')
  }

  const handlePrint = () => {
    window.print()
  }

  // Memoize chart data to avoid recalculation on every render
  const salesChartData = useMemo(() => 
    (stats.sales_over_time || []).map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sales: parseFloat(item.total || 0),
      orders: item.count || 0
    })),
    [stats.sales_over_time]
  )

  const revenueBreakdownData = useMemo(() => [
    { name: 'Revenue', value: stats.total_sales },
    { name: 'Cost', value: stats.total_sales - stats.gross_profit },
    { name: 'Profit', value: stats.gross_profit }
  ], [stats.total_sales, stats.gross_profit])

  // Memoize filtered data
  const filteredSalesByStatus = useMemo(() => 
    selectedStatus ? stats.sales_by_status.filter(s => s.status === selectedStatus) : stats.sales_by_status,
    [selectedStatus, stats.sales_by_status]
  )

  const filteredProductsByCategory = useMemo(() =>
    selectedCategory ? stats.products_by_category.filter(c => c.category === selectedCategory) : stats.products_by_category,
    [selectedCategory, stats.products_by_category]
  )

  // Only show full-page spinner on initial load, not during background refreshes
  if (loading && (!stats || Object.keys(stats).length === 0 || !stats.orders && !stats.products)) {
    return <div className="spinner"></div>
  }

  return (
    <div id="dashboard-content" ref={dashboardRef} style={{ position: 'relative', backgroundColor: 'transparent' }}>
      {/* Header with controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem', 
        flexWrap: 'wrap', 
        gap: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'var(--grey-800)',
        padding: '1rem',
        borderRadius: '8px'
      }}>
        <h1>📊 Dashboard</h1>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Date Range */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {['7days', '30days', '90days', 'all'].map(range => (
              <button
                key={range}
                className={dateRange === range ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => setDateRange(range)}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
              >
                {range === '7days' ? '7D' : range === '30days' ? '30D' : range === '90days' ? '90D' : 'All'}
              </button>
            ))}
          </div>
          
          {/* View Controls */}
          <button
            className="btn btn-secondary"
            onClick={() => setCompactMode(!compactMode)}
            title={compactMode ? 'Normal View' : 'Compact View'}
          >
            {compactMode ? '🔍' : '⛶'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handlePrint}
            title="Print Dashboard"
          >
            🖨️
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleExportPDF}
            title="Export to PDF"
          >
            📄 PDF
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            title="Export to CSV"
          >
            📊 CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        borderBottom: '2px solid var(--brown-500)',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'overview', label: '📊 Overview', icon: '📊' },
          { id: 'sales', label: '💰 Sales Analytics', icon: '💰' },
          { id: 'products', label: '📦 Products', icon: '📦' },
          { id: 'inventory', label: '📊 Inventory', icon: '📊' },
          { id: 'customers', label: '👥 Customers', icon: '👥' },
          { id: 'activity', label: '📋 Activity Feed', icon: '📋' }
        ].map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setActiveTab(tab.id)}
            style={{ borderRadius: '8px 8px 0 0', marginBottom: '-2px' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Quick Actions - Above all graphs */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2>⚡ Quick Actions</h2>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <Link to="/products" className="btn btn-primary">➕ Add Product</Link>
              <Link to="/inventory" className="btn btn-primary">📦 Manage Inventory</Link>
              <Link to="/sales-orders" className="btn btn-primary">📋 Create Sales Order</Link>
              <button className="btn btn-secondary" onClick={() => loadStats()}>🔄 Refresh</button>
              <button className="btn btn-info" onClick={() => setShowUnifiedChartBuilder(true)}>
                📊 Create Custom Chart
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {visibleWidgets.summary && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: compactMode ? 'repeat(auto-fit, minmax(180px, 1fr))' : 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: compactMode ? '0.75rem' : '1.5rem', 
              marginBottom: '2rem' 
            }}>
              <MetricCard
                title="📦 Products"
                value={stats.products}
                subtitle={`${stats.active_products} active`}
                color="var(--green-300)"
                onClick={() => window.location.href = '/products'}
              />
              <MetricCard
                title="⚠️ Low Stock"
                value={stats.low_stock}
                subtitle="Items need attention"
                color={stats.low_stock > 0 ? 'var(--accent-amber)' : 'var(--green-500)'}
                onClick={() => window.location.href = '/inventory?low_stock=true'}
              />
              <MetricCard
                title="📋 Orders"
                value={stats.orders}
                subtitle={`${stats.pending_orders} pending`}
                color="var(--green-300)"
                onClick={() => window.location.href = '/sales-orders'}
              />
              <MetricCard
                title="💰 Total Sales"
                value={`$${(stats.total_sales || 0).toFixed(2)}`}
                subtitle={(stats.sales_growth || 0) >= 0 ? `↑ ${(stats.sales_growth || 0).toFixed(1)}%` : `↓ ${Math.abs(stats.sales_growth || 0).toFixed(1)}%`}
                color="var(--green-500)"
              />
              <MetricCard
                title="📈 Avg Order Value"
                value={`$${stats.avg_order_value.toFixed(2)}`}
                subtitle="Per order"
                color="var(--accent-amber)"
              />
              <MetricCard
                title="💵 Profit Margin"
                value={`${stats.profit_margin.toFixed(1)}%`}
                subtitle={`$${stats.gross_profit.toFixed(2)} profit`}
                color={stats.profit_margin > 20 ? 'var(--green-300)' : stats.profit_margin > 10 ? 'var(--accent-amber)' : 'var(--brown-300)'}
              />
              <MetricCard
                title="🔄 Inventory Turnover"
                value={stats.inventory_turnover.toFixed(2)}
                subtitle="Times per period"
                color="var(--green-400)"
              />
              <MetricCard
                title="📊 Inventory Value"
                value={`$${(stats.total_inventory_value || 0).toFixed(2)}`}
                subtitle="Total stock value"
                color="var(--brown-300)"
              />
            </div>
          )}

          {/* Key Metrics Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Sales Over Time */}
            {visibleWidgets.salesCharts && !hiddenDefaultCharts.includes('sales-over-time') && (
              <ChartWidget
                title="📈 Sales Over Time"
                isDefault={true}
                onExport={() => exportChartData(salesChartData, 'sales_over_time')}
                onEdit={() => editDefaultChart('sales-over-time', { title: '📈 Sales Over Time', data: salesChartData }, 'composed', 'date', ['sales', 'orders'])}
                onDelete={() => {
                  if (window.confirm('Hide this default chart? You can restore it later from settings.')) {
                    hideDefaultChart('sales-over-time')
                  }
                }}
                onToggle={() => toggleWidget('salesCharts')}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={salesChartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
                    <XAxis dataKey="date" stroke="var(--brown-200)" />
                    <YAxis yAxisId="left" stroke="var(--brown-200)" />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--brown-200)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="sales" stroke={CHART_COLORS.primary} fillOpacity={1} fill="url(#colorSales)" name="Sales ($)" />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke={CHART_COLORS.accent} strokeWidth={2} name="Orders" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartWidget>
            )}

            {/* Sales by Status */}
            {visibleWidgets.salesCharts && !hiddenDefaultCharts.includes('sales-by-status') && (
              <ChartWidget
                title="🥧 Sales by Status"
                isDefault={true}
                onExport={() => exportChartData(stats.sales_by_status, 'sales_by_status')}
                onEdit={() => editDefaultChart('sales-by-status', { title: '🥧 Sales by Status', data: filteredSalesByStatus }, 'pie', 'status', ['total'])}
                onDelete={() => {
                  if (window.confirm('Hide this default chart? You can restore it later from settings.')) {
                    hideDefaultChart('sales-by-status')
                  }
                }}
                onToggle={() => toggleWidget('salesCharts')}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.sales_by_status}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.sales_by_status.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={CHART_COLORS.chartColors[index % CHART_COLORS.chartColors.length]}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedStatus(selectedStatus === entry.status ? null : entry.status)}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartWidget>
            )}
          </div>
        </>
      )}

      {/* Sales Analytics Tab */}
      {activeTab === 'sales' && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Sales Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <ChartWidget
              title="💰 Revenue Breakdown"
              isDefault={true}
              onExport={() => exportChartData(revenueBreakdownData, 'revenue_breakdown')}
              onEdit={() => editDefaultChart('revenue-breakdown', { title: '💰 Revenue Breakdown', data: revenueBreakdownData }, 'pie', 'name', ['value'])}
              onDelete={() => {
                if (window.confirm('Hide this default chart? You can restore it later from settings.')) {
                  hideDefaultChart('revenue-breakdown')
                }
              }}
            >
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={revenueBreakdownData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                    {revenueBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS.chartColors[index]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartWidget>

            <ChartWidget
              title="📅 Sales by Day of Week"
              isDefault={true}
              onExport={() => exportChartData(stats.orders_by_day, 'sales_by_day')}
              onEdit={() => editDefaultChart('sales-by-day', { title: '📅 Sales by Day of Week', data: stats.orders_by_day }, 'bar', 'day_name', ['count', 'total'])}
              onDelete={() => {
                if (window.confirm('Hide this default chart? You can restore it later from settings.')) {
                  hideDefaultChart('sales-by-day')
                }
              }}
            >
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.orders_by_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
                  <XAxis dataKey="day_name" stroke="var(--brown-200)" />
                  <YAxis stroke="var(--brown-200)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
                  <Legend />
                  <Bar dataKey="count" fill={CHART_COLORS.primary} name="Orders" />
                  <Bar dataKey="total" fill={CHART_COLORS.accent} name="Revenue ($)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartWidget>

            <ChartWidget
              title="🕐 Sales by Hour"
              isDefault={true}
              onExport={() => exportChartData(stats.orders_by_hour, 'sales_by_hour')}
              onEdit={() => editDefaultChart('sales-by-hour', { title: '🕐 Sales by Hour', data: stats.orders_by_hour }, 'bar', 'hour', ['count'])}
              onDelete={() => {
                if (window.confirm('Hide this default chart? You can restore it later from settings.')) {
                  hideDefaultChart('sales-by-hour')
                }
              }}
            >
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.orders_by_hour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
                  <XAxis dataKey="hour" stroke="var(--brown-200)" label={{ value: 'Hour', position: 'insideBottom', offset: -5 }} />
                  <YAxis stroke="var(--brown-200)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
                  <Bar dataKey="count" fill={CHART_COLORS.secondary} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </ChartWidget>
          </div>

          {/* Top Customers */}
          <div className="card">
            <h2>🏆 Top Customers</h2>
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Customer</th>
                  <th>Orders</th>
                  <th>Total Spent</th>
                  <th>Avg Order</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_customers.map((customer, idx) => (
                  <tr key={idx}>
                    <td>#{idx + 1}</td>
                    <td>{customer.customer}</td>
                    <td>{customer.orders}</td>
                    <td>${customer.total_spent.toFixed(2)}</td>
                    <td>${(customer.total_spent / customer.orders).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.top_customers.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--brown-200)', padding: '2rem' }}>No customer data available</p>
            )}
          </div>
        </div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
            {/* Products by Category */}
            <ChartWidget
              title="📦 Products by Category"
              isDefault={true}
              onExport={() => exportChartData(stats.products_by_category, 'products_by_category')}
              onEdit={() => editDefaultChart('products-by-category', { title: '📦 Products by Category', data: stats.products_by_category }, 'pie', 'category', ['count'])}
              onDelete={() => {
                if (window.confirm('Hide this default chart? You can restore it later from settings.')) {
                  hideDefaultChart('products-by-category')
                }
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.products_by_category}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, count }) => `${category}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {stats.products_by_category.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS.chartColors[index % CHART_COLORS.chartColors.length]}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedCategory(selectedCategory === entry.category ? null : entry.category)}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartWidget>

            {/* Top Products */}
            <ChartWidget
              title="🏆 Top Selling Products"
              isDefault={true}
              onExport={() => exportChartData(stats.top_products, 'top_products')}
              onEdit={() => editDefaultChart('top-products', { title: '🏆 Top Selling Products', data: stats.top_products }, 'bar', 'name', ['revenue'])}
              onDelete={() => {
                if (window.confirm('Hide this default chart? You can restore it later from settings.')) {
                  hideDefaultChart('top-products')
                }
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.top_products.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
                  <XAxis type="number" stroke="var(--brown-200)" />
                  <YAxis dataKey="name" type="category" width={100} stroke="var(--brown-200)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="revenue" fill={CHART_COLORS.primary} name="Revenue ($)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartWidget>
          </div>

          {/* Product Velocity */}
          <div className="card">
            <h2>⚡ Product Velocity (Fast Movers)</h2>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Total Sold</th>
                  <th>Order Count</th>
                  <th>Velocity</th>
                </tr>
              </thead>
              <tbody>
                {stats.product_velocity.slice(0, 10).map((product, idx) => (
                  <tr key={idx}>
                    <td>{product.name}</td>
                    <td><strong>{product.sku}</strong></td>
                    <td>{product.total_sold}</td>
                    <td>{product.order_count}</td>
                    <td>{(product.total_sold / product.order_count).toFixed(2)} per order</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <ChartWidget
            title="📊 Inventory Value by Location"
            isDefault={true}
            onExport={() => exportChartData(stats.inventory_by_location, 'inventory_by_location')}
            onEdit={() => editDefaultChart('inventory-by-location', { title: '📊 Inventory Value by Location', data: stats.inventory_by_location }, 'bar', 'location', ['value', 'quantity'])}
            onDelete={() => {
              if (window.confirm('Hide this default chart? You can restore it later from settings.')) {
                hideDefaultChart('inventory-by-location')
              }
            }}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.inventory_by_location}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
                <XAxis dataKey="location" stroke="var(--brown-200)" />
                <YAxis stroke="var(--brown-200)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="value" fill={CHART_COLORS.accent} name="Value ($)" />
                <Bar dataKey="quantity" fill={CHART_COLORS.secondary} name="Quantity" />
              </BarChart>
            </ResponsiveContainer>
          </ChartWidget>

          {lowStockItems.length > 0 && (
            <div className="card" style={{ backgroundColor: 'rgba(240, 184, 110, 0.15)', border: '2px solid var(--accent-amber)' }}>
              <h2>⚠️ Low Stock Alerts</h2>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Location</th>
                    <th>On Hand</th>
                    <th>Reorder Point</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.product?.name || 'Unknown'}</td>
                      <td><strong>{item.product?.sku || '-'}</strong></td>
                      <td>{item.location}</td>
                      <td>{item.quantity_on_hand}</td>
                      <td>{item.reorder_point}</td>
                      <td>
                        <span className="badge badge-warning">⚠️ CRITICAL</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="card">
          <h2>👥 Top Customers Analysis</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <h3>Customer Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.top_customers.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
                  <XAxis dataKey="customer" stroke="var(--brown-200)" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="var(--brown-200)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
                  <Bar dataKey="total_spent" fill={CHART_COLORS.primary} name="Total Spent ($)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3>Customer Orders Frequency</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.top_customers.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 196, 168, 0.2)" />
                  <XAxis dataKey="customer" stroke="var(--brown-200)" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="var(--brown-200)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--grey-700)', border: '1px solid var(--brown-500)', color: 'var(--brown-200)' }} />
                  <Bar dataKey="orders" fill={CHART_COLORS.accent} name="Order Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Activity Feed Tab */}
      {activeTab === 'activity' && (
        <div className="card">
          <h2>📋 Recent Activity</h2>
          <div style={{ marginTop: '1rem' }}>
            <h3>📦 Recent Orders</h3>
            {stats.recent_orders.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_orders.map(order => (
                    <tr key={order.id}>
                      <td><strong>{order.order_number}</strong></td>
                      <td>{order.customer}</td>
                      <td>${order.total.toFixed(2)}</td>
                      <td><span className={`status-badge status-${order.status.toLowerCase().replace(/\s+/g, '-')}`}>{order.status}</span></td>
                      <td>{new Date(order.date).toLocaleDateString()}</td>
                      <td>
                        <Link to={`/sales-orders`} className="btn btn-info" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--brown-200)', padding: '2rem' }}>No recent orders</p>
            )}
          </div>

          {lowStockItems.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3>⚠️ Recent Low Stock Alerts</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                {lowStockItems.slice(0, 6).map(item => (
                  <div key={item.id} className="card" style={{ backgroundColor: 'rgba(240, 184, 110, 0.15)', border: '1px solid var(--accent-amber)' }}>
                    <strong>{item.product?.name || 'Unknown'}</strong>
                    <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>SKU: {item.product?.sku}</p>
                    <p style={{ margin: '0', color: 'var(--accent-amber)' }}>
                      {item.quantity_on_hand} / {item.reorder_point} (Reorder Point)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* Unified Chart Builder Modal */}
      {showUnifiedChartBuilder && (
        <div className="modal-overlay" onClick={() => {
          setShowUnifiedChartBuilder(false)
          setEditingChartConfig(null)
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95vw', width: '1200px' }}>
            <UnifiedChartBuilder
              onClose={() => {
                setShowUnifiedChartBuilder(false)
                setEditingChartConfig(null)
              }}
              onSaveChart={handleSaveChart}
              initialConfig={editingChartConfig}
            />
          </div>
        </div>
      )}

      {/* Saved Charts Section - Show charts for current tab only */}
      {savedCharts.filter(c => c.postToPage === 'dashboard' && (!c.postToSection || c.postToSection === activeTab)).length > 0 && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h2>📊 Saved Custom Charts</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
            {savedCharts
              .filter(c => c.postToPage === 'dashboard' && (!c.postToSection || c.postToSection === activeTab))
              .map(chart => (
                <div key={chart.id} className="card" style={{ backgroundColor: 'rgba(45, 27, 14, 0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3>{chart.title}</h3>
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        const existing = JSON.parse(localStorage.getItem('savedCharts') || '[]')
                        const newCharts = existing.filter(c => c.id !== chart.id)
                        setSavedCharts(newCharts)
                        localStorage.setItem('savedCharts', JSON.stringify(newCharts))
                        window.dispatchEvent(new Event('chartsUpdated'))
                      }}
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      🗑️
                    </button>
                  </div>
                  <p style={{ color: 'var(--brown-200)', fontSize: '0.9rem' }}>
                    Type: {chart.type} | Sources: {chart.sources.join(', ')}
                  </p>
                  {/* TODO: Render actual chart here based on chart config */}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Metric Card Component
function MetricCard({ title, value, subtitle, color, onClick }) {
  return (
    <div 
      className="card" 
      style={{ 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease'
      }}
      onClick={onClick}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: color, margin: '0.5rem 0' }}>
        {value}
      </p>
      {subtitle && (
        <p style={{ fontSize: '0.85rem', color: 'var(--brown-200)', margin: '0' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

export default Dashboard


