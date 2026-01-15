/* Products.jsx */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { productsAPI, inventoryAPI, purchasingAPI } from '../services/api'
import Pagination from '../components/Pagination'
import PageHelpCorner from '../components/PageHelpCorner'
import SortableTable from '../components/SortableTable'
import { useDebounce } from '../hooks/useDebounce'

// NOTE: These were imported but not used in the snippet.
// If you truly don't use them in this file, remove them to avoid eslint warnings.
// import UnifiedChartBuilder from '../components/UnifiedChartBuilder'
// import ChartWidget from '../components/ChartWidget'
// import ChartImporter from '../components/ChartImporter'
// import { exportChartData } from '../utils/export'

import { useAuth } from '../contexts/AuthContext'

function Products() {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()

  const canCreate = hasPermission('products.create')
  const canUpdate = hasPermission('products.update')
  const canDelete = hasPermission('products.delete')

  const [products, setProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [inventoryByProduct, setInventoryByProduct] = useState({})
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  const [linkedSalesOrders, setLinkedSalesOrders] = useState([])
  const [linkedPurchaseOrders, setLinkedPurchaseOrders] = useState([])
  const [linkedEmplacements, setLinkedEmplacements] = useState([])
  const [linkedTransfers, setLinkedTransfers] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  const DETAILS_TABS = ['SO', 'PO', 'Emplacements', 'Transfers']
  const [activeDetailsTab, setActiveDetailsTab] = useState(DETAILS_TABS[0])

  const [emplacementForm, setEmplacementForm] = useState({
    location: '',
    quantity_on_hand: 0,
    reorder_point: 0,
    reorder_quantity: 0,
  })

  const [showIngredients, setShowIngredients] = useState(false)
  const [ingredients, setIngredients] = useState([])
  const [editingProduct, setEditingProduct] = useState(null)

  const [alert, setAlert] = useState(null)

  // FIX: showAlert was a new function every render.
  // That breaks hook dependencies because you used showAlert inside useCallback(loadProducts).
  // Making showAlert a useCallback stabilizes it and prevents re-creating loadProducts every render.
  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    window.setTimeout(() => setAlert(null), 4000)
  }, [])

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterActive, setFilterActive] = useState('')

  const normalizeProductType = useCallback((value) => {
    if (!value) return 'Goods'
    if (value === 'Final') return 'Goods'
    if (value === 'Sub-assembly') return 'Services'
    if (value === 'Raw Material') return 'Both'
    return value
  }, [])

  const mapProductTypeToApi = useCallback((value) => {
    if (!value) return undefined
    if (value === 'Goods') return 'Final'
    if (value === 'Services') return 'Sub-assembly'
    if (value === 'Both') return 'Raw Material'
    return value
  }, [])

  const MAIN_TABS = ['Products', 'Categories', 'Units', 'Currencies']
  const [activeTab, setActiveTab] = useState(MAIN_TABS[0])

  const [categoryOptions, setCategoryOptions] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [currencyOptions, setCurrencyOptions] = useState([])

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newUnitName, setNewUnitName] = useState('')
  const [newCurrencyName, setNewCurrencyName] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  const [formIngredients, setFormIngredients] = useState([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit_of_measure: 'pcs',
    category: '',
    currency: 'USD',
    product_type: 'Goods',
    base_price: 0,
    cost: 0,
    is_active: true,
    is_tracked: true,
  })

  const [ingredientForm, setIngredientForm] = useState({
    ingredient_id: '',
    quantity: 1,
  })

  const loadProducts = useCallback(
    async (page = 1, skipLoading = false) => {
      if (!skipLoading) setLoading(true)

      try {
        const params = {
          skip: (page - 1) * itemsPerPage,
          limit: itemsPerPage,
        }

        if (debouncedSearchTerm) params.search = debouncedSearchTerm
        if (filterType) params.product_type = mapProductTypeToApi(filterType)
        if (filterCategory) params.category = filterCategory

        // FIX: filterActive is coming from <select> as "true"/"false"/"" (strings).
        // Many APIs expect boolean, so convert.
        if (filterActive !== '') params.is_active = filterActive === 'true'

        const response = await productsAPI.getAll(params)
        const items = response.data.items || response.data || []
        const total = response.data.total ?? items.length

        setProducts(items)
        setTotalItems(total)
      } catch (error) {
        showAlert(
          'Error loading products: ' + (error.response?.data?.detail || error.message),
          'error'
        )
      } finally {
        setLoading(false)
      }
    },
    [
      debouncedSearchTerm,
      filterType,
      filterCategory,
      filterActive,
      itemsPerPage,
      mapProductTypeToApi,
      showAlert,
    ]
  )

  useEffect(() => {
    loadProducts()
    // NOTE: if you want strict hook correctness, add loadProducts to deps.
    // Here you intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const loadAllProducts = async () => {
      try {
        const response = await productsAPI.getAll({ limit: 1000 })
        const productList = Array.isArray(response.data)
          ? response.data
          : response.data.items || []
        setAllProducts(productList)
      } catch (error) {
        console.error('Error loading all products:', error)
      }
    }
    loadAllProducts()
  }, [])

  const loadInventorySnapshot = useCallback(async () => {
    try {
      const response = await inventoryAPI.getItems({ limit: 1000 })
      const itemList = response.data.items || response.data || []

      const grouped = itemList.reduce((acc, item) => {
        const productId = item.product_id
        if (!acc[productId]) acc[productId] = []
        acc[productId].push(item)
        return acc
      }, {})

      setInventoryByProduct(grouped)
    } catch (error) {
      console.error('Error loading inventory snapshot:', error)
    }
  }, [])

  useEffect(() => {
    loadInventorySnapshot()
  }, [loadInventorySnapshot])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterType, filterCategory, filterActive])

  useEffect(() => {
    const shouldSkipLoading =
      currentPage === 1 &&
      (debouncedSearchTerm || filterType || filterCategory || filterActive !== '')

    loadProducts(currentPage, shouldSkipLoading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm, filterType, filterCategory, filterActive])

  const refreshTable = useCallback(() => {
    loadProducts(currentPage, true)
    loadInventorySnapshot()
  }, [loadProducts, currentPage, loadInventorySnapshot])

  const normalizeListValue = (value) => value.trim()

  const handleAddCategory = () => {
    const cleaned = normalizeListValue(newCategoryName)
    if (!cleaned) return showAlert('Category name cannot be empty', 'error')
    if (categoryOptions.includes(cleaned)) return showAlert('Category already exists', 'error')
    setCategoryOptions([...categoryOptions, cleaned].sort())
    setNewCategoryName('')
    showAlert('Category added')
  }

  const handleRemoveCategory = (category) => {
    setCategoryOptions(categoryOptions.filter((item) => item !== category))
  }

  const handleAddUnit = () => {
    const cleaned = normalizeListValue(newUnitName)
    if (!cleaned) return showAlert('Unit name cannot be empty', 'error')
    if (unitOptions.includes(cleaned)) return showAlert('Unit already exists', 'error')
    setUnitOptions([...unitOptions, cleaned].sort())
    setNewUnitName('')
    showAlert('Unit added')
  }

  const handleRemoveUnit = (unit) => {
    setUnitOptions(unitOptions.filter((item) => item !== unit))
  }

  const handleAddCurrency = () => {
    const cleaned = normalizeListValue(newCurrencyName)
    if (!cleaned) return showAlert('Currency code cannot be empty', 'error')
    if (currencyOptions.includes(cleaned)) return showAlert('Currency already exists', 'error')
    setCurrencyOptions([...currencyOptions, cleaned].sort())
    setNewCurrencyName('')
    showAlert('Currency added')
  }

  const handleRemoveCurrency = (currency) => {
    setCurrencyOptions(currencyOptions.filter((item) => item !== currency))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      let productId
      const payload = {
        ...formData,
        product_type: mapProductTypeToApi(formData.product_type),
      }

      if (editingProduct) {
        await productsAPI.update(editingProduct.id, payload)
        productId = editingProduct.id
        showAlert('Product updated successfully!')
      } else {
        const created = await productsAPI.create(payload)
        productId = created.data.id
        showAlert('Product created successfully! SKU auto-generated.')
      }

      if (formIngredients.length > 0 && productId) {
        for (const ing of formIngredients) {
          if (!ing.ingredient_id) continue
          await productsAPI.addIngredient(productId, {
            ingredient_id: ing.ingredient_id,
            quantity: ing.quantity || 1,
          })
        }
      }

      resetForm()
      loadProducts(currentPage, true)
    } catch (error) {
      showAlert(
        'Error saving product: ' + (error.response?.data?.detail || error.message),
        'error'
      )
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
    newIngredients[index][field] =
      field === 'ingredient_id' ? parseInt(value, 10) : parseFloat(value) || 1
    setFormIngredients(newIngredients)
  }

  useEffect(() => {
    const loadCustomLists = async () => {
      const storedCategories = localStorage.getItem('products.categoryOptions')
      if (storedCategories) {
        setCategoryOptions(JSON.parse(storedCategories))
      } else {
        try {
          const response = await productsAPI.getCategories()
          setCategoryOptions(response.data || [])
        } catch (error) {
          console.error('Error loading categories:', error)
          setCategoryOptions([])
        }
      }

      const storedUnits = localStorage.getItem('products.unitOptions')
      if (storedUnits) setUnitOptions(JSON.parse(storedUnits))
      else setUnitOptions(['pcs', 'kg', 'm', 'm2', 'm3'])

      const storedCurrencies = localStorage.getItem('products.currencyOptions')
      if (storedCurrencies) setCurrencyOptions(JSON.parse(storedCurrencies))
      else setCurrencyOptions(['USD'])
    }

    loadCustomLists()
  }, [])

  useEffect(() => {
    localStorage.setItem('products.categoryOptions', JSON.stringify(categoryOptions))
  }, [categoryOptions])

  useEffect(() => {
    localStorage.setItem('products.unitOptions', JSON.stringify(unitOptions))
  }, [unitOptions])

  useEffect(() => {
    localStorage.setItem('products.currencyOptions', JSON.stringify(currencyOptions))
  }, [currencyOptions])

  useEffect(() => {
    if (!formData.unit_of_measure && unitOptions.length > 0) {
      setFormData((prev) => ({ ...prev, unit_of_measure: unitOptions[0] }))
    }
  }, [formData.unit_of_measure, unitOptions])

  useEffect(() => {
    if (!formData.currency && currencyOptions.length > 0) {
      setFormData((prev) => ({ ...prev, currency: currencyOptions[0] }))
    }
  }, [formData.currency, currencyOptions])

  useEffect(() => {
    if (!formData.category && categoryOptions.length > 0) {
      setFormData((prev) => ({ ...prev, category: categoryOptions[0] }))
    }
  }, [formData.category, categoryOptions])

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      unit_of_measure: product.unit_of_measure || unitOptions[0] || 'pcs',
      category: categoryOptions.includes(product.category)
        ? product.category
        : categoryOptions[0] || '',
      currency: product.currency || currencyOptions[0] || 'USD',
      product_type: normalizeProductType(product.product_type),
      base_price: product.base_price,
      cost: product.cost,
      is_active: product.is_active,
      is_tracked: product.is_tracked,
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return
    try {
      await productsAPI.delete(id)
      showAlert('Product deleted successfully')
      loadProducts()
    } catch (error) {
      showAlert('Error deleting product: ' + error.message, 'error')
    }
  }

  const loadLinkedDetails = async (product) => {
    setDetailsLoading(true)
    try {
      const salesOrdersResponse = await productsAPI.getSalesOrders(product.id)
      setLinkedSalesOrders(salesOrdersResponse.data || [])

      const purchaseOrdersResponse = await purchasingAPI.getAll({ limit: 200 })
      const purchaseOrders =
        purchaseOrdersResponse.data.items || purchaseOrdersResponse.data || []
      const linkedPOs = purchaseOrders.filter((order) =>
        order.items?.some((item) => item.product_id === product.id)
      )
      setLinkedPurchaseOrders(linkedPOs)

      const emplacementsResponse = await inventoryAPI.getItems({
        product_id: product.id,
        limit: 200,
      })
      const emplacementItems =
        emplacementsResponse.data.items || emplacementsResponse.data || []
      setLinkedEmplacements(emplacementItems)

      const transferResponses = await Promise.all(
        emplacementItems.map((item) =>
          inventoryAPI.getMovements({
            inventory_item_id: item.id,
            movement_type: 'TRANSFER',
            limit: 1000,
          })
        )
      )

      const transfers = transferResponses.flatMap((response, index) => {
        const movements = response.data || []
        const emplacement = emplacementItems[index]
        return movements.map((movement) => ({
          ...movement,
          location: emplacement.location,
        }))
      })

      setLinkedTransfers(transfers)
    } catch (error) {
      showAlert('Error loading details: ' + error.message, 'error')
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleViewDetails = async (product) => {
    setSelectedProduct(product)
    setActiveDetailsTab(DETAILS_TABS[0])
    await loadLinkedDetails(product)
    setShowDetails(true)
  }

  const handleViewIngredients = async (product) => {
    setSelectedProduct(product)
    try {
      const response = await productsAPI.getIngredients(product.id)
      setIngredients(response.data || [])
      setShowIngredients(true)
    } catch (error) {
      showAlert('Error loading ingredients: ' + error.message, 'error')
    }
  }

  const handleAddIngredient = async (e) => {
    e.preventDefault()
    if (!selectedProduct || !ingredientForm.ingredient_id) {
      showAlert('Please select an ingredient', 'error')
      return
    }

    try {
      await productsAPI.addIngredient(selectedProduct.id, {
        ingredient_id: ingredientForm.ingredient_id,
        quantity: ingredientForm.quantity || 1,
      })
      showAlert('Ingredient added successfully!')
      await handleViewIngredients(selectedProduct)
    } catch (error) {
      showAlert('Error: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  const handleRemoveIngredient = async (ingredientId) => {
    if (!window.confirm('Remove this ingredient?')) return
    try {
      await productsAPI.removeIngredient(selectedProduct.id, ingredientId)
      showAlert('Ingredient removed')
      await handleViewIngredients(selectedProduct)
    } catch (error) {
      showAlert('Error removing ingredient: ' + error.message, 'error')
    }
  }

  const handleAddEmplacement = async (e) => {
    e.preventDefault()
    if (!selectedProduct) return showAlert('Select a product first', 'error')
    if (!emplacementForm.location.trim()) return showAlert('Location is required', 'error')

    try {
      await inventoryAPI.createItem({
        product_id: selectedProduct.id,
        location: emplacementForm.location.trim(),
        quantity_on_hand: emplacementForm.quantity_on_hand || 0,
        reorder_point: emplacementForm.reorder_point || 0,
        reorder_quantity: emplacementForm.reorder_quantity || 0,
      })

      showAlert('Emplacement added successfully!')

      setEmplacementForm({
        location: '',
        quantity_on_hand: 0,
        reorder_point: 0,
        reorder_quantity: 0,
      })

      await loadLinkedDetails(selectedProduct)
      loadInventorySnapshot()
    } catch (error) {
      showAlert(
        'Error adding emplacement: ' + (error.response?.data?.detail || error.message),
        'error'
      )
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      unit_of_measure: unitOptions[0] || 'pcs',
      category: categoryOptions[0] || '',
      currency: currencyOptions[0] || 'USD',
      product_type: 'Goods',
      base_price: 0,
      cost: 0,
      is_active: true,
      is_tracked: true,
    })
    setFormIngredients([])
    setEditingProduct(null)
    setShowForm(false)
  }

  // FIX: Your original code broke right here:
  // - useMemo call was not closed properly
  // - the dependency array + closing parenthesis were missing
  // - then random code appeared inside the dependencies (syntax error)
  const subAssemblyProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const type = normalizeProductType(p.product_type)
      return type === 'Goods' || type === 'Services' || type === 'Both'
    })
  }, [allProducts, normalizeProductType])

  // --------------------------------------------
  // ✅ JSX RENDER (your snippet was missing/garbled here)
  // --------------------------------------------
  return (
    <div className="page-container">
      <PageHelpCorner />

      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <h1>Products</h1>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {canCreate && (
              <button
                className="btn btn-primary"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? 'Cancel' : 'Add Product'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FIX: In your snippet you had raw block comments like:
          /* ========================= ... ========================= *\/
          That is INVALID inside JSX. JSX comments must be wrapped like this: {/**\/} */}
      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        {MAIN_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === tab ? 'var(--green-500)' : 'var(--brown-700)',
              color: activeTab === tab ? 'var(--brown-900)' : 'var(--brown-200)',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              marginRight: '2px',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* =========================
          PRODUCTS TAB
          ========================= */}
      {activeTab === 'Products' && (
        <>
          {/* Search + Filters */}
          <div className="search-bar" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 2, minWidth: 250 }}
            />

            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              <option value="Goods">Goods</option>
              <option value="Services">Services</option>
              <option value="Both">Both</option>
            </select>

            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            {(searchTerm || filterType || filterCategory || filterActive) && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSearchTerm('')
                  setFilterType('')
                  setFilterCategory('')
                  setFilterActive('')
                }}
              >
                Clear Filters
              </button>
            )}

            {/* FIX: Your snippet had "Refresh Table" text floating in the middle of JSX
                because tags were not closed above. Here it's a proper button. */}
            <button className="btn btn-secondary" onClick={refreshTable} disabled={loading}>
              Refresh Table
            </button>
          </div>

          {/* Create/Edit form (minimal skeleton so JSX compiles) */}
          {showForm && (
            <form onSubmit={handleSubmit} className="card" style={{ marginTop: '1rem' }}>
              <h2>{editingProduct ? 'Edit Product' : 'Create Product'}</h2>

              <div className="form-row">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Unit of Measure</label>
                  <select
                    value={formData.unit_of_measure}
                    onChange={(e) => setFormData((p) => ({ ...p, unit_of_measure: e.target.value }))}
                  >
                    <option value="">Select unit...</option>
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  >
                    <option value="">Select category...</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={formData.product_type}
                    onChange={(e) => setFormData((p) => ({ ...p, product_type: e.target.value }))}
                  >
                    <option value="">Select type...</option>
                    <option value="Goods">Goods</option>
                    <option value="Services">Services</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Base Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.base_price}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, base_price: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, cost: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))}
                  >
                    <option value="">Select currency...</option>
                    {currencyOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
                    />{' '}
                    Active
                  </label>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_tracked}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, is_tracked: e.target.checked }))
                      }
                    />{' '}
                    Tracked
                  </label>
                </div>
              </div>

              {/* Ingredients rows (optional) */}
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <h3>Ingredients</h3>
                  <button type="button" className="btn btn-secondary" onClick={handleAddFormIngredient}>
                    + Add Ingredient Row
                  </button>
                </div>

                {formIngredients.map((row, idx) => (
                  <div key={idx} className="form-row" style={{ alignItems: 'center' }}>
                    <div className="form-group">
                      <label>Ingredient</label>
                      <select
                        value={row.ingredient_id}
                        onChange={(e) => handleFormIngredientChange(idx, 'ingredient_id', e.target.value)}
                      >
                        <option value="">Select…</option>
                        {subAssemblyProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) => handleFormIngredientChange(idx, 'quantity', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>&nbsp;</label>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleRemoveFormIngredient(idx)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-success">
                  Save
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Table */}
          {!loading && products.length === 0 ? (
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
                    render: (value) => normalizeProductType(value),
                  },
                  { key: 'category', label: 'Category', render: (value) => value || '-' },
                  { key: 'unit_of_measure', label: 'Unit' },
                  { key: 'currency', label: 'Currency', render: (value) => value || '-' },
                  {
                    key: 'emplacements',
                    label: 'Emplacements',
                    sortable: false,
                    render: (_, row) => {
                      const emplacements = inventoryByProduct[row.id] || []
                      const locations = emplacements.map((item) => item.location).join(', ')
                      return locations || '-'
                    },
                  },
                  {
                    key: 'base_price',
                    label: 'Price',
                    render: (value, row) =>
                      `${row.currency ? row.currency + ' ' : ''}${parseFloat(value || 0).toFixed(2)}`,
                  },
                  {
                    key: 'cost',
                    label: 'Cost',
                    render: (value, row) =>
                      `${row.currency ? row.currency + ' ' : ''}${parseFloat(value || 0).toFixed(2)}`,
                  },
                  {
                    key: 'is_active',
                    label: 'Status',
                    render: (value) => (value ? 'Active' : 'Inactive'),
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    sortable: false,
                    render: (_, row) => (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-info"
                          onClick={() => handleViewIngredients(row)}
                          title="View Ingredients"
                        >
                          Ingredients
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleViewDetails(row)}
                          title="View Details"
                        >
                          Details
                        </button>

                        {canUpdate && (
                          <button
                            type="button"
                            className="btn btn-warning"
                            onClick={() => handleEdit(row)}
                            title="Edit"
                          >
                            Edit
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleDelete(row.id)}
                            title="Delete"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ),
                  },
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
        </>
      )}

      {/* =========================
          DETAILS MODAL
          ========================= */}
      {showDetails && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Product Details: {selectedProduct.name}</h2>

              {/* FIX: Your original close button was okay, but in Ingredients modal it was empty.
                  Always put content inside the button so it is visible/clickable. */}
              <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>
                ✕
              </button>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <p><strong>SKU:</strong> {selectedProduct.sku}</p>
              <p><strong>Type:</strong> {normalizeProductType(selectedProduct.product_type)}</p>
              <p><strong>Category:</strong> {selectedProduct.category || 'N/A'}</p>
              <p><strong>Unit:</strong> {selectedProduct.unit_of_measure || 'N/A'}</p>
              <p><strong>Currency:</strong> {selectedProduct.currency || 'N/A'}</p>
            </div>

            <div className="tabs-container" style={{ marginTop: '1rem' }}>
              {DETAILS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDetailsTab(tab)}
                  className={`tab-button ${activeDetailsTab === tab ? 'active' : ''}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {detailsLoading && <p>Loading linked data...</p>}

            {!detailsLoading && activeDetailsTab === 'SO' && (
              <>
                <h3>Linked Sales Orders ({linkedSalesOrders.length})</h3>
                {linkedSalesOrders.length === 0 ? (
                  <p>No sales orders found for this product.</p>
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
                      {linkedSalesOrders.map((order) => {
                        const item = order.items?.find((i) => i.product_id === selectedProduct.id)
                        if (!item) return null
                        return (
                          <tr key={order.id}>
                            <td>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowDetails(false)
                                  navigate(`/sales-orders?orderId=${order.id}`)
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                }}
                              >
                                {order.order_number}
                              </button>
                            </td>
                            <td>{order.customer_name}</td>
                            <td>{order.status}</td>
                            <td>{item.quantity}</td>
                            <td>{Number(order.grand_total || 0).toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {!detailsLoading && activeDetailsTab === 'PO' && (
              <>
                <h3>Linked Purchase Orders ({linkedPurchaseOrders.length})</h3>
                {linkedPurchaseOrders.length === 0 ? (
                  <p>No purchase orders found for this product.</p>
                ) : (
                  <table style={{ marginTop: '1rem' }}>
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Supplier</th>
                        <th>Status</th>
                        <th>Quantity</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedPurchaseOrders.map((order) => {
                        const item = order.items?.find((i) => i.product_id === selectedProduct.id)
                        if (!item) return null
                        return (
                          <tr key={order.id}>
                            <td>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowDetails(false)
                                  navigate(`/purchasing?poId=${order.id}`)
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                }}
                              >
                                {order.po_number}
                              </button>
                            </td>
                            <td>{order.supplier?.company_name || '-'}</td>
                            <td>{order.status || '-'}</td>
                            <td>{item.quantity}</td>
                            <td>{Number(order.grand_total || 0).toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {!detailsLoading && activeDetailsTab === 'Emplacements' && (
              <>
                <h3>Emplacements ({linkedEmplacements.length})</h3>

                <form onSubmit={handleAddEmplacement} style={{ marginTop: '1rem' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Location *</label>
                      <input
                        type="text"
                        value={emplacementForm.location}
                        onChange={(e) =>
                          setEmplacementForm((p) => ({ ...p, location: e.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>On Hand</label>
                      <input
                        type="number"
                        step="0.01"
                        value={emplacementForm.quantity_on_hand}
                        onChange={(e) =>
                          setEmplacementForm((p) => ({
                            ...p,
                            quantity_on_hand: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>Reorder Point</label>
                      <input
                        type="number"
                        step="0.01"
                        value={emplacementForm.reorder_point}
                        onChange={(e) =>
                          setEmplacementForm((p) => ({
                            ...p,
                            reorder_point: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>Reorder Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        value={emplacementForm.reorder_quantity}
                        onChange={(e) =>
                          setEmplacementForm((p) => ({
                            ...p,
                            reorder_quantity: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>&nbsp;</label>
                      <button type="submit" className="btn btn-success" style={{ width: '100%' }}>
                        + Add
                      </button>
                    </div>
                  </div>
                </form>

                {linkedEmplacements.length === 0 ? (
                  <p>No emplacements for this product yet.</p>
                ) : (
                  <table style={{ marginTop: '1rem' }}>
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>On Hand</th>
                        <th>Reorder Point</th>
                        <th>Reorder Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedEmplacements.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                setShowDetails(false)
                                navigate(`/inventory?itemId=${item.id}`)
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                              }}
                            >
                              {item.location}
                            </button>
                          </td>
                          <td>{item.quantity_on_hand}</td>
                          <td>{item.reorder_point}</td>
                          <td>{item.reorder_quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {!detailsLoading && activeDetailsTab === 'Transfers' && (
              <>
                <h3>Transfer History ({linkedTransfers.length})</h3>
                {linkedTransfers.length === 0 ? (
                  <p>No transfer movements found.</p>
                ) : (
                  <table style={{ marginTop: '1rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>From Location</th>
                        <th>Qty</th>
                        <th>Reference</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedTransfers.map((movement) => (
                        <tr key={movement.id}>
                          <td>{new Date(movement.created_at).toLocaleDateString()}</td>
                          <td>{movement.location}</td>
                          <td>{movement.quantity}</td>
                          <td>
                            {movement.reference_type || '-'} {movement.reference_id || ''}
                          </td>
                          <td>{movement.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================
          INGREDIENTS MODAL
          ========================= */}
      {showIngredients && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowIngredients(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Ingredients / Materials: {selectedProduct.name}</h2>

              {/* FIX: In your snippet the close button had NO CONTENT and broken formatting.
                  An empty <button> renders tiny and confusing. */}
              <button className="btn btn-secondary" onClick={() => setShowIngredients(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddIngredient} style={{ marginTop: '1rem' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Select Material / Ingredient</label>

                  {/* FIX: Your snippet cut off mid onChange and broke the JSX tree.
                      This is a complete, valid select. */}
                  <select
                    value={ingredientForm.ingredient_id}
                    onChange={(e) =>
                      setIngredientForm((p) => ({
                        ...p,
                        ingredient_id: parseInt(e.target.value, 10) || '',
                      }))
                    }
                  >
                    <option value="">Select…</option>
                    {subAssemblyProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingredientForm.quantity}
                    onChange={(e) =>
                      setIngredientForm((p) => ({
                        ...p,
                        quantity: parseFloat(e.target.value) || 1,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>&nbsp;</label>
                  <button type="submit" className="btn btn-success" style={{ width: '100%' }}>
                    + Add
                  </button>
                </div>
              </div>
            </form>

            <div style={{ marginTop: '1rem' }}>
              {ingredients.length === 0 ? (
                <p>No ingredients linked yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Qty</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((ing) => (
                      <tr key={ing.ingredient_id}>
                        <td>{ing.ingredient_name || ing.ingredient_id}</td>
                        <td>{ing.quantity}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleRemoveIngredient(ing.ingredient_id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================
          CATEGORIES TAB
          ========================= */}
      {activeTab === 'Categories' && (
        <div className="card">
          <h2>Product Categories</h2>
          <p style={{ opacity: 0.85 }}>
            Add/remove the categories you want to see in the Products form.
          </p>

          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>New Category</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Raw Material"
              />
            </div>
            <div className="form-group">
              <label>&nbsp;</label>
              <button type="button" className="btn btn-success" onClick={handleAddCategory}>
                Add Category
              </button>
            </div>
          </div>

          {categoryOptions.length === 0 ? (
            <p>No categories yet.</p>
          ) : (
            <ul style={{ marginTop: '1rem' }}>
              {categoryOptions.map((cat) => (
                <li
                  key={cat}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span>{cat}</span>
                  <button className="btn btn-danger" onClick={() => handleRemoveCategory(cat)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* =========================
          UNITS TAB
          ========================= */}
      {activeTab === 'Units' && (
        <div className="card">
          <h2>Units of Measure</h2>
          <p style={{ opacity: 0.85 }}>Manage the unit list used in the Products form.</p>

          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>New Unit</label>
              <input
                type="text"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="e.g. m2, box, pallet"
              />
            </div>
            <div className="form-group">
              <label>&nbsp;</label>
              <button type="button" className="btn btn-success" onClick={handleAddUnit}>
                Add Unit
              </button>
            </div>
          </div>

          {unitOptions.length === 0 ? (
            <p>No units yet.</p>
          ) : (
            <ul style={{ marginTop: '1rem' }}>
              {unitOptions.map((unit) => (
                <li
                  key={unit}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span>{unit}</span>
                  <button className="btn btn-danger" onClick={() => handleRemoveUnit(unit)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* =========================
          CURRENCIES TAB
          ========================= */}
      {activeTab === 'Currencies' && (
        <div className="card">
          <h2>Currencies</h2>
          <p style={{ opacity: 0.85 }}>These currencies will appear in the Products form select menu.</p>

          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>New Currency</label>
              <input
                type="text"
                value={newCurrencyName}
                onChange={(e) => setNewCurrencyName(e.target.value)}
                placeholder="e.g. USD, EUR"
              />
            </div>
            <div className="form-group">
              <label>&nbsp;</label>
              <button type="button" className="btn btn-success" onClick={handleAddCurrency}>
                Add Currency
              </button>
            </div>
          </div>

          {currencyOptions.length === 0 ? (
            <p>No currencies yet.</p>
          ) : (
            <ul style={{ marginTop: '1rem' }}>
              {currencyOptions.map((currency) => (
                <li
                  key={currency}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span>{currency}</span>
                  <button className="btn btn-danger" onClick={() => handleRemoveCurrency(currency)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default Products
