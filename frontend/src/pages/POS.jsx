import { useState, useEffect, useCallback } from 'react'
import { posSessionsAPI, posTransactionsAPI, posReportsAPI, productsAPI } from '../services/api'
import PageHelpCorner from '../components/PageHelpCorner'

function POS() {
  const [activeTab, setActiveTab] = useState('register')
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(null)
  
  const [activeSession, setActiveSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const [transactions, setTransactions] = useState([])
  const [dailyReport, setDailyReport] = useState(null)
  
  // Register state
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountTendered, setAmountTendered] = useState(0)
  const [search, setSearch] = useState('')
  
  // Session management
  const [showOpenSession, setShowOpenSession] = useState(false)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [closingBalance, setClosingBalance] = useState(0)
  const [showCloseSession, setShowCloseSession] = useState(false)

  const showAlert = useCallback((message, type = 'success') => {
    setAlert({ message, type })
    setTimeout(() => setAlert(null), 3000)
  }, [])

  const loadActiveSession = useCallback(async () => {
    try {
      const response = await posSessionsAPI.getActive()
      setActiveSession(response.data.active_session)
    } catch (err) {
      console.error('Failed to load session', err)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      const response = await productsAPI.getAll({ limit: 100 })
      setProducts(response.data.items || [])
    } catch (err) {
      console.error('Failed to load products', err)
    }
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const response = await posSessionsAPI.getAll({ limit: 50 })
      setSessions(response.data.items || [])
    } catch (err) {
      console.error('Failed to load sessions', err)
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    try {
      const params = activeSession ? { session_id: activeSession.id } : { limit: 50 }
      const response = await posTransactionsAPI.getAll(params)
      setTransactions(response.data.items || [])
    } catch (err) {
      console.error('Failed to load transactions', err)
    }
  }, [activeSession])

  const loadDailyReport = useCallback(async () => {
    try {
      const response = await posReportsAPI.daily()
      setDailyReport(response.data)
    } catch (err) {
      console.error('Failed to load report', err)
    }
  }, [])

  useEffect(() => {
    loadActiveSession()
    loadProducts()
    setLoading(false)
  }, [loadActiveSession, loadProducts])

  useEffect(() => {
    if (activeTab === 'sessions') loadSessions()
    if (activeTab === 'transactions') loadTransactions()
    if (activeTab === 'reports') loadDailyReport()
  }, [activeTab, loadSessions, loadTransactions, loadDailyReport])

  const handleOpenSession = async () => {
    try {
      const response = await posSessionsAPI.open({ opening_balance: openingBalance })
      setActiveSession(response.data)
      setShowOpenSession(false)
      showAlert('Session opened')
    } catch (err) {
      showAlert('Failed to open session', 'error')
    }
  }

  const handleCloseSession = async () => {
    try {
      await posSessionsAPI.close(activeSession.id, { closing_balance: closingBalance })
      setActiveSession(null)
      setShowCloseSession(false)
      showAlert('Session closed')
      loadSessions()
    } catch (err) {
      showAlert('Failed to close session', 'error')
    }
  }

  const addToCart = (product) => {
    const existing = cart.find(item => item.product_id === product.id)
    if (existing) {
      setCart(cart.map(item => 
        item.product_id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        unit_price: product.price,
        quantity: 1,
        discount_percent: 0,
        tax_percent: 8
      }])
    }
  }

  const updateCartItem = (index, field, value) => {
    const newCart = [...cart]
    newCart[index][field] = value
    setCart(newCart)
  }

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index))
  }

  const getCartTotal = () => {
    return cart.reduce((sum, item) => {
      const subtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100)
      const tax = subtotal * (item.tax_percent / 100)
      return sum + subtotal + tax
    }, 0)
  }

  const handleCheckout = async () => {
    if (!activeSession) {
      showAlert('Please open a session first', 'error')
      return
    }
    if (cart.length === 0) {
      showAlert('Cart is empty', 'error')
      return
    }

    try {
      const transaction = {
        session_id: activeSession.id,
        customer_name: customerName,
        transaction_type: 'sale',
        payment_method: paymentMethod,
        amount_tendered: paymentMethod === 'cash' ? amountTendered : getCartTotal(),
        items: cart
      }
      
      const response = await posTransactionsAPI.create(transaction)
      showAlert(`Sale complete! ${paymentMethod === 'cash' ? `Change: $${response.data.change_given.toFixed(2)}` : ''}`)
      setCart([])
      setCustomerName('')
      setAmountTendered(0)
      loadActiveSession()
    } catch (err) {
      showAlert('Transaction failed', 'error')
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-container">
      {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}
      
      <div className="page-header">
        <h1>
          🛒 Point of Sale
          <PageHelpCorner />
        </h1>
        <div>
          {!activeSession ? (
            <button onClick={() => setShowOpenSession(true)} className="btn btn-primary">Open Session</button>
          ) : (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--green-400)' }}>● Session: {activeSession.session_number}</span>
              <button onClick={() => setShowCloseSession(true)} className="btn btn-secondary">Close Session</button>
            </div>
          )}
        </div>
      </div>

      <div className="tabs-container" style={{ marginBottom: '1rem' }}>
        {['register', 'transactions', 'sessions', 'reports'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem', border: 'none', textTransform: 'capitalize',
              background: activeTab === tab ? 'var(--green-500)' : 'var(--brown-700)',
              color: activeTab === tab ? 'var(--brown-900)' : 'var(--brown-200)',
              cursor: 'pointer', borderRadius: '4px 4px 0 0', marginRight: '2px'
            }}
          >{tab}</button>
        ))}
      </div>

      {/* Open Session Modal */}
      {showOpenSession && (
        <div className="modal-overlay" onClick={() => setShowOpenSession(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Open New Session</h2>
            <div className="form-group">
              <label>Opening Cash Balance</label>
              <input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)} min="0" step="0.01" />
            </div>
            <div className="form-actions">
              <button onClick={() => setShowOpenSession(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleOpenSession} className="btn btn-primary">Open Session</button>
            </div>
          </div>
        </div>
      )}

      {/* Close Session Modal */}
      {showCloseSession && activeSession && (
        <div className="modal-overlay" onClick={() => setShowCloseSession(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Close Session</h2>
            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--brown-700)', borderRadius: '4px' }}>
              <p><strong>Opening Balance:</strong> ${activeSession.opening_balance?.toFixed(2)}</p>
              <p><strong>Total Sales:</strong> ${activeSession.total_sales?.toFixed(2)}</p>
              <p><strong>Total Cash:</strong> ${activeSession.total_cash?.toFixed(2)}</p>
              <p><strong>Transactions:</strong> {activeSession.transaction_count}</p>
            </div>
            <div className="form-group">
              <label>Actual Closing Cash Balance</label>
              <input type="number" value={closingBalance} onChange={(e) => setClosingBalance(parseFloat(e.target.value) || 0)} min="0" step="0.01" />
            </div>
            <div className="form-actions">
              <button onClick={() => setShowCloseSession(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleCloseSession} className="btn btn-primary">Close Session</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'register' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '1.5rem' }}>
          {/* Products */}
          <div>
            <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="search-input" style={{ marginBottom: '1rem', width: '100%' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {filteredProducts.slice(0, 24).map(product => (
                <div key={product.id} onClick={() => addToCart(product)}
                  style={{
                    background: 'var(--brown-700)', padding: '1rem', borderRadius: '8px',
                    cursor: 'pointer', textAlign: 'center', transition: 'transform 0.1s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{product.name}</div>
                  <div style={{ color: 'var(--green-400)', fontSize: '1.1rem' }}>${product.price?.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Cart</h3>
            
            {cart.length === 0 ? (
              <p style={{ color: 'var(--brown-400)', textAlign: 'center', padding: '2rem 0' }}>Cart is empty</p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
                {cart.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--brown-600)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{item.product_name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--brown-400)' }}>${item.unit_price?.toFixed(2)} × {item.quantity}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="number" value={item.quantity} onChange={(e) => updateCartItem(idx, 'quantity', parseInt(e.target.value) || 1)} min="1" style={{ width: '50px', textAlign: 'center' }} />
                      <button onClick={() => removeFromCart(idx)} className="btn-icon">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '2px solid var(--brown-500)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                <span>Total:</span>
                <span style={{ color: 'var(--green-400)' }}>${getCartTotal().toFixed(2)}</span>
              </div>

              <div className="form-group">
                <label>Customer Name (Optional)</label>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in" />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setPaymentMethod('cash')} className={`btn ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }}>💵 Cash</button>
                  <button onClick={() => setPaymentMethod('card')} className={`btn ${paymentMethod === 'card' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }}>💳 Card</button>
                </div>
              </div>

              {paymentMethod === 'cash' && (
                <div className="form-group">
                  <label>Amount Tendered</label>
                  <input type="number" value={amountTendered} onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)} min="0" step="0.01" />
                  {amountTendered >= getCartTotal() && (
                    <div style={{ color: 'var(--green-400)', marginTop: '0.5rem' }}>Change: ${(amountTendered - getCartTotal()).toFixed(2)}</div>
                  )}
                </div>
              )}

              <button onClick={handleCheckout} className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }} disabled={!activeSession || cart.length === 0}>
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction #</th>
                <th>Time</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{t.transaction_number}</td>
                  <td>{new Date(t.created_at).toLocaleString()}</td>
                  <td>{t.customer_name || 'Walk-in'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{t.transaction_type}</td>
                  <td style={{ textTransform: 'capitalize' }}>{t.payment_method}</td>
                  <td>${t.total?.toFixed(2)}</td>
                  <td><span className={`status-badge ${t.status}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Session #</th>
                <th>Opened</th>
                <th>Closed</th>
                <th>Opening</th>
                <th>Closing</th>
                <th>Sales</th>
                <th>Transactions</th>
                <th>Difference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td>{s.session_number}</td>
                  <td>{new Date(s.opened_at).toLocaleString()}</td>
                  <td>{s.closed_at ? new Date(s.closed_at).toLocaleString() : '-'}</td>
                  <td>${s.opening_balance?.toFixed(2)}</td>
                  <td>{s.closing_balance != null ? `$${s.closing_balance.toFixed(2)}` : '-'}</td>
                  <td>${s.total_sales?.toFixed(2)}</td>
                  <td>{s.transaction_count}</td>
                  <td style={{ color: s.cash_difference < 0 ? 'var(--red-400)' : s.cash_difference > 0 ? 'var(--green-400)' : 'inherit' }}>
                    {s.cash_difference != null ? `$${s.cash_difference.toFixed(2)}` : '-'}
                  </td>
                  <td><span className={`status-badge ${s.status}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'reports' && dailyReport && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', color: 'var(--green-400)' }}>${dailyReport.total_sales?.toFixed(2)}</div>
            <div style={{ color: 'var(--brown-300)' }}>Total Sales</div>
          </div>
          <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', color: 'var(--orange-400)' }}>${dailyReport.total_returns?.toFixed(2)}</div>
            <div style={{ color: 'var(--brown-300)' }}>Returns</div>
          </div>
          <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', color: 'var(--green-400)' }}>${dailyReport.net_sales?.toFixed(2)}</div>
            <div style={{ color: 'var(--brown-300)' }}>Net Sales</div>
          </div>
          <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', color: 'var(--brown-200)' }}>{dailyReport.transaction_count}</div>
            <div style={{ color: 'var(--brown-300)' }}>Transactions</div>
          </div>
          <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', color: 'var(--green-400)' }}>${dailyReport.total_cash?.toFixed(2)}</div>
            <div style={{ color: 'var(--brown-300)' }}>Cash Payments</div>
          </div>
          <div style={{ background: 'var(--brown-800)', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', color: 'var(--blue-400)' }}>${dailyReport.total_card?.toFixed(2)}</div>
            <div style={{ color: 'var(--brown-300)' }}>Card Payments</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default POS
