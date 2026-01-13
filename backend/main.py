from fastapi import FastAPI, Depends, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from datetime import datetime, timedelta
import logging
import os
from dotenv import load_dotenv
from database import engine, Base, get_db, SessionLocal

# Load environment variables from .env file
load_dotenv()
from routers import products, inventory, sales_orders, customers, quotes, suppliers, purchasing, invoicing, payments, work_orders, expenses, projects, support_tickets, leads, warehousing, manufacturing, quality, shipping, returns, time_attendance, hr, assets, auth, admin, reporting, accounting, production_planning, documents, payroll, pos, tooling, portal, settings, notifications, backup, imports
import models

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create database tables
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
except Exception as e:
    logger.error(f"Error creating database tables: {e}")
    raise

app = FastAPI(
    title="Wood ERP System",
    description="Open-source ERP for woodworking business",
    version="1.0.0",
    redirect_slashes=False  # Disable automatic trailing slash redirects
)

# Get allowed origins from environment or use defaults
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://the-erp-for-you.vercel.app,http://localhost:5173,http://localhost:3000"
).split(",")

# CORS middleware to allow React frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,
)

# =====================================================
# AuthZ middleware: apply role/permission checks globally
# =====================================================

PUBLIC_PATH_PREFIXES = (
    "/api/auth/login",
    "/api/auth/verify",
    "/api/health",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/admin/bootstrap-owner",  # bootstrap endpoint (see handler for behavior)
)

# Path prefix → module key used by permissions table
MODULE_PREFIX_MAP = {
    "/api/products": "products",
    "/api/inventory": "inventory",
    "/api/sales-orders": "sales_orders",
    "/api/customers": "customers",
    "/api/quotes": "quotes",
    "/api/suppliers": "suppliers",
    "/api/purchasing": "purchasing",
    "/api/invoices": "invoicing",
    "/api/payments": "payments",
    "/api/work-orders": "work_orders",
    "/api/expenses": "expenses",
    "/api/projects": "projects",
    "/api/support-tickets": "support_tickets",
    "/api/leads": "leads",
    "/api/warehousing": "warehousing",
    "/api/manufacturing": "manufacturing",
    "/api/quality": "quality",
    "/api/shipping": "shipping",
    "/api/returns": "returns",
    "/api/time-attendance": "time_attendance",
    "/api/hr": "hr",
    "/api/assets": "assets",
    "/api/reporting": "reporting",
    "/api/accounting": "accounting",
    "/api/production": "production",
    "/api/documents": "documents",
    "/api/payroll": "payroll",
    "/api/pos": "pos",
    "/api/tooling": "tooling",
    "/api/portal": "portal",
    "/api/settings": "settings",
    "/api/notifications": "notifications",
    "/api/backup": "backup",
    "/api/import": "import",
}


def _permission_from_method(method: str) -> str | None:
    if method == "GET":
        return "view"
    if method == "POST":
        return "create"
    if method == "PUT":
        return "update"
    if method == "DELETE":
        return "delete"
    return None


def _required_permission_for_path(path: str, method: str) -> str | None:
    # Admin endpoints: map to higher-level permissions
    if path.startswith("/api/admin/users"):
        return "admin.manage_users"
    if path.startswith("/api/admin/roles") or path.startswith("/api/admin/permissions"):
        return "admin.manage_roles"
    if path.startswith("/api/admin/audit-logs"):
        return "admin.view_audit"
    if path.startswith("/api/admin/settings"):
        return "settings.manage"

    # Other endpoints: module.method mapping
    action = _permission_from_method(method)
    if not action:
        return None
    for prefix, module in MODULE_PREFIX_MAP.items():
        if path.startswith(prefix):
            # base CRUD code pattern created by /api/admin/init-permissions
            return f"{module}.{action}"
    return None


