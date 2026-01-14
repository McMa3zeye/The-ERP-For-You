/***************************************************************************************************
 * Products.jsx
 *
 * You asked for **the exact same JSX** but with **everything explained inside comments** —
 * line-by-line, extremely beginner-friendly, like you’re learning your first words.
 *
 * ⚠️ Note:
 * - This file is written in **JavaScript + React** (NOT Java).
 * - JavaScript (JS) runs in the browser. Java is a different language (often server apps / Android).
 * - React is a JS library that helps you build user interfaces (screens/pages) by composing components.
 **************************************************************************************************/

/***************************************************************************************************
 * ✅ IMPORTS (a.k.a. "bring tools from other files/libraries into this file")
 *
 * In JavaScript, `import ... from '...'` means:
 * “Go to that library/file, grab something it exports, and let me use it here.”
 *
 * Think of it like:
 * - You have a toolbox in another room.
 * - `import` means you walk there and bring specific tools back.
 **************************************************************************************************/

/**
 * `react` is a library that helps us build UI (User Interface).
 *
 * React works with the idea of:
 * - "Components" = reusable pieces of UI (like LEGO pieces).
 * - "State" = data that can change over time (like text typed in a search bar).
 * - "Hooks" = special functions React gives you to manage state/life-cycle logic.
 *
 * Here we import 4 React Hooks:
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
/**
 * useState:
 * - Gives the component "memory".
 * - Example: `const [count, setCount] = useState(0)`
 *   - `count` is the value
 *   - `setCount` is the function to change it
 * - When state changes, React re-renders (redraws) the component.
 *
 * useEffect:
 * - Lets you run code at certain moments:
 *   - When the component first appears on screen (mount)
 *   - When certain state values change
 *   - When the component disappears (unmount) to clean up
 *
 * useMemo:
 * - Caches (remembers) the result of a calculation so it doesn’t recompute every render.
 * - Useful when filtering big arrays, etc.
 *
 * useCallback:
 * - Caches (remembers) a function so it doesn’t get recreated every render.
 * - Useful when you pass functions to children components to avoid unnecessary re-renders.
 */

/**
 * This import is from your own project (local file).
 *
 * `../services/api` probably exports objects that know how to talk to the backend (FastAPI).
 * Think:
 * - productsAPI.getAll(...) makes an HTTP request like GET /api/products
 * - productsAPI.create(...) makes POST /api/products
 *
 * We import:
 * - productsAPI (we use it a lot)
 * - salesOrdersAPI (⚠️ in THIS snippet it’s imported but not used; could be for future features)
 */
import { productsAPI, salesOrdersAPI } from '../services/api'

/**
 * Pagination is a UI component:
 * - When you have many items, you show them page-by-page (page 1, page 2, page 3).
 * - This component likely renders the page buttons and calls `onPageChange(page)`.
 */
import Pagination from '../components/Pagination'

/**
 * PageHelpCorner likely shows a little help icon / tooltip in the corner.
 * It’s a “component” you can reuse on different pages.
 */
import PageHelpCorner from '../components/PageHelpCorner'

/**
 * SortableTable is a table component where columns can be clicked to sort.
 * Example:
 * - Sort by name A→Z
 * - Sort by price high→low
 */
import SortableTable from '../components/SortableTable'

/**
 * useDebounce is a custom hook from your project.
 *
 * “Debounce” means:
 * - Don’t run something immediately every time the user types.
 * - Wait a little (like 500ms).
 * - If they keep typing, keep waiting.
 *
 * Example:
 * - User types "wood"
 * - Instead of making 4 API calls (w, wo, woo, wood),
 *   you wait until user pauses typing, then call once.
 */
import { useDebounce } from '../hooks/useDebounce'

/**
 * These are chart-related components/utilities.
 * In this snippet, you use ChartImporter (for importing charts).
 * Some other imports (UnifiedChartBuilder / ChartWidget / exportChartData) are not used in this snippet,
 * but maybe you planned to use them or use them in another branch of UI.
 */
