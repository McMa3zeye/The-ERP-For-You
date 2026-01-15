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
 * - salesOrdersAPI (⚠️ in THIS snippet it’s imported but not used; could be for future features)
 */
import { productsAPI, purchasingAPI, inventoryAPI } from '../services/api'

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
@@ -120,130 +121,165 @@ import { exportChartData } from '../utils/export'
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

  // useNavigate lets us jump to another page in the app programmatically.
  // We will use this when the user clicks a PO/SO/Emplacement link in the details modal.
  const navigate = useNavigate()

  // We compute permission flags:
  // canCreate is true if user has 'products.create'.
  // canUpdate is true if user has 'products.update'.
  // canDelete is true if user has 'products.delete'.
  const canCreate = hasPermission('products.create')
  const canUpdate = hasPermission('products.update')
  const canDelete = hasPermission('products.delete')

  /*************************************************************************************************
   * PAGE-LEVEL TABS (Products / Categories / Units / Currencies)
   *
   * We mimic the Admin page's tabs so this page feels consistent.
   *************************************************************************************************/
  const PRODUCT_TABS = ['Products', 'Categories', 'Units', 'Currencies']
  const [activeTab, setActiveTab] = useState('Products')

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

  // inventoryByProduct maps product_id -> array of inventory items (emplacements).
  // This helps us show a quick "emplacements" column in the product table.
  const [inventoryByProduct, setInventoryByProduct] = useState({})

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

  // linkedSalesOrders holds sales orders connected to a product (for the details modal).
  const [linkedSalesOrders, setLinkedSalesOrders] = useState([])

  // linkedPurchaseOrders holds purchase orders connected to a product.
  const [linkedPurchaseOrders, setLinkedPurchaseOrders] = useState([])

  // linkedInventoryItems holds the inventory emplacements (locations) for a product.
  const [linkedInventoryItems, setLinkedInventoryItems] = useState([])

  // linkedTransfers holds transfer movements between emplacements (movement_type === TRANSFER).
  const [linkedTransfers, setLinkedTransfers] = useState([])

  // detailsTab controls which tab is active inside the details modal.
  const [detailsTab, setDetailsTab] = useState('POs')

  // These are the tabs inside the Product Details modal.
  const DETAILS_TABS = ['POs', 'SOs', 'Emplacements', 'Transfers']

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

  // Emplacements chosen inside the creation form (inventory locations).
  // Each row becomes an inventory item tied to this product.
  const [formEmplacements, setFormEmplacements] = useState([])

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