def _get_bearer_token(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


@app.middleware("http")
async def authz_middleware(request: Request, call_next):
    path = request.url.path

    # Only protect API routes; let frontend/static/dev server handle others.
    if not path.startswith("/api/"):
        return await call_next(request)
        
    # Always let preflight through
    if request.method == "OPTIONS":
        return await call_next(request)

    # Public endpoints
    if path.startswith(PUBLIC_PATH_PREFIXES):
        return await call_next(request)

    # Allow /api/auth/* for authenticated flows (except login/verify already public)
    # These still require authentication.

    token = _get_bearer_token(request)
    if not token:
        return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

    db = SessionLocal()
    try:
        session = db.query(models.UserSession).filter(
            models.UserSession.session_token == token,
            models.UserSession.is_active == True,
            models.UserSession.expires_at > datetime.utcnow(),
        ).first()
        if not session:
            return JSONResponse(status_code=401, content={"detail": "Session expired or invalid"})

        user = db.query(models.User).options(
            joinedload(models.User.roles).joinedload(models.Role.permissions)
        ).filter(
            models.User.id == session.user_id,
            models.User.is_active == True,
        ).first()
        if not user:
            return JSONResponse(status_code=401, content={"detail": "User not found or disabled"})

        required = _required_permission_for_path(path, request.method.upper())
        if required and not user.is_superuser:
            perm_set = set()
            for r in user.roles or []:
                if not r or not r.is_active:
                    continue
                for p in r.permissions or []:
                    if p and p.code:
                        perm_set.add(p.code)
            if required not in perm_set:
                return JSONResponse(status_code=403, content={"detail": f"Permission denied: {required}"})

        return await call_next(request)
    finally:
        db.close()

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "message": str(exc) if os.getenv("DEBUG") else "An error occurred"}
    )

# Include routers
try:
    app.include_router(products.router, prefix="/api/products", tags=["Products"])
    app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])
    app.include_router(sales_orders.router, prefix="/api/sales-orders", tags=["Sales Orders"])
    app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
    app.include_router(quotes.router, prefix="/api/quotes", tags=["Quotes"])
    app.include_router(suppliers.router, prefix="/api/suppliers", tags=["Suppliers"])
    app.include_router(purchasing.router, prefix="/api/purchasing", tags=["Purchasing"])
    app.include_router(invoicing.router, prefix="/api/invoices", tags=["Invoicing"])
    app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
    app.include_router(work_orders.router, prefix="/api/work-orders", tags=["Work Orders"])
    app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"])
    app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
    app.include_router(support_tickets.router, prefix="/api/support-tickets", tags=["Support Tickets"])
    app.include_router(leads.router, prefix="/api/leads", tags=["Leads"])
    app.include_router(warehousing.router, prefix="/api/warehousing", tags=["Warehousing"])
    app.include_router(manufacturing.router, prefix="/api/manufacturing", tags=["Manufacturing"])
    app.include_router(quality.router, prefix="/api/quality", tags=["Quality"])
    app.include_router(shipping.router, prefix="/api/shipping", tags=["Shipping"])
    app.include_router(returns.router, prefix="/api/returns", tags=["Returns"])
    app.include_router(time_attendance.router, prefix="/api/time-attendance", tags=["Time & Attendance"])
    app.include_router(hr.router, prefix="/api/hr", tags=["HR"])
    app.include_router(assets.router, prefix="/api/assets", tags=["Assets"])
    app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
    app.include_router(admin.router, prefix="/api/admin", tags=["Admin & Security"])
    app.include_router(reporting.router, prefix="/api/reporting", tags=["Reporting"])
    app.include_router(accounting.router, prefix="/api/accounting", tags=["Accounting"])
    app.include_router(production_planning.router, prefix="/api/production", tags=["Production Planning"])
    app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
    app.include_router(payroll.router, prefix="/api/payroll", tags=["Payroll"])
    app.include_router(pos.router, prefix="/api/pos", tags=["Point of Sale"])
    app.include_router(tooling.router, prefix="/api/tooling", tags=["Tooling & Consumables"])
    app.include_router(portal.router, prefix="/api/portal", tags=["Customer/Supplier Portal"])
    app.include_router(settings.router, prefix="/api/settings", tags=["System Settings"])
    app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
    app.include_router(backup.router, prefix="/api/backup", tags=["Backup & Restore"])
    app.include_router(imports.router, prefix="/api/import", tags=["Data Import"])
    logger.info("All routers registered successfully")
