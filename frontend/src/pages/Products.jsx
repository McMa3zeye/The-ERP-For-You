/* - React is a JS library that helps you build user interfaces (screens/pages) by composing components.
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
import { useNavigate } from 'react-router-dom'
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
 * - inventoryAPI (for emplacements + transfer history)
 * - purchasingAPI (for linked Purchase Orders)
 */
import { productsAPI, inventoryAPI, purchasingAPI } from '../services/api'

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
@@ -102,137 +104,204 @@ import SortableTable from '../components/SortableTable'
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

/**
 * useNavigate comes from React Router.
 * It lets us “go to another page” using JavaScript (no full page reload).
 * We’ll use it to jump from a product’s detail modal → PO / SO / Inventory pages.
 */
// (✅ This import is already above; this comment explains why we need it.)

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

  // useNavigate gives us a function so we can move to another page programmatically.
  // Example: navigate('/purchasing?poId=123') will open the Purchasing page.
  const navigate = useNavigate()

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

  // inventoryByProduct lets us show "Emplacements" in the main table.
  // Shape: { [productId]: [{ id, location, quantity_on_hand, ... }, ...] }
  const [inventoryByProduct, setInventoryByProduct] = useState({})

  // loading = show spinner while data loads.
  const [loading, setLoading] = useState(true)

  // showForm controls whether the create/edit product form is visible.
  const [showForm, setShowForm] = useState(false)

  // showDetails controls whether the product details modal is open.
  const [showDetails, setShowDetails] = useState(false)

  // selectedProduct stores the product the user clicked on for details/ingredients.
  const [selectedProduct, setSelectedProduct] = useState(null)

  // linkedSalesOrders holds sales orders connected to a product (for the details modal).
  const [linkedSalesOrders, setLinkedSalesOrders] = useState([])

  // linkedPurchaseOrders holds purchase orders connected to a product.
  const [linkedPurchaseOrders, setLinkedPurchaseOrders] = useState([])

  // linkedEmplacements holds inventory items (locations) for a product.
  const [linkedEmplacements, setLinkedEmplacements] = useState([])

  // linkedTransfers holds inventory movements of type TRANSFER for a product.
  const [linkedTransfers, setLinkedTransfers] = useState([])

  // detailsLoading lets us show a mini spinner while the modal loads linked data.
  const [detailsLoading, setDetailsLoading] = useState(false)

  // Which sub-tab is selected inside the details modal.
  const DETAILS_TABS = ['SO', 'PO', 'Emplacements', 'Transfers']
  const [activeDetailsTab, setActiveDetailsTab] = useState(DETAILS_TABS[0])

  // Emplacement form lets you add multiple locations for the same product.
  const [emplacementForm, setEmplacementForm] = useState({
    location: '',
    quantity_on_hand: 0,
    reorder_point: 0,
    reorder_quantity: 0,
  })

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

  const normalizeProductType = useCallback((value) => {
    if (!value) return 'Goods'
    if (value === 'Final') return 'Goods'
    if (value === 'Sub-assembly') return 'Services'
    if (value === 'Raw Material') return 'Both'
    return value
  }, [])

  /*************************************************************************************************
   * TAB STATE (for the "Products / Categories / Units / Currencies" layout)
   *************************************************************************************************/

  // These are the main tabs you asked for (similar to Admin page tabs).
  const MAIN_TABS = ['Products', 'Categories', 'Units', 'Currencies']

  // activeTab decides which tab content we show.
  const [activeTab, setActiveTab] = useState(MAIN_TABS[0])

  /*************************************************************************************************
   * CUSTOM LISTS (categories, units, currencies)
   *
   * We keep these lists in localStorage so YOU control the options.
   * - Category tab controls "categoryOptions"
   * - Unit tab controls "unitOptions"
   * - Currency tab controls "currencyOptions"
   *************************************************************************************************/

  const [categoryOptions, setCategoryOptions] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [currencyOptions, setCurrencyOptions] = useState([])

  // Inputs for adding new items inside each tab.
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newUnitName, setNewUnitName] = useState('')
  const [newCurrencyName, setNewCurrencyName] = useState('')

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
@@ -281,50 +350,51 @@ function Products() {
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
    currency: 'USD',
    product_type: 'Goods',
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
@@ -387,87 +457,176 @@ function Products() {
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
   * Load inventory items once so we can show "Emplacements" in the main table.
   *************************************************************************************************/
  const loadInventorySnapshot = useCallback(async () => {
    try {
      const response = await inventoryAPI.getItems({ limit: 1000 })
      const itemList = response.data.items || response.data || []

      // Build a map of productId -> list of inventory items
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
    loadInventorySnapshot()
  }, [loadProducts, currentPage, loadInventorySnapshot])

  /*************************************************************************************************
   * showAlert helper: shows message then hides after 4 seconds
   *************************************************************************************************/
  const showAlert = (message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 4000)
  }

  /*************************************************************************************************
   * CUSTOM LIST HELPERS (Categories / Units / Currencies)
   *************************************************************************************************/
  const normalizeListValue = (value) => value.trim()

  const handleAddCategory = () => {
    const cleaned = normalizeListValue(newCategoryName)
    if (!cleaned) {
      showAlert('⚠️ Category name cannot be empty', 'error')
      return
    }
    if (categoryOptions.includes(cleaned)) {
      showAlert('⚠️ Category already exists', 'error')
      return
    }
    setCategoryOptions([...categoryOptions, cleaned].sort())
    setNewCategoryName('')
    showAlert('✅ Category added')
  }

  const handleRemoveCategory = (category) => {
    setCategoryOptions(categoryOptions.filter((item) => item !== category))
  }

  const handleAddUnit = () => {
    const cleaned = normalizeListValue(newUnitName)
    if (!cleaned) {
      showAlert('⚠️ Unit name cannot be empty', 'error')
      return
    }
    if (unitOptions.includes(cleaned)) {
      showAlert('⚠️ Unit already exists', 'error')
      return
    }
    setUnitOptions([...unitOptions, cleaned].sort())
    setNewUnitName('')
    showAlert('✅ Unit added')
  }

  const handleRemoveUnit = (unit) => {
    setUnitOptions(unitOptions.filter((item) => item !== unit))
  }

  const handleAddCurrency = () => {
    const cleaned = normalizeListValue(newCurrencyName)
    if (!cleaned) {
      showAlert('⚠️ Currency code cannot be empty', 'error')
      return
    }
    if (currencyOptions.includes(cleaned)) {
      showAlert('⚠️ Currency already exists', 'error')
      return
    }
    setCurrencyOptions([...currencyOptions, cleaned].sort())
    setNewCurrencyName('')
    showAlert('✅ Currency added')
  }

  const handleRemoveCurrency = (currency) => {
    setCurrencyOptions(currencyOptions.filter((item) => item !== currency))
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
@@ -502,128 +661,228 @@ function Products() {

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
   * CUSTOM LIST LOADERS (localStorage-backed)
   *
   * We load the user-defined lists once on mount:
   * - categories
   * - units
   * - currencies
   *************************************************************************************************/
  useEffect(() => {
    const loadCustomLists = async () => {
      // 1) Categories: try localStorage first, else fallback to backend categories
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

      // 2) Units: use localStorage or a sane default list
      const storedUnits = localStorage.getItem('products.unitOptions')
      if (storedUnits) {
        setUnitOptions(JSON.parse(storedUnits))
      } else {
        setUnitOptions(['pcs', 'kg', 'm', 'm2', 'm3'])
      }

      // 3) Currencies: use localStorage or a simple default
      const storedCurrencies = localStorage.getItem('products.currencyOptions')
      if (storedCurrencies) {
        setCurrencyOptions(JSON.parse(storedCurrencies))
      } else {
        setCurrencyOptions(['USD'])
      }
    }

    loadCustomLists()
  }, [])

  // Keep localStorage in sync whenever lists change (so your edits persist).
  useEffect(() => {
    localStorage.setItem('products.categoryOptions', JSON.stringify(categoryOptions))
  }, [categoryOptions])

  useEffect(() => {
    localStorage.setItem('products.unitOptions', JSON.stringify(unitOptions))
  }, [unitOptions])

  useEffect(() => {
    localStorage.setItem('products.currencyOptions', JSON.stringify(currencyOptions))
  }, [currencyOptions])

  // If the user changes the custom lists, make sure our form defaults stay valid.
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

  /*************************************************************************************************
   * handleEdit: load a product into the form for editing
   *************************************************************************************************/
  const handleEdit = (product) => {
    setEditingProduct(product)

    // Fill form with product values
    setFormData({
      name: product.name,
      description: product.description || '',
      unit_of_measure: product.unit_of_measure || unitOptions[0] || 'pcs',
      category: categoryOptions.includes(product.category) ? product.category : (categoryOptions[0] || ''),
      currency: product.currency || currencyOptions[0] || 'USD',
      product_type: normalizeProductType(product.product_type),
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
   * loadLinkedDetails: fetch SOs, POs, Emplacements, Transfers for a product
   *************************************************************************************************/
  const loadLinkedDetails = async (product) => {
    setDetailsLoading(true)

    try {
      // ✅ 1) Sales Orders (direct endpoint exists)
      const salesOrdersResponse = await productsAPI.getSalesOrders(product.id)
      setLinkedSalesOrders(salesOrdersResponse.data || [])

      // ✅ 2) Purchase Orders (we fetch a page and filter by product_id)
      const purchaseOrdersResponse = await purchasingAPI.getAll({ limit: 200 })
      const purchaseOrders = purchaseOrdersResponse.data.items || purchaseOrdersResponse.data || []
      const linkedPOs = purchaseOrders.filter((order) =>
        order.items?.some((item) => item.product_id === product.id)
      )
      setLinkedPurchaseOrders(linkedPOs)

      // ✅ 3) Emplacements (inventory items per product)
      const emplacementsResponse = await inventoryAPI.getItems({
        product_id: product.id,
        limit: 200,
      })
      const emplacementItems = emplacementsResponse.data.items || emplacementsResponse.data || []
      setLinkedEmplacements(emplacementItems)

      // ✅ 4) Transfers (movements of type TRANSFER for each emplacement)
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

        // We attach the location so the UI can show "from which emplacement".
        return movements.map((movement) => ({
          ...movement,
          location: emplacement.location,
        }))
      })

      setLinkedTransfers(transfers)
    } catch (error) {
      showAlert('⚠️ Error loading details: ' + error.message, 'error')
    } finally {
      setDetailsLoading(false)
    }
  }

  /*************************************************************************************************
   * handleViewDetails: open details modal + load linked data
   *************************************************************************************************/
  const handleViewDetails = async (product) => {
    setSelectedProduct(product)
    setActiveDetailsTab(DETAILS_TABS[0])

    await loadLinkedDetails(product)
    setShowDetails(true)
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
@@ -640,59 +899,103 @@ function Products() {
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
   * handleAddEmplacement: add a new inventory location for this product
   *************************************************************************************************/
  const handleAddEmplacement = async (e) => {
    e.preventDefault()

    if (!selectedProduct) {
      showAlert('⚠️ Select a product first', 'error')
      return
    }

    if (!emplacementForm.location.trim()) {
      showAlert('⚠️ Location is required', 'error')
      return
    }

    try {
      await inventoryAPI.createItem({
        product_id: selectedProduct.id,
        location: emplacementForm.location.trim(),
        quantity_on_hand: emplacementForm.quantity_on_hand || 0,
        reorder_point: emplacementForm.reorder_point || 0,
        reorder_quantity: emplacementForm.reorder_quantity || 0,
      })

      showAlert('✅ Emplacement added successfully!')

      // Reset the form for the next location.
      setEmplacementForm({
        location: '',
        quantity_on_hand: 0,
        reorder_point: 0,
        reorder_quantity: 0,
      })

      // Reload linked data + refresh the table’s emplacement column.
      await loadLinkedDetails(selectedProduct)
      loadInventorySnapshot()
    } catch (error) {
      showAlert('⚠️ Error adding emplacement: ' + (error.response?.data?.detail || error.message), 'error')
    }
  }

  /*************************************************************************************************
   * resetForm: clear form inputs, exit edit mode, close form
   *************************************************************************************************/
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

  /*************************************************************************************************
   * subAssemblyProducts (memoized)
   *
   * Why useMemo here?
   * - Filtering allProducts happens every render otherwise.
   * - With useMemo, it only recalculates when allProducts changes.
   *************************************************************************************************/
  const subAssemblyProducts = useMemo(
    () =>
      allProducts.filter((p) => {
        const type = normalizeProductType(p.product_type)
        return type === 'Goods' || type === 'Services' || type === 'Both'
      }),
    [allProducts, normalizeProductType]
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
          TABS (Products / Categories / Units / Currencies)
          ========================= */}
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
          SEARCH + FILTERS
          ========================= */}
      {activeTab === 'Products' && (
        <>
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
@@ -882,109 +1211,130 @@ function Products() {
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
                  <option value="">Select unit...</option>
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>📂 Category</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value,
                    })
                  }
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
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      product_type: e.target.value,
                    })
                  }
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

              <div className="form-group">
                <label>💱 Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      currency: e.target.value,
                    })
                  }
                >
                  <option value="">Select currency...</option>
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
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
@@ -1105,88 +1455,351 @@ function Products() {

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
              <p><strong>Type:</strong> {normalizeProductType(selectedProduct.product_type)}</p>
              <p><strong>Category:</strong> {selectedProduct.category || 'N/A'}</p>
              <p><strong>Unit:</strong> {selectedProduct.unit_of_measure || 'N/A'}</p>
              <p><strong>Currency:</strong> {selectedProduct.currency || 'N/A'}</p>
              <p>
                <strong>Price:</strong>{' '}
                {selectedProduct.currency ? `${selectedProduct.currency} ` : ''}{selectedProduct.base_price.toFixed(2)}
              </p>
              <p>
                <strong>Cost:</strong>{' '}
                {selectedProduct.currency ? `${selectedProduct.currency} ` : ''}{selectedProduct.cost.toFixed(2)}
              </p>
            </div>

            {/* Tabs inside the details modal */}
            <div className="tabs-container" style={{ marginBottom: '1rem' }}>
              {DETAILS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDetailsTab(tab)}
                  className={`tab-button ${activeDetailsTab === tab ? 'active' : ''}`}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    background: activeDetailsTab === tab ? 'var(--green-500)' : 'var(--brown-700)',
                    color: activeDetailsTab === tab ? 'var(--brown-900)' : 'var(--brown-200)',
                    cursor: 'pointer',
                    borderRadius: '4px 4px 0 0',
                    marginRight: '2px',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* If data is loading, show a tiny status */}
            {detailsLoading && <p style={{ color: 'var(--brown-200)' }}>Loading linked data...</p>}

            {/* ===== SO TAB ===== */}
            {!detailsLoading && activeDetailsTab === 'SO' && (
              <>
                <h3>📦 Linked Sales Orders ({linkedSalesOrders.length})</h3>

                {linkedSalesOrders.length === 0 ? (
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
                      {linkedSalesOrders.map((order) => {
                        const item = order.items.find((i) => i.product_id === selectedProduct.id)
                        return item ? (
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
                                  color: 'var(--green-300)',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                }}
                              >
                                {order.order_number}
                              </button>
                            </td>
                            <td>{order.customer_name}</td>
                            <td>
                              <span className={`status-badge status-${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                {order.status}
                              </span>
                            </td>
                            <td>{item.quantity}</td>
                            <td>{order.grand_total.toFixed(2)}</td>
                          </tr>
                        ) : null
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* ===== PO TAB ===== */}
            {!detailsLoading && activeDetailsTab === 'PO' && (
              <>
                <h3>🛒 Linked Purchase Orders ({linkedPurchaseOrders.length})</h3>

                {linkedPurchaseOrders.length === 0 ? (
                  <p style={{ color: 'var(--brown-200)' }}>No purchase orders found for this product.</p>
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
                        const item = order.items.find((i) => i.product_id === selectedProduct.id)
                        return item ? (
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
                                  color: 'var(--green-300)',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                }}
                              >
                                {order.po_number}
                              </button>
                            </td>
                            <td>{order.supplier?.company_name || '-'}</td>
                            <td>
                              <span className={`status-badge status-${order.status?.toLowerCase()}`}>
                                {order.status}
                              </span>
                            </td>
                            <td>{item.quantity}</td>
                            <td>{order.grand_total?.toFixed(2)}</td>
                          </tr>
                        ) : null
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* ===== EMPLACEMENTS TAB ===== */}
            {!detailsLoading && activeDetailsTab === 'Emplacements' && (
              <>
                <h3>📍 Emplacements ({linkedEmplacements.length})</h3>

                {/* Small form to add a new emplacement */}
                <form onSubmit={handleAddEmplacement} style={{ marginTop: '1rem' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>📌 Location *</label>
                      <input
                        type="text"
                        value={emplacementForm.location}
                        onChange={(e) =>
                          setEmplacementForm({ ...emplacementForm, location: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>📦 On Hand</label>
                      <input
                        type="number"
                        step="0.01"
                        value={emplacementForm.quantity_on_hand}
                        onChange={(e) =>
                          setEmplacementForm({
                            ...emplacementForm,
                            quantity_on_hand: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>🔔 Reorder Point</label>
                      <input
                        type="number"
                        step="0.01"
                        value={emplacementForm.reorder_point}
                        onChange={(e) =>
                          setEmplacementForm({
                            ...emplacementForm,
                            reorder_point: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>📦 Reorder Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        value={emplacementForm.reorder_quantity}
                        onChange={(e) =>
                          setEmplacementForm({
                            ...emplacementForm,
                            reorder_quantity: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>&nbsp;</label>
                      <button type="submit" className="btn btn-success" style={{ width: '100%' }}>
                        ➕ Add
                      </button>
                    </div>
                  </div>
                </form>

                {linkedEmplacements.length === 0 ? (
                  <p style={{ color: 'var(--brown-200)' }}>No emplacements for this product yet.</p>
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
                                color: 'var(--green-300)',
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

            {/* ===== TRANSFERS TAB ===== */}
            {!detailsLoading && activeDetailsTab === 'Transfers' && (
              <>
                <h3>🔁 Transfer History ({linkedTransfers.length})</h3>

                {linkedTransfers.length === 0 ? (
                  <p style={{ color: 'var(--brown-200)' }}>No transfer movements found.</p>
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
@@ -1278,59 +1891,72 @@ function Products() {
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

@@ -1359,39 +1985,176 @@ function Products() {
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
        </>
      )}

      {/* =========================
          CATEGORIES TAB
          ========================= */}
      {activeTab === 'Categories' && (
        <div className="card">
          <h2>📂 Product Categories</h2>
          <p style={{ color: 'var(--brown-200)' }}>
            Add/remove the categories you want to see in the Products form.
          </p>

          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>➕ New Category</label>
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
            <p style={{ color: 'var(--brown-200)' }}>No categories yet.</p>
          ) : (
            <ul style={{ marginTop: '1rem' }}>
              {categoryOptions.map((cat) => (
                <li key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span>{cat}</span>
                  <button className="btn btn-danger" onClick={() => handleRemoveCategory(cat)}>
                    🗑️ Remove
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
          <h2>📏 Units of Measure</h2>
          <p style={{ color: 'var(--brown-200)' }}>
            Manage the unit list used in the Products form.
          </p>

          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>➕ New Unit</label>
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
            <p style={{ color: 'var(--brown-200)' }}>No units yet.</p>
          ) : (
            <ul style={{ marginTop: '1rem' }}>
              {unitOptions.map((unit) => (
                <li key={unit} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span>{unit}</span>
                  <button className="btn btn-danger" onClick={() => handleRemoveUnit(unit)}>
                    🗑️ Remove
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
          <h2>💱 Currencies</h2>
          <p style={{ color: 'var(--brown-200)' }}>
            These currencies will appear in the Products form select menu.
          </p>

          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>➕ New Currency</label>
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
            <p style={{ color: 'var(--brown-200)' }}>No currencies yet.</p>
          ) : (
            <ul style={{ marginTop: '1rem' }}>
              {currencyOptions.map((currency) => (
                <li key={currency} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span>{currency}</span>
                  <button className="btn btn-danger" onClick={() => handleRemoveCurrency(currency)}>
                    🗑️ Remove
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