@@ -281,50 +317,51 @@ function Products() {
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
    currency_code: 'USD',
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
@@ -387,72 +424,109 @@ function Products() {
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
   * Load inventory snapshot for the current product list
   *
   * We only need locations for products visible in the table.
   *************************************************************************************************/
  const loadInventorySnapshot = useCallback(async (productList) => {
    if (productList.length === 0) {
      setInventoryByProduct({})
      return
    }

    try {
      const response = await inventoryAPI.getItems({ limit: 1000 })
      const items = response.data.items || response.data || []
      const ids = new Set(productList.map((product) => product.id))

      const grouped = items.reduce((acc, item) => {
        if (!ids.has(item.product_id)) return acc
        acc[item.product_id] = acc[item.product_id] || []
        acc[item.product_id].push(item)
        return acc
      }, {})

      setInventoryByProduct(grouped)
    } catch (error) {
      console.error('Error loading inventory snapshot:', error)
      setInventoryByProduct({})
    }
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
   * Whenever the product list changes, refresh the inventory snapshot.
   *************************************************************************************************/
  useEffect(() => {
    loadInventorySnapshot(products)
  }, [products, loadInventorySnapshot])

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

@@ -464,160 +538,317 @@ function Products() {
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

      // Add emplacements (inventory items) if user defined any.
      if (formEmplacements.length > 0 && productId) {
        for (const emplacement of formEmplacements) {
          if (!emplacement.location.trim()) continue

          try {
            await inventoryAPI.createItem({
              product_id: productId,
              location: emplacement.location.trim(),
              quantity_on_hand: emplacement.quantity_on_hand,
              reorder_point: emplacement.reorder_point,
              reorder_quantity: emplacement.reorder_quantity,
            })
          } catch (emplacementError) {
            console.error('Error adding emplacement:', emplacementError)
            showAlert(
              '⚠️ Emplacement error: ' +
                (emplacementError.response?.data?.detail || emplacementError.message),
              'error'
            )
          }
        }
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
   * Emplacement rows inside the product creation form
   *************************************************************************************************/
  const handleAddFormEmplacement = () => {
    // Add a new emplacement row with sensible defaults.
    setFormEmplacements([
      ...formEmplacements,
      {
        location: '',
        quantity_on_hand: 0,
        reorder_point: 0,
        reorder_quantity: 0,
      },
    ])
  }

  const handleRemoveFormEmplacement = (index) => {
    setFormEmplacements(formEmplacements.filter((_, i) => i !== index))
  }

  const handleFormEmplacementChange = (index, field, value) => {
    const next = [...formEmplacements]

    next[index][field] =
      field === 'location' ? value : parseFloat(value) || 0

    setFormEmplacements(next)
  }

  /*************************************************************************************************
   * Categories / Units / Currencies state + loaders
   *
   * We store these lists in localStorage so the user can define them once
   * and reuse them everywhere (just like the "Admin" tab behavior).
   *************************************************************************************************/
  const CATEGORY_STORAGE_KEY = 'products.categories'
  const UNIT_STORAGE_KEY = 'products.units'
  const CURRENCY_STORAGE_KEY = 'products.currencies'

  // Categories are used for the category dropdown in the product form.
  const [categories, setCategories] = useState([])

  // Units are used for the unit-of-measure dropdown in the product form.
  const [units, setUnits] = useState(['pcs', 'kg', 'm', 'm2', 'm3'])

  // Currencies are used for the currency dropdown in the product form.
  // Each currency has a code, symbol, and display name.
  const [currencies, setCurrencies] = useState([
    { code: 'USD', symbol: '$', name: 'US Dollar' },
  ])

  // Local input state for the "management" tabs (Categories/Units/Currencies).
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newUnitName, setNewUnitName] = useState('')
  const [newCurrencyCode, setNewCurrencyCode] = useState('')
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('')
  const [newCurrencyName, setNewCurrencyName] = useState('')

  useEffect(() => {
    const loadLists = async () => {
      // 1) Pull user-defined lists from localStorage if they exist.
      const storedCategories = JSON.parse(
        localStorage.getItem(CATEGORY_STORAGE_KEY) || '[]'
      )
      const storedUnits = JSON.parse(
        localStorage.getItem(UNIT_STORAGE_KEY) || '[]'
      )
      const storedCurrencies = JSON.parse(
        localStorage.getItem(CURRENCY_STORAGE_KEY) || '[]'
      )

      if (storedUnits.length > 0) setUnits(storedUnits)
      if (storedCurrencies.length > 0) setCurrencies(storedCurrencies)

      // 2) For categories, we merge localStorage with backend categories,
      //    so we don't lose anything that already exists in products.
      try {
        const response = await productsAPI.getCategories()
        const backendCategories = response.data || []
        const mergedCategories = Array.from(
          new Set([...storedCategories, ...backendCategories].filter(Boolean))
        ).sort()
        setCategories(mergedCategories)
      } catch (error) {
        console.error('Error loading categories:', error)

        // Fallback:
        // Extract categories from products already loaded.
        const fallbackCategories = [
          ...new Set(products.map((p) => p.category).filter(Boolean)),
        ].sort()
        setCategories(Array.from(new Set([...storedCategories, ...fallbackCategories])))
Add a comment

Cancel

Comment
      }
    }

    loadLists()
  }, []) // run once on mount

  // Persist category/unit/currency lists whenever they change.
  useEffect(() => {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    localStorage.setItem(UNIT_STORAGE_KEY, JSON.stringify(units))
  }, [units])

  useEffect(() => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(currencies))
  }, [currencies])

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
      currency_code: product.currency_code || 'USD',
      product_type: product.product_type || 'Final',
      base_price: product.base_price,
      cost: product.cost,
      is_active: product.is_active,
      is_tracked: product.is_tracked,
    })

    // We reset emplacements on edit so the user can add new ones explicitly.
    setFormEmplacements([])

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
    setLinkedSalesOrders([])
    setLinkedPurchaseOrders([])
    setLinkedInventoryItems([])
    setLinkedTransfers([])

    try {
      // Load linked Sales Orders.
      const salesResponse = await productsAPI.getSalesOrders(product.id)
      setLinkedSalesOrders(salesResponse.data || [])

      // Load linked Purchase Orders (filter client-side by product ID).
      const poResponse = await purchasingAPI.getAll({ limit: 1000 })
      const poItems = poResponse.data.items || poResponse.data || []
      const linkedPOs = poItems.filter((po) =>
        po.items?.some((item) => item.product_id === product.id)
      )
      setLinkedPurchaseOrders(linkedPOs)

      // Load emplacements (inventory items) for this product.
      const inventoryResponse = await inventoryAPI.getItems({
        product_id: product.id,
        limit: 1000,
      })
      const inventoryItems = inventoryResponse.data.items || inventoryResponse.data || []
      setLinkedInventoryItems(inventoryItems)

      // Load transfer movements for each inventory item.
      const movementResponses = await Promise.all(
        inventoryItems.map((item) =>
          inventoryAPI.getMovements({
            inventory_item_id: item.id,
            limit: 1000,
          })
        )
      )

      const allMovements = movementResponses.flatMap(
        (response) => response.data.items || response.data || []
      )
      const transferMovements = allMovements.filter(
        (movement) => movement.movement_type === 'TRANSFER'
      )
      setLinkedTransfers(transferMovements)

      // Default to the PO tab when opening.
      setDetailsTab('POs')
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
@@ -649,309 +880,425 @@ function Products() {
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
      currency_code: 'USD',
      product_type: 'Final',
      base_price: 0,
      cost: 0,
      is_active: true,
      is_tracked: true,
    })

    setFormIngredients([])
    setFormEmplacements([])
    setEditingProduct(null)
    setShowForm(false)
  }

  /*************************************************************************************************
   * Category / Unit / Currency management helpers
   *
   * These functions support the tabbed management UI so the user can define
   * lists (categories/units/currencies) and then select them in the Product form.
   *************************************************************************************************/
  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) return

    setCategories((prev) =>
      Array.from(new Set([...prev, trimmed])).sort()
    )
    setNewCategoryName('')
  }

  const handleRemoveCategory = (category) => {
    setCategories((prev) => prev.filter((cat) => cat !== category))
  }

  const handleAddUnit = () => {
    const trimmed = newUnitName.trim()
    if (!trimmed) return

    setUnits((prev) =>
      Array.from(new Set([...prev, trimmed]))
    )
    setNewUnitName('')
  }

  const handleRemoveUnit = (unit) => {
    setUnits((prev) => prev.filter((item) => item !== unit))
  }

  const handleAddCurrency = () => {
    const code = newCurrencyCode.trim().toUpperCase()
    const symbol = newCurrencySymbol.trim()
    const name = newCurrencyName.trim()

    if (!code || !symbol || !name) return

    setCurrencies((prev) => {
      const next = prev.filter((currency) => currency.code !== code)
      return [...next, { code, symbol, name }].sort((a, b) =>
        a.code.localeCompare(b.code)
      )
    })

    setNewCurrencyCode('')
    setNewCurrencySymbol('')
    setNewCurrencyName('')
  }

  const handleRemoveCurrency = (code) => {
    setCurrencies((prev) => prev.filter((currency) => currency.code !== code))
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
   * Helper: map currency code to display info (symbol/name)
   *************************************************************************************************/
  const getCurrencyMeta = useCallback(
    (code) => currencies.find((currency) => currency.code === code),
    [currencies]
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
          {activeTab === 'Products' && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* =========================
          PAGE TABS (Products / Categories / Units / Currencies)
          ========================= */}
      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        {PRODUCT_TABS.map((tab) => (
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
          ALERT MESSAGE (success/error)
          ========================= */}
      {alert && (
        <div className={`alert alert-${alert.type === 'error' ? 'error' : 'success'}`}>
          {alert.message}
        </div>
      )}

      {activeTab === 'Products' && (
        <>
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
                  {units.map((unit) => (
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
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>💱 Currency</label>
                <select
                  value={formData.currency_code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      currency_code: e.target.value,
                    })
                  }
                >
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} ({currency.symbol}) - {currency.name}
                    </option>
                  ))}
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
@@ -1069,124 +1416,400 @@ function Products() {
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

            {/* Emplacements (inventory locations) */}
            <div className="card" style={{ marginTop: '1.5rem', backgroundColor: 'rgba(45, 27, 14, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>📍 Emplacements (Inventory Locations)</h3>
                <button type="button" className="btn btn-success" onClick={handleAddFormEmplacement}>
                  ➕ Add Emplacement
                </button>
              </div>

              <p style={{ color: 'var(--brown-200)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                💡 Each emplacement becomes an inventory item for this product (location + quantities).
                You can add multiple rows if the product is stored in several places.
              </p>

              {formEmplacements.length > 0 &&
                formEmplacements.map((emplacement, index) => (
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
                        <label>📍 Location *</label>
                        <input
                          type="text"
                          value={emplacement.location}
                          onChange={(e) =>
                            handleFormEmplacementChange(index, 'location', e.target.value)
                          }
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>📦 Qty On Hand</label>
                        <input
                          type="number"
                          step="0.01"
                          value={emplacement.quantity_on_hand}
                          onChange={(e) =>
                            handleFormEmplacementChange(index, 'quantity_on_hand', e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label>🚨 Reorder Point</label>
                        <input
                          type="number"
                          step="0.01"
                          value={emplacement.reorder_point}
                          onChange={(e) =>
                            handleFormEmplacementChange(index, 'reorder_point', e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label>🔁 Reorder Qty</label>
                        <input
                          type="number"
                          step="0.01"
                          value={emplacement.reorder_quantity}
                          onChange={(e) =>
                            handleFormEmplacementChange(index, 'reorder_quantity', e.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label>&nbsp;</label>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleRemoveFormEmplacement(index)}
                          style={{ width: '100%' }}
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {formEmplacements.length === 0 && (
                <p
                  style={{
                    textAlign: 'center',
                    color: 'var(--brown-300)',
                    padding: '1rem',
                    fontStyle: 'italic',
                  }}
                >
                  No emplacements added yet. Click "➕ Add Emplacement" to add locations.
                </p>
              )}
            </div>

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
              <p>
                <strong>Currency:</strong>{' '}
                {getCurrencyMeta(selectedProduct.currency_code)?.code ||
                  selectedProduct.currency_code ||
                  'USD'}
              </p>
              <p>
                <strong>Price:</strong>{' '}
                {getCurrencyMeta(selectedProduct.currency_code)?.symbol || '$'}
                {selectedProduct.base_price.toFixed(2)}
              </p>
              <p>
                <strong>Cost:</strong>{' '}
                {getCurrencyMeta(selectedProduct.currency_code)?.symbol || '$'}
                {selectedProduct.cost.toFixed(2)}
              </p>
            </div>

            {/* Tabs inside the details modal */}
            <div className="tabs-container" style={{ marginBottom: '1rem' }}>
              {DETAILS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailsTab(tab)}
                  className={`tab-button ${detailsTab === tab ? 'active' : ''}`}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    background: detailsTab === tab ? 'var(--green-500)' : 'var(--brown-700)',
                    color: detailsTab === tab ? 'var(--brown-900)' : 'var(--brown-200)',
                    cursor: 'pointer',
                    borderRadius: '4px 4px 0 0',
                    marginRight: '2px',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* PO TAB */}
            {detailsTab === 'POs' && (
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
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedPurchaseOrders.map((po) => (
                        <tr key={po.id}>
                          <td>
                            <button
                              className="btn btn-secondary"
                              onClick={() => navigate(`/purchasing?poId=${po.id}`)}
                              style={{ padding: '0.25rem 0.5rem' }}
                            >
                              {po.po_number}
                            </button>
                          </td>
                          <td>{po.supplier?.company_name || '-'}</td>
                          <td>
                            <span className={`status-badge status-${po.status.toLowerCase()}`}>
                              {po.status}
                            </span>
                          </td>
                          <td>
                            {getCurrencyMeta(selectedProduct.currency_code)?.symbol || '$'}
                            {po.grand_total?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* SO TAB */}
            {detailsTab === 'SOs' && (
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
                                className="btn btn-secondary"
                                onClick={() => navigate(`/sales-orders?salesOrderId=${order.id}`)}
                                style={{ padding: '0.25rem 0.5rem' }}
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
                            <td>
                              {getCurrencyMeta(selectedProduct.currency_code)?.symbol || '$'}
                              {order.grand_total.toFixed(2)}
                            </td>
                          </tr>
                        ) : null
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* EMPLACEMENTS TAB */}
            {detailsTab === 'Emplacements' && (
              <>
                <h3>📍 Emplacements ({linkedInventoryItems.length})</h3>
                {linkedInventoryItems.length === 0 ? (
                  <p style={{ color: 'var(--brown-200)' }}>No emplacements found for this product.</p>
                ) : (
                  <table style={{ marginTop: '1rem' }}>
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>On Hand</th>
                        <th>Available</th>
                        <th>Reorder Point</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedInventoryItems.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <button
                              className="btn btn-secondary"
                              onClick={() => navigate(`/inventory?itemId=${item.id}`)}
                              style={{ padding: '0.25rem 0.5rem' }}
                            >
                              {item.location}
                            </button>
                          </td>
                          <td>{item.quantity_on_hand}</td>
                          <td>{item.quantity_available}</td>
                          <td>{item.reorder_point}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* TRANSFERS TAB */}
            {detailsTab === 'Transfers' && (
              <>
                <h3>🔁 Transfers ({linkedTransfers.length})</h3>
                {linkedTransfers.length === 0 ? (
                  <p style={{ color: 'var(--brown-200)' }}>
                    No transfer movements found for this product.
                  </p>
                ) : (
                  <table style={{ marginTop: '1rem' }}>
                    <thead>
                      <tr>
                        <th>Movement ID</th>
                        <th>Inventory Item</th>
                        <th>Qty</th>
                        <th>Reference</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedTransfers.map((movement) => (
                        <tr key={movement.id}>
                          <td>{movement.id}</td>
                          <td>{movement.inventory_item_id}</td>
                          <td>{movement.quantity}</td>
                          <td>{movement.reference_type || 'TRANSFER'}</td>
                          <td>{new Date(movement.created_at).toLocaleDateString()}</td>
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
@@ -1278,59 +1901,81 @@ function Products() {
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
                  key: 'currency_code',
                  label: 'Currency',
                  render: (value) => getCurrencyMeta(value)?.code || value || 'USD',
                },
                {
                  key: 'emplacements',
                  label: 'Emplacements',
                  sortable: false,
                  render: (_, row) => {
                    const locations = (inventoryByProduct[row.id] || []).map(
                      (item) => item.location
                    )
                    return locations.length > 0 ? locations.join(', ') : '-'
                  },
                },
                {
                  key: 'base_price',
                  label: 'Price',
                  render: (value, row) => {
                    const symbol = getCurrencyMeta(row.currency_code)?.symbol || '$'
                    return `${symbol}${parseFloat(value || 0).toFixed(2)}`
                  },
                },
                {
                  key: 'cost',
                  label: 'Cost',
                  render: (value, row) => {
                    const symbol = getCurrencyMeta(row.currency_code)?.symbol || '$'
                    return `${symbol}${parseFloat(value || 0).toFixed(2)}`
                  },
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

@@ -1359,39 +2004,227 @@ function Products() {
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
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem' }}>
            💡 Add categories here, then select them in the Products form.
          </p>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>New Category</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Furniture, Hardware, Finishes"
              />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-success" onClick={handleAddCategory}>
                ➕ Add Category
              </button>
            </div>
          </div>

          {categories.length === 0 ? (
            <p style={{ color: 'var(--brown-200)' }}>No categories yet.</p>
          ) : (
            <table style={{ marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat}>
                    <td>{cat}</td>
                    <td>
                      <button className="btn btn-danger" onClick={() => handleRemoveCategory(cat)}>
                        🗑️ Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* =========================
          UNITS TAB
          ========================= */}
      {activeTab === 'Units' && (
        <div className="card">
          <h2>📏 Units of Measure</h2>
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem' }}>
            💡 Add units here, then select them in the Products form.
          </p>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>New Unit</label>
              <input
                type="text"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="e.g., pcs, kg, box, liters"
              />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-success" onClick={handleAddUnit}>
                ➕ Add Unit
              </button>
            </div>
          </div>

          {units.length === 0 ? (
            <p style={{ color: 'var(--brown-200)' }}>No units yet.</p>
          ) : (
            <table style={{ marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit}>
                    <td>{unit}</td>
                    <td>
                      <button className="btn btn-danger" onClick={() => handleRemoveUnit(unit)}>
                        🗑️ Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* =========================
          CURRENCIES TAB
          ========================= */}
      {activeTab === 'Currencies' && (
        <div className="card">
          <h2>💱 Currencies</h2>
          <p style={{ color: 'var(--brown-200)', marginBottom: '1rem' }}>
            💡 Add currencies here, then select them in the Products form.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label>Code</label>
              <input
                type="text"
                value={newCurrencyCode}
                onChange={(e) => setNewCurrencyCode(e.target.value)}
                placeholder="USD"
                maxLength={5}
              />
            </div>
            <div className="form-group">
              <label>Symbol</label>
              <input
                type="text"
                value={newCurrencySymbol}
                onChange={(e) => setNewCurrencySymbol(e.target.value)}
                placeholder="$"
                maxLength={3}
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Name</label>
              <input
                type="text"
                value={newCurrencyName}
                onChange={(e) => setNewCurrencyName(e.target.value)}
                placeholder="US Dollar"
              />
            </div>
            <div className="form-group" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-success" onClick={handleAddCurrency}>
                ➕ Add Currency
              </button>
            </div>
          </div>

          {currencies.length === 0 ? (
            <p style={{ color: 'var(--brown-200)' }}>No currencies yet.</p>
          ) : (
            <table style={{ marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((currency) => (
                  <tr key={currency.code}>
                    <td>{currency.code}</td>
                    <td>{currency.symbol}</td>
                    <td>{currency.name}</td>
                    <td>
                      <button className="btn btn-danger" onClick={() => handleRemoveCurrency(currency.code)}>
                        🗑️ Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