except Exception as e:
    logger.error(f"Error registering routers: {e}", exc_info=True)
    raise

@app.get("/")
def read_root():
    return {"message": "Wood ERP API", "status": "running"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/stats")
def get_dashboard_stats(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics with optional date filtering"""
    from sqlalchemy import func
    
    try:
        # Validate and parse dates with proper error handling
        if not end_date:
            end_date_obj = datetime.now()
        else:
            try:
                end_date_obj = datetime.strptime(end_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
        
        if not start_date:
            start_date_obj = end_date_obj - timedelta(days=30)
        else:
            try:
                start_date_obj = datetime.strptime(start_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
        
        # Validate date range
        if start_date_obj > end_date_obj:
            raise HTTPException(status_code=400, detail="start_date cannot be after end_date")
        
        # Limit date range to prevent performance issues (max 2 years)
        max_range = timedelta(days=730)
        if (end_date_obj - start_date_obj) > max_range:
            raise HTTPException(status_code=400, detail="Date range cannot exceed 2 years")
        
        # Base query with date filter (include end_date in range)
        date_filter = (models.SalesOrder.order_date >= start_date_obj) & (models.SalesOrder.order_date <= end_date_obj)
        
        # Products count
        products_count = db.query(func.count(models.Product.id)).scalar() or 0
        active_products_count = db.query(func.count(models.Product.id)).filter(
            models.Product.is_active == True
        ).scalar() or 0
        
        # Low stock items
        low_stock_count = db.query(func.count(models.InventoryItem.id)).filter(
            models.InventoryItem.quantity_on_hand <= models.InventoryItem.reorder_point
        ).scalar() or 0
        
        # Sales orders count (filtered by date)
        orders_count = db.query(func.count(models.SalesOrder.id)).filter(date_filter).scalar() or 0
        pending_orders = db.query(func.count(models.SalesOrder.id)).filter(
            models.SalesOrder.status != "Order Received"
        ).scalar() or 0
        
        # Total sales (filtered by date)
        total_sales_result = db.query(func.coalesce(func.sum(models.SalesOrder.grand_total), 0)).filter(
            date_filter
        ).scalar()
        total_sales = float(total_sales_result) if total_sales_result else 0.0
        
        # Sales by status
        sales_by_status = db.query(
            models.SalesOrder.status,
            func.count(models.SalesOrder.id).label('count'),
            func.coalesce(func.sum(models.SalesOrder.grand_total), 0).label('total')
        ).filter(date_filter).group_by(models.SalesOrder.status).all()
        
        # Sales over time (by day)
        sales_over_time = db.query(
            func.date(models.SalesOrder.order_date).label('date'),
            func.count(models.SalesOrder.id).label('count'),
            func.coalesce(func.sum(models.SalesOrder.grand_total), 0).label('total')
        ).filter(date_filter).group_by(func.date(models.SalesOrder.order_date)).order_by('date').all()
        
        # Products by category
        products_by_category = db.query(
            models.Product.category,
            func.count(models.Product.id).label('count')
        ).filter(
            models.Product.category.isnot(None),
            models.Product.category != ""
        ).group_by(models.Product.category).all()
        
        # Top selling products
        top_products = db.query(
            models.Product.name,
            models.Product.sku,
            func.sum(models.SalesOrderItem.quantity).label('total_quantity'),
            func.coalesce(func.sum(models.SalesOrderItem.line_total), 0).label('total_revenue')
        ).join(
            models.SalesOrderItem, models.SalesOrderItem.product_id == models.Product.id
        ).join(
            models.SalesOrder, models.SalesOrder.id == models.SalesOrderItem.order_id
        ).filter(date_filter).group_by(
            models.Product.id, models.Product.name, models.Product.sku
        ).order_by(func.sum(models.SalesOrderItem.line_total).desc()).limit(10).all()
        
        # Inventory value by location
        inventory_by_location = db.query(
            models.InventoryItem.location,
            func.sum(
                models.InventoryItem.quantity_on_hand * models.Product.cost
            ).label('total_value'),
            func.sum(models.InventoryItem.quantity_on_hand).label('total_quantity')
        ).join(
            models.Product, models.Product.id == models.InventoryItem.product_id
        ).group_by(models.InventoryItem.location).all()
        
        # Additional metrics
        # Average Order Value
        avg_order_value = total_sales / orders_count if orders_count > 0 else 0.0
        
        # Profit calculation (simplified: revenue - cost)
        # Cost = sum of (quantity sold * product cost)
        total_cost = db.query(func.coalesce(
            func.sum(models.SalesOrderItem.quantity * models.Product.cost), 0
        )).join(
            models.Product, models.Product.id == models.SalesOrderItem.product_id
        ).join(
            models.SalesOrder, models.SalesOrder.id == models.SalesOrderItem.order_id
        ).filter(date_filter).scalar() or 0.0
        
        gross_profit = total_sales - float(total_cost)
        profit_margin = (gross_profit / total_sales * 100) if total_sales > 0 else 0.0
        
        # Sales comparison (previous period)
        prev_start = start_date_obj - (end_date_obj - start_date_obj)
        prev_end = start_date_obj
        prev_sales = db.query(func.coalesce(func.sum(models.SalesOrder.grand_total), 0)).filter(
            models.SalesOrder.order_date >= prev_start,
            models.SalesOrder.order_date < prev_end
        ).scalar() or 0.0
        sales_growth = ((total_sales - float(prev_sales)) / float(prev_sales) * 100) if prev_sales > 0 else 0.0
        
        # Orders by day of week (extract day from datetime in Python after query)
        # Optimize: Use SQL functions instead of Python processing for better performance
        try:
            all_orders_dates = db.query(
                models.SalesOrder.order_date,
                models.SalesOrder.grand_total,
                models.SalesOrder.id
            ).filter(date_filter).all()
            
            # Group by day of week (0=Monday, 6=Sunday)
            day_stats = {}
            for order in all_orders_dates:
                if order.order_date:
                    day_num = order.order_date.weekday()  # 0=Monday, 6=Sunday
                    if day_num not in day_stats:
                        day_stats[day_num] = {'count': 0, 'total': 0.0}
                    day_stats[day_num]['count'] += 1
                    day_stats[day_num]['total'] += float(order.grand_total or 0)
            
            orders_by_day = [
                (day, day_stats[day]['count'], day_stats[day]['total'])
                for day in sorted(day_stats.keys())
            ]
            
            # Orders by hour
            hour_stats = {}
            for order in all_orders_dates:
                if order.order_date:
                    hour = order.order_date.hour
                    if hour not in hour_stats:
                        hour_stats[hour] = {'count': 0, 'total': 0.0}
                    hour_stats[hour]['count'] += 1
                    hour_stats[hour]['total'] += float(order.grand_total or 0)
            
            orders_by_hour = [
                (hour, hour_stats[hour]['count'], hour_stats[hour]['total'])
                for hour in sorted(hour_stats.keys())
            ]
        except Exception as e:
            logger.error(f"Error processing orders by day/hour: {e}", exc_info=True)
            orders_by_day = []
            orders_by_hour = []
        
        # Product velocity (fast/slow movers)
        product_velocity = db.query(
            models.Product.name,
            models.Product.sku,
            func.sum(models.SalesOrderItem.quantity).label('total_sold'),
            func.count(models.SalesOrder.id).label('order_count')
        ).join(
            models.SalesOrderItem, models.SalesOrderItem.product_id == models.Product.id
        ).join(
            models.SalesOrder, models.SalesOrder.id == models.SalesOrderItem.order_id
        ).filter(date_filter).group_by(
            models.Product.id, models.Product.name, models.Product.sku
        ).order_by(func.sum(models.SalesOrderItem.quantity).desc()).limit(20).all()
        
        # Inventory turnover calculation
        total_inventory_value = db.query(func.coalesce(
            func.sum(models.InventoryItem.quantity_on_hand * models.Product.cost), 0
        )).join(
            models.Product, models.Product.id == models.InventoryItem.product_id
        ).scalar() or 0.0
        
        inventory_turnover = (float(total_cost) / float(total_inventory_value)) if total_inventory_value > 0 else 0.0
        
        # Recent orders (last 10)
        recent_orders = db.query(models.SalesOrder).filter(
            date_filter
        ).order_by(models.SalesOrder.created_at.desc()).limit(10).all()
        
        # Orders by customer
        top_customers = db.query(
            models.SalesOrder.customer_name,
            func.count(models.SalesOrder.id).label('order_count'),
            func.coalesce(func.sum(models.SalesOrder.grand_total), 0).label('total_spent')
        ).filter(date_filter).group_by(
            models.SalesOrder.customer_name
        ).order_by(func.sum(models.SalesOrder.grand_total).desc()).limit(10).all()
        
        return {
        "products": products_count,
        "active_products": active_products_count,
        "low_stock": low_stock_count,
        "orders": orders_count,
        "pending_orders": pending_orders,
        "total_sales": total_sales,
        "avg_order_value": float(avg_order_value),
        "gross_profit": float(gross_profit),
        "profit_margin": float(profit_margin),
        "sales_growth": float(sales_growth),
        "inventory_turnover": float(inventory_turnover),
        "total_inventory_value": float(total_inventory_value),
        "sales_by_status": [
            {"status": s[0], "count": s[1], "total": float(s[2])}
            for s in sales_by_status
        ],
        # Normalize date values to string to avoid attribute errors from string dates in SQLite
        "sales_over_time": [
            {
                "date": s[0].isoformat() if hasattr(s[0], "isoformat") else str(s[0]),
                "count": s[1],
                "total": float(s[2])
            }
            for s in sales_over_time
        ],
        "products_by_category": [
            {"category": p[0], "count": p[1]}
            for p in products_by_category
        ],
        "top_products": [
            {"name": t[0], "sku": t[1], "quantity": float(t[2]), "revenue": float(t[3])}
            for t in top_products
        ],
        "inventory_by_location": [
            {"location": i[0], "value": float(i[1] or 0), "quantity": float(i[2] or 0)}
            for i in inventory_by_location
        ],
        "orders_by_day": [
            {
                "day": int(d[0]),
                "day_name": ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][int(d[0])] if 0 <= int(d[0]) < 7 else 'Unknown',
                "count": d[1],
                "total": float(d[2])
            }
            for d in orders_by_day if len(d) >= 3 and isinstance(d[0], (int, float))
        ],
        "orders_by_hour": [
            {"hour": int(h[0]), "count": h[1], "total": float(h[2]) if len(h) > 2 else 0.0}
            for h in orders_by_hour if len(h) >= 2 and isinstance(h[0], (int, float))
        ],
        "product_velocity": [
            {"name": v[0], "sku": v[1], "total_sold": float(v[2]), "order_count": v[3]}
            for v in product_velocity
        ],
        "top_customers": [
            {"customer": c[0], "orders": c[1], "total_spent": float(c[2])}
            for c in top_customers
        ],
        "recent_orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "customer": o.customer_name,
                "total": float(o.grand_total),
                "status": o.status,
                "date": o.order_date.isoformat()
            }
            for o in recent_orders
        ],
        "date_range": {
            "start": start_date_obj.isoformat(),
            "end": end_date_obj.isoformat()
        }
        }
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error in get_dashboard_stats: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error in get_dashboard_stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@app.get("/api/stats/overview")
def get_overview_stats(db: Session = Depends(get_db)):
    """Quick overview stats without date filtering"""
    from sqlalchemy import func
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        return {
            "products": db.query(func.count(models.Product.id)).scalar() or 0,
            "orders": db.query(func.count(models.SalesOrder.id)).scalar() or 0,
            "low_stock": db.query(func.count(models.InventoryItem.id)).filter(
                models.InventoryItem.quantity_on_hand <= models.InventoryItem.reorder_point
            ).scalar() or 0,
            "total_sales": float(
                db.query(func.coalesce(func.sum(models.SalesOrder.grand_total), 0)).scalar() or 0
            )
        }
    except SQLAlchemyError as e:
        logger.error(f"Database error in get_overview_stats: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error in get_overview_stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