import UnifiedChartBuilder from '../components/UnifiedChartBuilder'
import ChartWidget from '../components/ChartWidget'
import ChartImporter from '../components/ChartImporter'
import { exportChartData } from '../utils/export'

/**
 * useAuth is a hook from your AuthContext.
 * It gives you authentication/authorization tools (like permissions).
 * Example:
 * - hasPermission('products.create') tells you if current user can create products.
 */
import { useAuth } from '../contexts/AuthContext'

/***************************************************************************************************
 * ✅ COMPONENT START
 *
 * In React, a "page" is often a component.
 * A component is basically a function that returns UI.
 *
 * `function Products() { ... }` defines a component named Products.
 * React will render it when user visits the Products page route.
 **************************************************************************************************/
function Products() {
  /*************************************************************************************************
   * AUTH / PERMISSIONS
   *************************************************************************************************/

  // We call useAuth() to get things from the AuthContext.
  // Context is like a global shared "store" of data (user info, permissions, etc.).
  const { hasPermission } = useAuth()

  // We compute permission flags:
  // canCreate is true if user has 'products.create'.
  // canUpdate is true if user has 'products.update'.
  // canDelete is true if user has 'products.delete'.
  const canCreate = hasPermission('products.create')
  const canUpdate = hasPermission('products.update')
  const canDelete = hasPermission('products.delete')

  /*************************************************************************************************
   * STATE (component memory)
   *
   * Every useState(...) returns:
   * - a value (example: products)
   * - a setter function (example: setProducts)
   *
   * When you call the setter, React rerenders the UI with new values.
   *************************************************************************************************/

  // products = the current page of products displayed in the table.
  // starts empty [].
  const [products, setProducts] = useState([])

  // allProducts = a big list used for ingredient selection dropdowns.
  // Why separate?
  // - Table loads page-by-page (faster)
  // - Ingredient dropdown needs many items to pick from.
  const [allProducts, setAllProducts] = useState([]) // For ingredient selection

  // loading = show spinner while data loads.
  const [loading, setLoading] = useState(true)

  // showForm controls whether the create/edit product form is visible.
  const [showForm, setShowForm] = useState(false)

  // showDetails controls whether the product details modal is open.
  const [showDetails, setShowDetails] = useState(false)

  // selectedProduct stores the product the user clicked on for details/ingredients.
  const [selectedProduct, setSelectedProduct] = useState(null)

  // linkedOrders holds sales orders connected to a product (for the details modal).
  const [linkedOrders, setLinkedOrders] = useState([])

  // showIngredients controls whether the ingredients modal is open.
  const [showIngredients, setShowIngredients] = useState(false)

  // ingredients holds the list of ingredient relationships for the selected product.
  const [ingredients, setIngredients] = useState([])

  // editingProduct holds the product being edited.
  // If null → we are creating a new product.
  const [editingProduct, setEditingProduct] = useState(null)

  // alert holds messages like “product created!” or “error loading”.
  // Example: { message: "...", type: "success" or "error" }
  const [alert, setAlert] = useState(null)

  // searchTerm is what the user types into the search box.
  const [searchTerm, setSearchTerm] = useState('')

  // debouncedSearchTerm is the delayed version of searchTerm.
  // It updates only after the user stops typing for 500ms.
  const debouncedSearchTerm = useDebounce(searchTerm, 500) // 500ms debounce

  // Filters for product list:
  const [filterType, setFilterType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterActive, setFilterActive] = useState('')

  // Pagination state:
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // itemsPerPage is a normal constant, not state (doesn’t need to trigger re-render).
  const itemsPerPage = 20

  // Ingredients chosen inside the creation form (before saving).
  // Example: wood plank x 2, glue x 0.1, etc.
  const [formIngredients, setFormIngredients] = useState([])

  // Chart builder UI state
  const [showChartBuilder, setShowChartBuilder] = useState(false)

  // savedCharts = charts saved in localStorage that are relevant to this Products page.
  const [savedCharts, setSavedCharts] = useState([])

  /*************************************************************************************************
   * LOAD SAVED CHARTS
   *
   * useEffect runs after render.
   * With [] as dependency, it runs once when the component mounts (first appears).
   *************************************************************************************************/
  useEffect(() => {
    // Helper function to load saved charts from localStorage.
    const loadSavedCharts = () => {
      // localStorage is the browser’s built-in “tiny database” stored on the user's computer.
      // It stores key/value strings.
      const saved = localStorage.getItem('savedCharts')

      // If something exists under that key:
      if (saved) {
        try {
          // JSON.parse converts a JSON string back into a JS array/object.
          const allCharts = JSON.parse(saved)

          // We only keep charts that belong to this page
          // or charts that are shared to this page.
          setSavedCharts(
            allCharts.filter(
              (c) =>
                c.postToPage === 'products' ||
                (c.sharedPages && c.sharedPages.includes('products'))
            )
          )
        } catch (e) {
          // If JSON.parse fails, it means savedCharts is corrupted or not valid JSON.
          console.error('Error loading saved charts:', e)
        }
      }
    }

    // Load charts immediately on mount.
    loadSavedCharts()

    // Listen to a custom event called 'chartsUpdated'
    // so if another part of the app updates charts, this page refreshes them.
    window.addEventListener('chartsUpdated', loadSavedCharts)

    // Cleanup function:
    // This runs when component unmounts (like leaving the page),
    // removing the event listener so we don’t leak memory.
    return () => window.removeEventListener('chartsUpdated', loadSavedCharts)
  }, [])

  /*************************************************************************************************
   * SAVE A CHART
   *************************************************************************************************/
  const handleSaveChart = (chartConfig) => {
    // Get existing charts from localStorage or default to [].
    const existing = JSON.parse(localStorage.getItem('savedCharts') || '[]')

    // Create a new array with the new chart added.
    const newCharts = [...existing, chartConfig]

    // Save updated list back to localStorage.
    localStorage.setItem('savedCharts', JSON.stringify(newCharts))

    // Fire an event so other components/pages listening can refresh.
    window.dispatchEvent(new Event('chartsUpdated'))
  }

  /*************************************************************************************************
   * FORM STATE
   *
   * formData = the inputs for product create/edit.
   *************************************************************************************************/
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

  /*************************************************************************************************
   * INGREDIENT FORM STATE (for the ingredients modal)
   *************************************************************************************************/
  const [ingredientForm, setIngredientForm] = useState({
    ingredient_id: '',
    quantity: 1,
  })

  /*************************************************************************************************
   * INITIAL LOAD OF PRODUCTS (first mount)
   *************************************************************************************************/
  useEffect(() => {
    // We load products when the component first appears.
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // This disables a lint rule that would ask you to add loadProducts as a dependency.
    // You intentionally want to run only once here.
  }, [])

  /*************************************************************************************************
   * loadProducts (main function to fetch products from backend)
   *
   * useCallback means: React will keep the same function identity unless dependencies change.
   * That helps avoid weird re-render loops in effects and child components.
   *************************************************************************************************/
  const loadProducts = useCallback(
    async (page = 1, skipLoading = false) => {
      try {
        // If we are NOT skipping loading, we show spinner.
        if (!skipLoading) setLoading(true)

        // Params = query parameters sent to backend.
        // skip/limit = pagination.
        const params = {
          skip: (page - 1) * itemsPerPage,
          limit: itemsPerPage,
        }

        // If the user typed something, include search param.
        if (debouncedSearchTerm) params.search = debouncedSearchTerm

        // Add filters if present.
        if (filterType) params.product_type = filterType
        if (filterCategory) params.category = filterCategory
        if (filterActive !== '') params.is_active = filterActive === 'true'

        // Call backend: productsAPI.getAll(params)
        // This likely does GET /api/products?skip=...&limit=...&search=...
        const response = await productsAPI.getAll(params)

        // You support 2 possible backend response shapes:
        //
        // 1) OLD: backend returns an array directly: [ {...}, {...} ]
        // 2) NEW: backend returns { items: [...], total: 123 }
        //
        // So you check:
        if (Array.isArray(response.data)) {
          // Old format
          setProducts(response.data)
          setTotalItems(response.data.length)
        } else {
          // New format
          setProducts(response.data.items || [])
          setTotalItems(response.data.total || 0)
        }
      } catch (error) {
        // If an error happens, show an alert.
        showAlert('Error loading products: ' + error.message, 'error')
      } finally {
        // finally runs whether success or error.
        if (!skipLoading) setLoading(false)
      }
    },
    // Dependencies: if any of these change, the function is recreated with new values.
    [debouncedSearchTerm, filterType, filterCategory, filterActive, itemsPerPage]
  )

  /*************************************************************************************************
   * Load ALL products for ingredient dropdown (once on mount)
   *************************************************************************************************/
  useEffect(() => {
    const loadAllProducts = async () => {
      try {
        // Get many products, so ingredient dropdown can show options.
        const response = await productsAPI.getAll({ limit: 1000 })

        // Same “old format vs new format” handling:
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

  /*************************************************************************************************
   * Reset to page 1 when filters/search change
   *************************************************************************************************/
  useEffect(() => {
    setCurrentPage(1)
    // We don't call loadProducts here because another effect below does it.
  }, [debouncedSearchTerm, filterType, filterCategory, filterActive])

  /*************************************************************************************************
   * Load products when page/filters change
   *************************************************************************************************/
  useEffect(() => {
    // If we are on page 1 and filters/search are active,
    // we refresh the table without showing the global spinner.
    const shouldSkipLoading =
      currentPage === 1 &&
      (debouncedSearchTerm || filterType || filterCategory || filterActive !== '')

    loadProducts(currentPage, shouldSkipLoading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm, filterType, filterCategory, filterActive])

  /*************************************************************************************************
   * Refresh table only (no global spinner)
   *************************************************************************************************/
  const refreshTable = useCallback(() => {
    loadProducts(currentPage, true) // true = skipLoading spinner
  }, [loadProducts, currentPage])

  /*************************************************************************************************
   * showAlert helper: shows message then hides after 4 seconds
   *************************************************************************************************/
  const showAlert = (message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 4000)
  }

  /*************************************************************************************************
   * handleSubmit: runs when the create/edit form is submitted
   *************************************************************************************************/
  const handleSubmit = async (e) => {
    // preventDefault prevents the browser from reloading the page on form submit
    e.preventDefault()

    try {
      let productId

      // If editingProduct exists, we update.
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, formData)
        productId = editingProduct.id
        showAlert('✅ Product updated successfully!')
      } else {
        // Otherwise, we create a new product.
        const created = await productsAPI.create(formData)
        productId = created.data.id
        showAlert('✅ Product created successfully! SKU auto-generated.')
      }

      // Add ingredients if user selected any during creation.
      if (formIngredients.length > 0 && productId) {
        for (const ing of formIngredients) {
          try {
            await productsAPI.addIngredient(productId, {
              ingredient_id: ing.ingredient_id,
              quantity: ing.quantity,
            })
          } catch (ingError) {
            console.error('Error adding ingredient:', ingError)
          }
        }

        // Clear ingredients after saving.
        setFormIngredients([])
        showAlert('✅ Product and ingredients saved!')
      }

      // Reset form UI
      resetForm()

      // Refresh table only
      refreshTable()
    } catch (error) {
      // Prefer backend detail message if it exists
      showAlert(
        '⚠️ Error: ' + (error.response?.data?.detail || error.message),
        'error'
      )
    }
  }

  /*************************************************************************************************
   * Add/remove ingredient rows inside the product creation form
   *************************************************************************************************/
  const handleAddFormIngredient = () => {
    // Add a new ingredient row with default values.
    setFormIngredients([...formIngredients, { ingredient_id: '', quantity: 1 }])
  }

  const handleRemoveFormIngredient = (index) => {
    // Remove ingredient row at that index.
    setFormIngredients(formIngredients.filter((_, i) => i !== index))
  }

  const handleFormIngredientChange = (index, field, value) => {
    const newIngredients = [...formIngredients]

    // Convert ingredient_id to integer, quantity to float.
    newIngredients[index][field] =
      field === 'ingredient_id' ? parseInt(value) : parseFloat(value) || 1

    setFormIngredients(newIngredients)
  }

  /*************************************************************************************************
   * Categories state + loader
   *************************************************************************************************/
  const [categories, setCategories] = useState([])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        // Try to load categories from backend
        const response = await productsAPI.getCategories()
        setCategories(response.data || [])
      } catch (error) {
        console.error('Error loading categories:', error)

        // Fallback:
        // Extract categories from products already loaded
        setCategories(
          [...new Set(products.map((p) => p.category).filter(Boolean))].sort()
        )
      }
    }
    loadCategories()
  }, []) // run once on mount

  /*************************************************************************************************
   * handleEdit: load a product into the form for editing
   *************************************************************************************************/
  const handleEdit = (product) => {
    setEditingProduct(product)

    // Fill form with product values
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

    // Open the form
    setShowForm(true)
  }

  /*************************************************************************************************
   * handleDelete: confirm then delete a product
   *************************************************************************************************/
  const handleDelete = async (id) => {
    if (!window.confirm('⚠️ Are you sure you want to delete this product?')) return

    try {
      await productsAPI.delete(id)
      showAlert('✅ Product deleted successfully')

      // reload products (this version calls loadProducts() default)
      loadProducts()
    } catch (error) {
      showAlert('⚠️ Error deleting product: ' + error.message, 'error')
    }
  }

  /*************************************************************************************************
   * handleViewDetails: open details modal + load linked sales orders
   *************************************************************************************************/
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

  /*************************************************************************************************
   * handleViewIngredients: open ingredients modal + load ingredient list
   *************************************************************************************************/
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

  /*************************************************************************************************
   * handleAddIngredient: add ingredient to selected product (modal)
   *************************************************************************************************/
  const handleAddIngredient = async (e) => {
    e.preventDefault()

    if (!selectedProduct || !ingredientForm.ingredient_id) {
      showAlert('⚠️ Please select an ingredient', 'error')
      return
    }

    try {
      await productsAPI.addIngredient(selectedProduct.id, ingredientForm)
      showAlert('✅ Ingredient added successfully!')

      // Reset ingredient form
      setIngredientForm({ ingredient_id: '', quantity: 1 })

      // Reload ingredient list
      handleViewIngredients(selectedProduct)
    } catch (error) {
      showAlert(
        '⚠️ Error: ' + (error.response?.data?.detail || error.message),
        'error'
      )
    }
  }

  /*************************************************************************************************
   * handleRemoveIngredient: remove ingredient relation (modal)
   *************************************************************************************************/
  const handleRemoveIngredient = async (ingredientId) => {
    if (!window.confirm('⚠️ Remove this ingredient?')) return

    try {
      await productsAPI.removeIngredient(selectedProduct.id, ingredientId)
      showAlert('✅ Ingredient removed')

      // Reload ingredient list
      handleViewIngredients(selectedProduct)
    } catch (error) {
      showAlert('⚠️ Error removing ingredient: ' + error.message, 'error')
    }
  }

  /*************************************************************************************************
   * resetForm: clear form inputs, exit edit mode, close form
   *************************************************************************************************/
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

  /*************************************************************************************************
   * subAssemblyProducts (memoized)
   *
   * Why useMemo here?
   * - Filtering allProducts happens every render otherwise.
   * - With useMemo, it only recalculates when allProducts changes.
   *************************************************************************************************/
  const subAssemblyProducts = useMemo(
    () =>
      allProducts.filter(
        (p) =>
          p.product_type === 'Sub-assembly' || p.product_type === 'Raw Material'
      ),
    [allProducts]
  )

  /*************************************************************************************************
   * LOADING UI
   *************************************************************************************************/
  if (loading) {
    return <div className="spinner"></div>
  }

  /*************************************************************************************************
   * MAIN RENDER (JSX)
   *
   * JSX is like HTML inside JavaScript.
   * React turns JSX into real DOM elements.
   *************************************************************************************************/
  return (
    <div className="page-container">
      {/* =========================
          PAGE HEADER
          ========================= */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>
          {/* Emoji + title */}
          📦 Products & Pricing
          {/* Help corner component */}
          <PageHelpCorner />
        </h1>

        {/* Buttons row */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-info" onClick={() => setShowChartBuilder(true)}>
            📊 Create Chart
          </button>

          {/* ChartImporter component: lets user import chart configurations */}
          <ChartImporter
            currentPage="products"
            onImport={() => {
              // When a chart is imported, reload the saved charts list from localStorage.
              const saved = localStorage.getItem('savedCharts')
              if (saved) {
                try {
                  const allCharts = JSON.parse(saved)
                  setSavedCharts(
                    allCharts.filter(
                      (c) =>
                        c.postToPage === 'products' ||
                        (c.sharedPages && c.sharedPages.includes('products'))
                    )
                  )
                } catch (e) {
                  console.error('Error reloading charts:', e)
                }
              }
            }}
          />

          {/* Only show the Add Product button if user has create permission */}
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {/* If form is showing, button becomes Cancel */}
              {showForm ? '❌ Cancel' : '➕ Add Product'}
            </button>
          )}
        </div>
      </div>

      {/* =========================
          ALERT MESSAGE (success/error)
          ========================= */}
      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      {/* =========================
          SEARCH + FILTERS
          ========================= */}
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
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">✅ Active</option>
          <option value="false">❌ Inactive</option>
        </select>

        {/* Clear filters button shows only if at least one filter/search is active */}
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
            🗑️ Clear Filters
          </button>
        )}
      </div>

      {/* =========================
          CREATE/EDIT FORM (conditional)
          ========================= */}
      {showForm && (
        <div className="card">
          <h2>{editingProduct ? '✏️ Edit Product' : '➕ New Product'}</h2>

          {/* Explanation of SKU pattern */}
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            💡 SKU will be auto-generated:{' '}
            {formData.product_type === 'Final'
              ? 'P-YYYY-####-####'
              : formData.product_type === 'Raw Material'
              ? 'R-YYYY-####-####'
              : 'M-YYYY-####-####'}
          </p>

          {/* When the form is submitted, handleSubmit runs */}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>📝 Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>🏷️ Product Type *</label>
                <select
                  value={formData.product_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      product_type: e.target.value,
                    })
                  }
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
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    description: e.target.value,
                  })
                }
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>📏 Unit of Measure</label>
                <select
                  value={formData.unit_of_measure}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unit_of_measure: e.target.value,
                    })
                  }
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
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value,
                    })
                  }
                  list="categories"
                />
                <datalist id="categories">
                  {categories.map((cat) => (
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
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      base_price: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>💵 Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_active: e.target.checked,
                      })
                    }
                  />
                  {' '}✅ Active
                </label>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_tracked}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_tracked: e.target.checked,
                      })
                    }
                  />
                  {' '}📊 Track Inventory
                </label>
              </div>
            </div>

            {/* Ingredients selection section: only if product type is Final */}
            {formData.product_type === 'Final' && (
              <div className="card" style={{ marginTop: '1.5rem', backgroundColor: 'rgba(45, 27, 14, 0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3>🔩 Ingredients/Materials</h3>
                  <button type="button" className="btn btn-success" onClick={handleAddFormIngredient}>
                    ➕ Add Material
                  </button>
                </div>

                <p style={{ color: 'var(--brown-200)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  💡 Add raw materials (wood, glue, etc.) or sub-assemblies as ingredients.
                  Only Sub-assembly or Raw Material products can be selected as ingredients.
                </p>

                {formIngredients.length > 0 &&
                  formIngredients.map((ing, index) => (
                    <div
                      key={index}
                      style={{
                        border: '1px solid var(--brown-500)',
                        padding: '1rem',
                        marginBottom: '1rem',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(45, 27, 14, 0.3)',
                      }}
                    >
                      <div className="form-row">
                        <div className="form-group">
                          <label>📦 Material/Ingredient *</label>
                          <select
                            value={ing.ingredient_id}
                            onChange={(e) =>
                              handleFormIngredientChange(index, 'ingredient_id', e.target.value)
                            }
                            required
                          >
                            <option value="">Select material...</option>
                            {subAssemblyProducts
                              .filter((p) => !editingProduct || p.id !== editingProduct.id)
                              .map((p) => (
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
                            onChange={(e) =>
                              handleFormIngredientChange(index, 'quantity', e.target.value)
                            }
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
                  <p
                    style={{
                      textAlign: 'center',
                      color: 'var(--brown-300)',
                      padding: '1rem',
                      fontStyle: 'italic',
                    }}
                  >
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

      {/* =========================
          DETAILS MODAL
          ========================= */}
      {showDetails && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>📋 Product Details: {selectedProduct.name}</h2>
              <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p><strong>SKU:</strong> {selectedProduct.sku}</p>
              <p>
                <strong>Type:</strong>{' '}
                {selectedProduct.product_type === 'Final'
                  ? '🪵 Final'
                  : selectedProduct.product_type === 'Sub-assembly'
                  ? '🔩 Sub-assembly'
                  : '🌲 Raw Material'}
              </p>
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
                  {linkedOrders.map((order) => {
                    const item = order.items.find((i) => i.product_id === selectedProduct.id)
                    return item ? (
                      <tr key={order.id}>
                        <td>{order.order_number}</td>
                        <td>{order.customer_name}</td>
                        <td>
                          <span className={`status-badge status-${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                            {order.status}
                          </span>
                        </td>
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

      {/* =========================
          INGREDIENTS MODAL
          ========================= */}
      {showIngredients && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowIngredients(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>🔩 Ingredients/Materials: {selectedProduct.name}</h2>
              <button className="btn btn-secondary" onClick={() => setShowIngredients(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddIngredient} style={{ marginBottom: '1.5rem' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Select Material/Ingredient</label>
                  <select
                    value={ingredientForm.ingredient_id}
                    onChange={(e) =>
                      setIngredientForm({
                        ...ingredientForm,
                        ingredient_id: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Choose material...</option>
                    {subAssemblyProducts
                      .filter((p) => p.id !== selectedProduct.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} - {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Quantity per Product</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingredientForm.quantity}
                    onChange={(e) =>
                      setIngredientForm({
                        ...ingredientForm,
                        quantity: parseFloat(e.target.value) || 1,
                      })
                    }
                    required
                    min="0.01"
                  />
                </div>

                <div className="form-group">
                  <label>&nbsp;</label>
                  <button type="submit" className="btn btn-success">
                    ➕ Add
                  </button>
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
                  {ingredients.map((ing) => (
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

      {/* =========================
          PRODUCTS TABLE CARD
          ========================= */}
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
                  },
                },
                { key: 'category', label: 'Category', render: (value) => value || '-' },
                { key: 'unit_of_measure', label: 'Unit' },
                {
                  key: 'base_price',
                  label: 'Price',
                  render: (value) => `$${parseFloat(value || 0).toFixed(2)}`,
                },
                {
                  key: 'cost',
                  label: 'Cost',
                  render: (value) => `$${parseFloat(value || 0).toFixed(2)}`,
                },
                {
                  key: 'is_active',
                  label: 'Status',
                  render: (value) => (
                    <span style={{ color: value ? 'var(--green-300)' : 'var(--brown-300)' }}>
                      {value ? '✅ Active' : '❌ Inactive'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  sortable: false,
                  render: (_, row) => (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-info"
                        onClick={() => handleViewIngredients(row)}
                        title="View Ingredients"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                      >
                        🔩
                      </button>

                      <button
                        className="btn btn-info"
                        onClick={() => handleViewDetails(row)}
                        title="View Details"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                      >
                        📋
                      </button>

                      {canUpdate && (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleEdit(row)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        >
                          ✏️
                        </button>
                      )}

                      {canDelete && (
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(row.id)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        >
                          🗑️
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
      </div>
    </div>
  )
}

/***************************************************************************************************
 * EXPORT DEFAULT
 *
 * `export default Products` means:
 * - When another file imports this file, it can do:
 *   import Products from './Products'
 *
 * This is how your router can render this page component.
 **************************************************************************************************/
export default Products
