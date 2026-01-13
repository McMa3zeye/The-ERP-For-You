import { useState, useEffect, useMemo, useCallback } from 'react'
import { productsAPI, salesOrdersAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'
import UnifiedChartBuilder from '../components/UnifiedChartBuilder'
import ChartWidget from '../components/ChartWidget'
import ChartImporter from '../components/ChartImporter'
import { exportChartData } from '../utils/export'
import { useAuth } from '../contexts/AuthContext'

function Products() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('products.create')
  const canUpdate = hasPermission('products.update')
  const canDelete = hasPermission('products.delete')
  const [products, setProducts] = useState([])
  const [allProducts, setAllProducts] = useState([]) // For ingredient selection
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [linkedOrders, setLinkedOrders] = useState([])
  const [showIngredients, setShowIngredients] = useState(false)
  const [ingredients, setIngredients] = useState([])
  const [editingProduct, setEditingProduct] = useState(null)
  const [alert, setAlert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500) // 500ms debounce
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20
  
  // Ingredients to add during product creation
  const [formIngredients, setFormIngredients] = useState([])
  
  // Chart builder
  const [showChartBuilder, setShowChartBuilder] = useState(false)
  const [savedCharts, setSavedCharts] = useState([])
  
  // Load saved charts for this page
  useEffect(() => {
    const loadSavedCharts = () => {
      const saved = localStorage.getItem('savedCharts')
      if (saved) {
        try {
          const allCharts = JSON.parse(saved)
          setSavedCharts(allCharts.filter(c => 
            c.postToPage === 'products' || 
            (c.sharedPages && c.sharedPages.includes('products'))
          ))
        } catch (e) {
          console.error('Error loading saved charts:', e)
        }
      }
    }
    loadSavedCharts()
    window.addEventListener('chartsUpdated', loadSavedCharts)
    return () => window.removeEventListener('chartsUpdated', loadSavedCharts)
  }, [])
  
  const handleSaveChart = (chartConfig) => {
    const existing = JSON.parse(localStorage.getItem('savedCharts') || '[]')
    const newCharts = [...existing, chartConfig]
    localStorage.setItem('savedCharts', JSON.stringify(newCharts))
    window.dispatchEvent(new Event('chartsUpdated'))
  }
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit_of_measure: 'pcs',
    category: '',
    product_type: 'Final',
    base_price: 0,
    cost: 0,
    is_active: true,
    is_tracked: true,
  })

  const [ingredientForm, setIngredientForm] = useState({
    ingredient_id: '',
    quantity: 1,
  })

  useEffect(() => {
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProducts = useCallback(async (page = 1, skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true)
      const params = {
        skip: (page - 1) * itemsPerPage,
        limit: itemsPerPage
      }
      if (debouncedSearchTerm) params.search = debouncedSearchTerm
      if (filterType) params.product_type = filterType
      if (filterCategory) params.category = filterCategory
      if (filterActive !== '') params.is_active = filterActive === 'true'
      
      const response = await productsAPI.getAll(params)
      
      // Handle both old format (array) and new format (object with items)
      if (Array.isArray(response.data)) {
        setProducts(response.data)
        setTotalItems(response.data.length)
      } else {
        setProducts(response.data.items || [])
        setTotalItems(response.data.total || 0)
      }
    } catch (error) {
      showAlert('Error loading products: ' + error.message, 'error')
    } finally {
      if (!skipLoading) setLoading(false)
    }
  }, [debouncedSearchTerm, filterType, filterCategory, filterActive, itemsPerPage])

  // Load all products for ingredient dropdown (once on mount)
  useEffect(() => {
    const loadAllProducts = async () => {
      try {
        const response = await productsAPI.getAll({ limit: 1000 })
        const productList = Array.isArray(response.data) ? response.data : (response.data.items || [])
        setAllProducts(productList)
      } catch (error) {
        console.error('Error loading all products:', error)
      }
    }
    loadAllProducts()
  }, [])

  // Reset to page 1 when filters/search change, then reload table only (no full page reload)
  useEffect(() => {
    setCurrentPage(1)
    // Table will reload via the effect below with skipLoading to avoid full page reload
  }, [debouncedSearchTerm, filterType, filterCategory, filterActive])

  // Load data when page or filters change (table-only refresh when filters change)
  useEffect(() => {
    const shouldSkipLoading = currentPage === 1 && (debouncedSearchTerm || filterType || filterCategory || filterActive !== '')
    loadProducts(currentPage, shouldSkipLoading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm, filterType, filterCategory, filterActive])

  // Refresh table only (keeps search/filters static)
  const refreshTable = useCallback(() => {
    loadProducts(currentPage, true) // Skip loading spinner
  }, [loadProducts, currentPage])

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 4000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      let productId
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, formData)
        productId = editingProduct.id
        showAlert('✅ Product updated successfully!')
      } else {
        const created = await productsAPI.create(formData)
        productId = created.data.id
        showAlert('✅ Product created successfully! SKU auto-generated.')
      }
      
      // Add ingredients if any were selected during creation
      if (formIngredients.length > 0 && productId) {
        for (const ing of formIngredients) {
          try {
            await productsAPI.addIngredient(productId, {
              ingredient_id: ing.ingredient_id,
              quantity: ing.quantity
            })
          } catch (ingError) {
            console.error('Error adding ingredient:', ingError)
          }
        }
        setFormIngredients([])
        showAlert('✅ Product and ingredients saved!')
      }
      
      resetForm()
      refreshTable() // Refresh table only, not full page
    } catch (error) {
      showAlert('⚠️ Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleAddFormIngredient = () => {
    setFormIngredients([...formIngredients, { ingredient_id: '', quantity: 1 }])
  }

  const handleRemoveFormIngredient = (index) => {
    setFormIngredients(formIngredients.filter((_, i) => i !== index))
  }

  const handleFormIngredientChange = (index, field, value) => {
    const newIngredients = [...formIngredients]
    newIngredients[index][field] = field === 'ingredient_id' ? parseInt(value) : parseFloat(value) || 1
    setFormIngredients(newIngredients)
  }

  // Load categories from API (more reliable than extracting from products)
  const [categories, setCategories] = useState([])
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await productsAPI.getCategories()
        setCategories(response.data || [])
      } catch (error) {
        console.error('Error loading categories:', error)
        // Fallback: extract from products if API fails
        setCategories([...new Set(products.map(p => p.category).filter(Boolean))].sort())
      }
    }
    loadCategories()
  }, []) // Load once on mount

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      unit_of_measure: product.unit_of_measure,
      category: product.category || '',
      product_type: product.product_type || 'Final',
      base_price: product.base_price,
      cost: product.cost,
      is_active: product.is_active,
      is_tracked: product.is_tracked,
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('⚠️ Are you sure you want to delete this product?')) return
    
    try {
      await productsAPI.delete(id)
      showAlert('✅ Product deleted successfully')
      loadProducts()
    } catch (error) {
      showAlert('⚠️ Error deleting product: ' + error.message, 'error')
    }
  }

  const handleViewDetails = async (product) => {
    setSelectedProduct(product)
    try {
      const response = await productsAPI.getSalesOrders(product.id)
      setLinkedOrders(response.data)
      setShowDetails(true)
    } catch (error) {
      showAlert('⚠️ Error loading details: ' + error.message, 'error')
    }
  }

  const handleViewIngredients = async (product) => {
    setSelectedProduct(product)
    try {
      const response = await productsAPI.getIngredients(product.id)
      setIngredients(response.data)
      setShowIngredients(true)
    } catch (error) {
      showAlert('⚠️ Error loading ingredients: ' + error.message, 'error')
    }
  }

  const handleAddIngredient = async (e) => {
    e.preventDefault()
    if (!selectedProduct || !ingredientForm.ingredient_id) {
      showAlert('⚠️ Please select an ingredient', 'error')
      return
    }
    
    try {
      await productsAPI.addIngredient(selectedProduct.id, ingredientForm)
      showAlert('✅ Ingredient added successfully!')
      setIngredientForm({ ingredient_id: '', quantity: 1 })
      handleViewIngredients(selectedProduct)
    } catch (error) {
      showAlert('⚠️ Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleRemoveIngredient = async (ingredientId) => {
    if (!window.confirm('⚠️ Remove this ingredient?')) return
    
    try {
      await productsAPI.removeIngredient(selectedProduct.id, ingredientId)
      showAlert('✅ Ingredient removed')
      handleViewIngredients(selectedProduct)
    } catch (error) {
      showAlert('⚠️ Error removing ingredient: ' + error.message, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      unit_of_measure: 'pcs',
      category: '',
      product_type: 'Final',
      base_price: 0,
      cost: 0,
      is_active: true,
      is_tracked: true,
    })
    setFormIngredients([])
    setEditingProduct(null)
    setShowForm(false)
  }

  // Memoize sub-assemblies and raw materials for ingredient selection
  const subAssemblyProducts = useMemo(() =>
    allProducts.filter(p => p.product_type === 'Sub-assembly' || p.product_type === 'Raw Material'),
    [allProducts]
  )

  if (loading) {
    return <div className="spinner"></div>
  }

  return (
    <div className="page-container">
      {/* Chart Builder and Import - At the very top */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>
          📦 Products & Pricing
          <PageHelpCorner />
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-info" onClick={() => setShowChartBuilder(true)}>
            📊 Create Chart
          </button>
          <ChartImporter currentPage="products" onImport={() => {
            const saved = localStorage.getItem('savedCharts')
            if (saved) {
              try {
                const allCharts = JSON.parse(saved)
                setSavedCharts(allCharts.filter(c => c.postToPage === 'products' || (c.sharedPages && c.sharedPages.includes('products'))))
              } catch (e) {
                console.error('Error reloading charts:', e)
              }
            }
          }} />
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? '❌ Cancel' : '➕ Add Product'}
            </button>
          )}
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      {/* Search and Filters */}
      <div className="search-bar">
        <input
          type="search"
          placeholder="🔍 Search by name or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: '2', minWidth: '250px' }}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          <option value="Final">🪵 Final Products</option>
          <option value="Sub-assembly">🔩 Sub-assemblies</option>
          <option value="Raw Material">🌲 Raw Materials</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">✅ Active</option>
          <option value="false">❌ Inactive</option>
        </select>
        {(searchTerm || filterType || filterCategory || filterActive) && (
          <button className="btn btn-secondary" onClick={() => {
            setSearchTerm('')
            setFilterType('')
            setFilterCategory('')
            setFilterActive('')
          }}>
            🗑️ Clear Filters
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h2>{editingProduct ? '✏️ Edit Product' : '➕ New Product'}</h2>
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            💡 SKU will be auto-generated: {
              formData.product_type === 'Final' ? 'P-YYYY-####-####' : 
              formData.product_type === 'Raw Material' ? 'R-YYYY-####-####' :
              'M-YYYY-####-####'
            }
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>📝 Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>🏷️ Product Type *</label>
                <select
                  value={formData.product_type}
                  onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                  required
                  disabled={!!editingProduct}
                >
                  <option value="Final">🪵 Final Product</option>
                  <option value="Sub-assembly">🔩 Sub-assembly</option>
                  <option value="Raw Material">🌲 Raw Material</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>📄 Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>📏 Unit of Measure</label>
                <select
                  value={formData.unit_of_measure}
                  onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                >
                  <option value="pcs">Pieces</option>
                  <option value="kg">Kilograms</option>
                  <option value="m">Meters</option>
                  <option value="m2">Square Meters</option>
                  <option value="m3">Cubic Meters</option>
                </select>
              </div>
              <div className="form-group">
                <label>📂 Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  list="categories"
                />
                <datalist id="categories">
                  {categories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>💰 Base Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label>💵 Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  {' '}✅ Active
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_tracked}
                    onChange={(e) => setFormData({ ...formData, is_tracked: e.target.checked })}
                  />
                  {' '}📊 Track Inventory
                </label>
              </div>
            </div>

            {/* Ingredients/Materials Selection - Only for Final Products or Sub-assemblies that use other Sub-assemblies */}
            {formData.product_type === 'Final' && (
              <div className="card" style={{ marginTop: '1.5rem', backgroundColor: 'rgba(45, 27, 14, 0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3>🔩 Ingredients/Materials</h3>
                  <button type="button" className="btn btn-success" onClick={handleAddFormIngredient}>
                    ➕ Add Material
                  </button>
                </div>
                <p style={{ color: 'var(--brown-200)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  💡 Add raw materials (wood, glue, etc.) or sub-assemblies as ingredients. Only Sub-assembly or Raw Material products can be selected as ingredients.
                </p>
                
                {formIngredients.length > 0 && formIngredients.map((ing, index) => (
                  <div key={index} style={{ 
                    border: '1px solid var(--brown-500)', 
                    padding: '1rem', 
                    marginBottom: '1rem', 
                    borderRadius: '8px',
                    backgroundColor: 'rgba(45, 27, 14, 0.3)'
                  }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>📦 Material/Ingredient *</label>
                        <select
                          value={ing.ingredient_id}
                          onChange={(e) => handleFormIngredientChange(index, 'ingredient_id', e.target.value)}
                          required
                        >
                          <option value="">Select material...</option>
                          {subAssemblyProducts
                            .filter(p => !editingProduct || p.id !== editingProduct.id)
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.sku} - {p.name}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>🔢 Quantity per Product *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={ing.quantity}
                          onChange={(e) => handleFormIngredientChange(index, 'quantity', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>&nbsp;</label>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleRemoveFormIngredient(index)}
                          style={{ width: '100%' }}
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {formIngredients.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--brown-300)', padding: '1rem', fontStyle: 'italic' }}>
                    No ingredients added. Click "➕ Add Material" to add ingredients/materials.
                  </p>
                )}
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary">
                {editingProduct ? '💾 Update' : '✨ Create'} Product
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                ❌ Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product Details Modal */}
      {showDetails && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>📋 Product Details: {selectedProduct.name}</h2>
              <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>✕</button>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <p><strong>SKU:</strong> {selectedProduct.sku}</p>
              <p><strong>Type:</strong> {
                selectedProduct.product_type === 'Final' ? '🪵 Final' : 
                selectedProduct.product_type === 'Sub-assembly' ? '🔩 Sub-assembly' : 
                '🌲 Raw Material'
              }</p>
              <p><strong>Category:</strong> {selectedProduct.category || 'N/A'}</p>
              <p><strong>Price:</strong> ${selectedProduct.base_price.toFixed(2)}</p>
              <p><strong>Cost:</strong> ${selectedProduct.cost.toFixed(2)}</p>
            </div>
            <h3>📦 Linked Sales Orders ({linkedOrders.length})</h3>
            {linkedOrders.length === 0 ? (
              <p style={{ color: 'var(--brown-200)' }}>No sales orders found for this product.</p>
            ) : (
              <table style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th>Order Number</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Quantity</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedOrders.map(order => {
                    const item = order.items.find(i => i.product_id === selectedProduct.id)
                    return item ? (
                      <tr key={order.id}>
                        <td>{order.order_number}</td>
                        <td>{order.customer_name}</td>
                        <td><span className={`status-badge status-${order.status.toLowerCase().replace(/\s+/g, '-')}`}>{order.status}</span></td>
                        <td>{item.quantity}</td>
                        <td>${order.grand_total.toFixed(2)}</td>
                      </tr>
                    ) : null
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Ingredients Modal */}
      {showIngredients && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowIngredients(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>🔩 Ingredients/Materials: {selectedProduct.name}</h2>
              <button className="btn btn-secondary" onClick={() => setShowIngredients(false)}>✕</button>
            </div>
            
            <form onSubmit={handleAddIngredient} style={{ marginBottom: '1.5rem' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Select Material/Ingredient</label>
                      <select
                        value={ingredientForm.ingredient_id}
                        onChange={(e) => setIngredientForm({ ...ingredientForm, ingredient_id: e.target.value })}
                        required
                      >
                        <option value="">Choose material...</option>
                        {subAssemblyProducts
                          .filter(p => p.id !== selectedProduct.id)
                          .map(p => (
                            <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                          ))}
                      </select>
                </div>
                <div className="form-group">
                  <label>Quantity per Product</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingredientForm.quantity}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, quantity: parseFloat(e.target.value) || 1 })}
                    required
                    min="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>&nbsp;</label>
                  <button type="submit" className="btn btn-success">➕ Add</button>
                </div>
              </div>
            </form>

            <h3>Current Ingredients ({ingredients.length})</h3>
            {ingredients.length === 0 ? (
              <p style={{ color: 'var(--brown-200)' }}>No ingredients added yet.</p>
            ) : (
              <table style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Quantity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map(ing => (
                    <tr key={ing.id}>
                      <td>{ing.ingredient?.sku}</td>
                      <td>{ing.ingredient?.name}</td>
                      <td>{ing.quantity}</td>
                      <td>
                        <button className="btn btn-danger" onClick={() => handleRemoveIngredient(ing.id)}>
                          🗑️ Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>📦 Product List ({totalItems})</h2>
          <button className="btn btn-secondary" onClick={refreshTable} title="Refresh Table Only">
            🔄 Refresh Table
          </button>
        </div>
        {products.length === 0 && !loading ? (
          <p>No products found. Create your first product above.</p>
        ) : (
          <>
          <SortableTable
            data={products}
            columns={[
              { key: 'sku', label: 'SKU', render: (value) => <strong>{value}</strong> },
              { key: 'name', label: 'Name' },
              { 
                key: 'product_type', 
                label: 'Type',
                render: (value) => {
                  if (value === 'Final') return '🪵 Final'
                  if (value === 'Sub-assembly') return '🔩 Sub-assembly'
                  if (value === 'Raw Material') return '🌲 Raw Material'
                  return value
                }
              },
              { key: 'category', label: 'Category', render: (value) => value || '-' },
              { key: 'unit_of_measure', label: 'Unit' },
              { 
                key: 'base_price', 
                label: 'Price',
                render: (value) => `$${parseFloat(value || 0).toFixed(2)}`
              },
              { 
                key: 'cost', 
                label: 'Cost',
                render: (value) => `$${parseFloat(value || 0).toFixed(2)}`
              },
              {
                key: 'is_active',
                label: 'Status',
                render: (value) => (
                  <span style={{ color: value ? 'var(--green-300)' : 'var(--brown-300)' }}>
                    {value ? '✅ Active' : '❌ Inactive'}
                  </span>
                )
              },
              {
                key: 'actions',
                label: 'Actions',
                sortable: false,
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-info" onClick={() => handleViewIngredients(row)} title="View Ingredients" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                      🔩
                    </button>
                    <button className="btn btn-info" onClick={() => handleViewDetails(row)} title="View Details" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                      📋
                    </button>
                    {canUpdate && (
                      <button className="btn btn-primary" onClick={() => handleEdit(row)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                        ✏️
                      </button>
                    )}
                    {canDelete && (
                      <button className="btn btn-danger" onClick={() => handleDelete(row.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                        🗑️
                      </button>
                    )}
                  </div>
                )
              }
            ]}
          />
          
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / itemsPerPage)}
            onPageChange={(page) => {
              setCurrentPage(page)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
          />
          </>
        )}
      </div>
    </div>
  )
}

export default Products
