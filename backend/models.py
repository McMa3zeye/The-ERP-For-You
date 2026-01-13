from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

# Products & Pricing Module
class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    unit_of_measure = Column(String(20), default="pcs")  # pcs, kg, m, etc.
    category = Column(String(100), nullable=True)
    
    # Product type: Final, Sub-assembly, or Raw Material
    product_type = Column(String(50), default="Final")  # Final, Sub-assembly, Raw Material
    
    # Pricing
    base_price = Column(Float, default=0.0)
    cost = Column(Float, default=0.0)  # Cost to make/buy
    
    # Product flags
    is_active = Column(Boolean, default=True)
    is_tracked = Column(Boolean, default=True)  # Track inventory?
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    inventory_items = relationship("InventoryItem", back_populates="product")
    order_items = relationship("SalesOrderItem", back_populates="product")
    ingredients = relationship("ProductIngredient", foreign_keys="[ProductIngredient.product_id]", back_populates="product", cascade="all, delete-orphan", lazy="select")
    used_in = relationship("ProductIngredient", foreign_keys="[ProductIngredient.ingredient_id]", back_populates="ingredient", lazy="select")

# BOM / Product Ingredients (Materials used in products)
class ProductIngredient(Base):
    __tablename__ = "product_ingredients"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)  # The product that uses this ingredient
    ingredient_id = Column(Integer, ForeignKey("products.id"), nullable=False)  # The material/ingredient being used
    quantity = Column(Float, nullable=False, default=1.0)  # How much of this ingredient is needed per unit of product
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    product = relationship("Product", foreign_keys=[product_id], back_populates="ingredients")
    ingredient = relationship("Product", foreign_keys=[ingredient_id], back_populates="used_in")

# Inventory Module
class InventoryItem(Base):
    __tablename__ = "inventory_items"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location = Column(String(100), default="main_warehouse")  # warehouse/aisle/bin
    quantity_on_hand = Column(Float, default=0.0)
    quantity_reserved = Column(Float, default=0.0)  # Reserved for orders
    quantity_available = Column(Float, default=0.0)  # on_hand - reserved
    
    # Reorder settings
    reorder_point = Column(Float, default=0.0)
    reorder_quantity = Column(Float, default=0.0)
    
    # Metadata
    last_counted = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    product = relationship("Product", back_populates="inventory_items")
    movements = relationship("InventoryMovement", back_populates="inventory_item")

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    
    id = Column(Integer, primary_key=True, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    movement_type = Column(String(50), nullable=False)  # IN, OUT, ADJUST, TRANSFER
    quantity = Column(Float, nullable=False)
    reference_type = Column(String(50), nullable=True)  # SALES_ORDER, PURCHASE, ADJUSTMENT
    reference_id = Column(Integer, nullable=True)  # ID of related document
    notes = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(100), nullable=True)
    
    # Relationships
    inventory_item = relationship("InventoryItem", back_populates="movements")

# Sales Orders Module
class SalesOrder(Base):
    __tablename__ = "sales_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)  # Optional for backward compatibility
    customer_name = Column(String(255), nullable=False)  # Keep for backward compatibility, auto-filled from customer if customer_id exists
    customer_email = Column(String(255), nullable=True)
    customer_address = Column(Text, nullable=True)
    
    # Order details
    order_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(50), default="Order Created")  # Order Created, Order Accepted, Ready for Production, In Production, Finished Production, Order Shipped, Order Received
    total_amount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    grand_total = Column(Float, default=0.0)
    
    # Shipping
    shipping_address = Column(Text, nullable=True)
    shipping_method = Column(String(100), nullable=True)
    
    # Metadata
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    
    # Relationships
    customer = relationship("Customer", back_populates="orders")
    items = relationship("SalesOrderItem", back_populates="order", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="sales_order")
    work_orders = relationship("WorkOrder", back_populates="sales_order")

class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    discount_percent = Column(Float, default=0.0)
    line_total = Column(Float, nullable=False)
    
    # Metadata
    notes = Column(Text, nullable=True)
    
    # Relationships
    order = relationship("SalesOrder", back_populates="items")
    product = relationship("Product", back_populates="order_items")

# Customers Module
class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    siret = Column(String(50), nullable=True)  # French tax identification number
    contact_name = Column(String(255), nullable=True)  # Contact person name
    commentary = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    orders = relationship("SalesOrder", back_populates="customer", cascade="all, delete-orphan")
    quotes = relationship("Quote", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")

# Quotes Module
class Quote(Base):
    __tablename__ = "quotes"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=True)
    customer_address = Column(Text, nullable=True)
    
    quote_date = Column(DateTime(timezone=True), server_default=func.now())
    valid_until = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="Draft")  # Draft, Sent, Accepted, Rejected, Expired
    total_amount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    grand_total = Column(Float, default=0.0)
    
    notes = Column(Text, nullable=True)
    terms_conditions = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    
    # Relationships
    customer = relationship("Customer", back_populates="quotes")
    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")

class QuoteItem(Base):
    __tablename__ = "quote_items"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    discount_percent = Column(Float, default=0.0)
    line_total = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    
    # Relationships
    quote = relationship("Quote", back_populates="items")
    product = relationship("Product")

# Invoicing Module
class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=True)
    customer_address = Column(Text, nullable=True)
    
    invoice_date = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="Draft")  # Draft, Sent, Paid, Partially Paid, Void, Overdue
    total_amount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    grand_total = Column(Float, default=0.0)
    amount_paid = Column(Float, default=0.0)
    amount_due = Column(Float, default=0.0)
    
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=True)
    payment_terms = Column(String(100), nullable=True)  # Net 30, Due on Receipt, etc.
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    
    # Relationships
    customer = relationship("Customer", back_populates="invoices")
    sales_order = relationship("SalesOrder", foreign_keys=[sales_order_id], back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice")

class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    description = Column(String(255), nullable=True)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    discount_percent = Column(Float, default=0.0)
    line_total = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    
    # Relationships
    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product")

# Payments Module
class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String(50), unique=True, nullable=False, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    
    payment_date = Column(DateTime(timezone=True), server_default=func.now())
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50), default="Cash")  # Cash, Card, Bank Transfer, Check
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(100), nullable=True)
    
    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
    customer = relationship("Customer")

# Suppliers Module
class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    supplier_code = Column(String(100), unique=True, nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    contact_name = Column(String(255), nullable=True)
    payment_terms = Column(String(100), nullable=True)
    lead_time_days = Column(Integer, default=0)
    rating = Column(Float, default=0.0)  # 0-5 rating
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")

# Purchasing Module
class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(50), unique=True, nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    
    order_date = Column(DateTime(timezone=True), server_default=func.now())
    expected_delivery_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="Draft")  # Draft, Sent, Confirmed, Received, Cancelled
    total_amount = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    grand_total = Column(Float, default=0.0)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    
    # Relationships
    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan")

class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    received_quantity = Column(Float, default=0.0)
    line_total = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    
    # Relationships
    order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")

# Work Orders Module
class WorkOrder(Base):
    __tablename__ = "work_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    wo_number = Column(String(50), unique=True, nullable=False, index=True)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    start_date = Column(DateTime(timezone=True), nullable=True)
    finish_date = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="Created")  # Created, In Progress, On Hold, Completed, Cancelled
    quantity = Column(Float, nullable=False)
    completed_quantity = Column(Float, default=0.0)
    priority = Column(String(20), default="Normal")  # Low, Normal, High, Urgent
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    
    # Relationships
    sales_order = relationship("SalesOrder", foreign_keys=[sales_order_id], back_populates="work_orders")
    product = relationship("Product")

# Expenses Module
class Expense(Base):
    __tablename__ = "expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    expense_number = Column(String(50), unique=True, nullable=False, index=True)
    category = Column(String(100), nullable=True)  # Travel, Supplies, Utilities, etc.
    description = Column(Text, nullable=False)
    amount = Column(Float, nullable=False)
    expense_date = Column(DateTime(timezone=True), server_default=func.now())
    payment_method = Column(String(50), default="Cash")
    status = Column(String(50), default="Pending")  # Pending, Approved, Reimbursed, Rejected
    vendor = Column(String(255), nullable=True)
    receipt_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=True)

# Projects Module
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    project_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    status = Column(String(50), default="Planning")  # Planning, Active, On Hold, Completed, Cancelled
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    budget = Column(Float, default=0.0)
    actual_cost = Column(Float, default=0.0)
    owner = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    
    # Relationships
    customer = relationship("Customer")
    tasks = relationship("ProjectTask", back_populates="project", cascade="all, delete-orphan")

class ProjectTask(Base):
    __tablename__ = "project_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    task_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="Not Started")  # Not Started, In Progress, Completed, Blocked
    priority = Column(String(20), default="Normal")
    due_date = Column(DateTime(timezone=True), nullable=True)
    assigned_to = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="tasks")

# Support Tickets Module
class SupportTicket(Base):
    __tablename__ = "support_tickets"
    
    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)  # Technical, Billing, General, etc.
    priority = Column(String(20), default="Medium")  # Low, Medium, High, Urgent
    status = Column(String(50), default="Open")  # Open, In Progress, Resolved, Closed
    assigned_to = Column(String(100), nullable=True)
    resolution = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    
    # Relationships
    customer = relationship("Customer")

# Leads & Sales Pipeline Module
class Lead(Base):
    __tablename__ = "leads"
    
    id = Column(Integer, primary_key=True, index=True)
    lead_number = Column(String(50), unique=True, nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    source = Column(String(100), nullable=True)
    status = Column(String(50), default="New")
    stage = Column(String(50), default="Lead")
    estimated_value = Column(Float, default=0.0)
    probability = Column(Integer, default=0)
    expected_close_date = Column(DateTime(timezone=True), nullable=True)
    assigned_to = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# Warehousing Module
class WarehouseLocation(Base):
    __tablename__ = "warehouse_locations"
    
    id = Column(Integer, primary_key=True, index=True)
    location_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    warehouse = Column(String(100), nullable=True)
    zone = Column(String(50), nullable=True)
    aisle = Column(String(20), nullable=True)
    rack = Column(String(20), nullable=True)
    bin = Column(String(20), nullable=True)
    location_type = Column(String(50), default="Storage")
    capacity = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# Manufacturing (BOM) Module
class BillOfMaterials(Base):
    __tablename__ = "bill_of_materials"
    
    id = Column(Integer, primary_key=True, index=True)
    bom_number = Column(String(50), unique=True, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    version = Column(String(20), default="1.0")
    status = Column(String(50), default="Draft")
    effective_date = Column(DateTime(timezone=True), nullable=True)
    quantity = Column(Float, default=1.0)
    labor_hours = Column(Float, default=0.0)
    labor_cost = Column(Float, default=0.0)
    overhead_cost = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    product = relationship("Product")
    components = relationship("BOMComponent", back_populates="bom", cascade="all, delete-orphan")

class BOMComponent(Base):
    __tablename__ = "bom_components"
    
    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("bill_of_materials.id"), nullable=False)
    component_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_of_measure = Column(String(20), default="pcs")
    scrap_rate = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    
    bom = relationship("BillOfMaterials", back_populates="components")
    component = relationship("Product")

# Quality Module
class QualityInspection(Base):
    __tablename__ = "quality_inspections"
    
    id = Column(Integer, primary_key=True, index=True)
    inspection_number = Column(String(50), unique=True, nullable=False, index=True)
    inspection_type = Column(String(50), default="Incoming")
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    quantity_inspected = Column(Float, default=0.0)
    quantity_passed = Column(Float, default=0.0)
    quantity_failed = Column(Float, default=0.0)
    status = Column(String(50), default="Pending")
    inspector = Column(String(100), nullable=True)
    inspection_date = Column(DateTime(timezone=True), server_default=func.now())
    result_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    product = relationship("Product")

# Shipping & Delivery Module
class Shipment(Base):
    __tablename__ = "shipments"
    
    id = Column(Integer, primary_key=True, index=True)
    shipment_number = Column(String(50), unique=True, nullable=False, index=True)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=True)
    carrier = Column(String(100), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    ship_date = Column(DateTime(timezone=True), nullable=True)
    expected_delivery_date = Column(DateTime(timezone=True), nullable=True)
    actual_delivery_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="Pending")
    shipping_cost = Column(Float, default=0.0)
    weight = Column(Float, default=0.0)
    dimensions = Column(String(100), nullable=True)
    ship_from = Column(Text, nullable=True)
    ship_to = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    sales_order = relationship("SalesOrder")

# Returns & RMA Module
class ReturnOrder(Base):
    __tablename__ = "return_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    rma_number = Column(String(50), unique=True, nullable=False, index=True)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    return_date = Column(DateTime(timezone=True), server_default=func.now())
    reason = Column(String(100), nullable=True)
    status = Column(String(50), default="Requested")
    disposition = Column(String(50), nullable=True)
    refund_amount = Column(Float, default=0.0)
    restocking_fee = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    sales_order = relationship("SalesOrder")
    customer = relationship("Customer")
    items = relationship("ReturnOrderItem", back_populates="return_order", cascade="all, delete-orphan")

class ReturnOrderItem(Base):
    __tablename__ = "return_order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    return_order_id = Column(Integer, ForeignKey("return_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    reason = Column(String(100), nullable=True)
    condition = Column(String(50), nullable=True)
    
    return_order = relationship("ReturnOrder", back_populates="items")
    product = relationship("Product")

# Time & Attendance Module
class TimeEntry(Base):
    __tablename__ = "time_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    entry_number = Column(String(50), unique=True, nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    employee_name = Column(String(255), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
    clock_in = Column(DateTime(timezone=True), nullable=True)
    clock_out = Column(DateTime(timezone=True), nullable=True)
    hours_worked = Column(Float, default=0.0)
    overtime_hours = Column(Float, default=0.0)
    break_duration = Column(Float, default=0.0)
    entry_type = Column(String(50), default="Regular")
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="Draft")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# HR / Employee Module
class Employee(Base):
    __tablename__ = "employees"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_number = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True)
    job_title = Column(String(100), nullable=True)
    hire_date = Column(DateTime(timezone=True), nullable=True)
    termination_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="Active")
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    hourly_rate = Column(Float, default=0.0)
    salary = Column(Float, default=0.0)
    address = Column(Text, nullable=True)
    emergency_contact = Column(String(255), nullable=True)
    emergency_phone = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# Assets & Maintenance Module
class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_number = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    manufacturer = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    purchase_date = Column(DateTime(timezone=True), nullable=True)
    purchase_cost = Column(Float, default=0.0)
    current_value = Column(Float, default=0.0)
    warranty_expiry = Column(DateTime(timezone=True), nullable=True)
    location = Column(String(100), nullable=True)
    assigned_to = Column(String(100), nullable=True)
    status = Column(String(50), default="Active")
    last_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    next_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# =====================================================
# ADMIN & SECURITY MODULE
# =====================================================

# Association table for User-Role many-to-many relationship
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('role_id', Integer, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True)
)

# Association table for Role-Permission many-to-many relationship
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', Integer, ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    Column('permission_id', Integer, ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True)
)


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    must_change_password = Column(Boolean, default=False)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(100), nullable=True)
    preferences = Column(Text, nullable=True)  # JSON string for user preferences
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False)  # System roles cannot be deleted
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    users = relationship("User", secondary=user_roles, back_populates="roles")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)  # e.g., 'products.create', 'orders.delete'
    module = Column(String(100), nullable=False)  # e.g., 'products', 'orders', 'admin'
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    device_info = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)  # sha256 hex
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    request_ip = Column(String(50), nullable=True)

    user = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)  # e.g., 'create', 'update', 'delete', 'login', 'logout'
    module = Column(String(100), nullable=False)  # e.g., 'products', 'orders', 'auth'
    entity_type = Column(String(100), nullable=True)  # e.g., 'Product', 'SalesOrder'
    entity_id = Column(Integer, nullable=True)
    entity_name = Column(String(255), nullable=True)  # Human-readable identifier
    old_values = Column(Text, nullable=True)  # JSON string of old values
    new_values = Column(Text, nullable=True)  # JSON string of new values
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    status = Column(String(50), default="success")  # success, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")


class SystemSetting(Base):
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    value_type = Column(String(50), default="string")  # string, number, boolean, json
    category = Column(String(100), default="general")  # general, security, email, etc.
    description = Column(Text, nullable=True)
    is_sensitive = Column(Boolean, default=False)  # Hide value in UI
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# =====================================================
# REPORTING MODULE
# =====================================================

class ReportTemplate(Base):
    __tablename__ = "report_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    module = Column(String(100), nullable=False)  # e.g., 'sales', 'inventory', 'finance'
    report_type = Column(String(50), default="table")  # table, chart, summary, detailed
    query_config = Column(Text, nullable=True)  # JSON: data source, fields, joins
    filter_config = Column(Text, nullable=True)  # JSON: available filters
    column_config = Column(Text, nullable=True)  # JSON: column definitions
    chart_config = Column(Text, nullable=True)  # JSON: chart options if applicable
    grouping_config = Column(Text, nullable=True)  # JSON: grouping/aggregation settings
    sorting_config = Column(Text, nullable=True)  # JSON: default sorting
    is_system = Column(Boolean, default=False)  # System reports cannot be deleted
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    saved_reports = relationship("SavedReport", back_populates="template", cascade="all, delete-orphan")


class SavedReport(Base):
    __tablename__ = "saved_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("report_templates.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    filters_applied = Column(Text, nullable=True)  # JSON: filter values applied
    columns_selected = Column(Text, nullable=True)  # JSON: selected columns
    grouping_applied = Column(Text, nullable=True)  # JSON: grouping settings
    sorting_applied = Column(Text, nullable=True)  # JSON: sorting settings
    is_favorite = Column(Boolean, default=False)
    is_shared = Column(Boolean, default=False)
    share_with_roles = Column(Text, nullable=True)  # JSON: list of role IDs
    schedule_enabled = Column(Boolean, default=False)
    schedule_cron = Column(String(100), nullable=True)  # Cron expression for scheduling
    schedule_recipients = Column(Text, nullable=True)  # JSON: email addresses
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    template = relationship("ReportTemplate", back_populates="saved_reports")
    executions = relationship("ReportExecution", back_populates="saved_report", cascade="all, delete-orphan")


class ReportExecution(Base):
    __tablename__ = "report_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    saved_report_id = Column(Integer, ForeignKey("saved_reports.id", ondelete="CASCADE"), nullable=True)
    template_id = Column(Integer, ForeignKey("report_templates.id", ondelete="SET NULL"), nullable=True)
    executed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    execution_type = Column(String(50), default="manual")  # manual, scheduled, api
    status = Column(String(50), default="pending")  # pending, running, completed, failed
    filters_used = Column(Text, nullable=True)  # JSON: filters at time of execution
    row_count = Column(Integer, nullable=True)
    file_path = Column(String(500), nullable=True)  # Path to exported file if any
    file_format = Column(String(50), nullable=True)  # csv, xlsx, pdf
    error_message = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)  # Execution duration in milliseconds
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    saved_report = relationship("SavedReport", back_populates="executions")


# =====================================================
# ACCOUNTING / GENERAL LEDGER MODULE
# =====================================================

class ChartOfAccount(Base):
    __tablename__ = "chart_of_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    account_number = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    account_type = Column(String(50), nullable=False)  # asset, liability, equity, revenue, expense
    parent_id = Column(Integer, ForeignKey("chart_of_accounts.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)  # System accounts cannot be deleted
    current_balance = Column(Float, default=0.0)
    normal_balance = Column(String(10), default="debit")  # debit or credit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    children = relationship("ChartOfAccount", backref="parent", remote_side=[id])
    journal_lines = relationship("JournalEntryLine", back_populates="account")


class FiscalPeriod(Base):
    __tablename__ = "fiscal_periods"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    period_type = Column(String(50), default="month")  # month, quarter, year
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    is_closed = Column(Boolean, default=False)
    closed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    entry_number = Column(String(50), unique=True, nullable=False, index=True)
    entry_date = Column(DateTime(timezone=True), nullable=False)
    description = Column(Text, nullable=True)
    reference = Column(String(255), nullable=True)  # Invoice #, Payment #, etc.
    entry_type = Column(String(50), default="manual")  # manual, auto, adjustment, closing
    source_module = Column(String(100), nullable=True)  # invoicing, payments, payroll, etc.
    source_id = Column(Integer, nullable=True)
    status = Column(String(50), default="draft")  # draft, posted, reversed
    total_debit = Column(Float, default=0.0)
    total_credit = Column(Float, default=0.0)
    fiscal_period_id = Column(Integer, ForeignKey("fiscal_periods.id", ondelete="SET NULL"), nullable=True)
    posted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    reversed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reversed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    lines = relationship("JournalEntryLine", back_populates="journal_entry", cascade="all, delete-orphan")


class JournalEntryLine(Base):
    __tablename__ = "journal_entry_lines"
    
    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("chart_of_accounts.id", ondelete="RESTRICT"), nullable=False)
    description = Column(String(255), nullable=True)
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)
    
    # Relationships
    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("ChartOfAccount", back_populates="journal_lines")


# =====================================================
# PRODUCTION PLANNING & SCHEDULING MODULE
# =====================================================

class ProductionResource(Base):
    __tablename__ = "production_resources"
    
    id = Column(Integer, primary_key=True, index=True)
    resource_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    resource_type = Column(String(100), nullable=False)  # machine, workstation, labor, tool
    description = Column(Text, nullable=True)
    location = Column(String(100), nullable=True)
    capacity_per_hour = Column(Float, default=1.0)
    hourly_cost = Column(Float, default=0.0)
    is_available = Column(Boolean, default=True)
    maintenance_schedule = Column(Text, nullable=True)  # JSON for maintenance windows
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    schedules = relationship("ProductionSchedule", back_populates="resource")


class ProductionSchedule(Base):
    __tablename__ = "production_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    schedule_number = Column(String(50), unique=True, nullable=False, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=True)
    resource_id = Column(Integer, ForeignKey("production_resources.id", ondelete="SET NULL"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_start = Column(DateTime(timezone=True), nullable=False)
    scheduled_end = Column(DateTime(timezone=True), nullable=False)
    actual_start = Column(DateTime(timezone=True), nullable=True)
    actual_end = Column(DateTime(timezone=True), nullable=True)
    quantity_planned = Column(Float, default=1.0)
    quantity_completed = Column(Float, default=0.0)
    priority = Column(Integer, default=5)  # 1-10, 1 is highest
    status = Column(String(50), default="scheduled")  # scheduled, in_progress, completed, cancelled, delayed
    color = Column(String(20), nullable=True)  # For calendar display
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    resource = relationship("ProductionResource", back_populates="schedules")
    work_order = relationship("WorkOrder")
    product = relationship("Product")


# =====================================================
# DOCUMENT MANAGEMENT MODULE
# =====================================================

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    document_number = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # blueprint, design, manual, contract, invoice, photo
    file_type = Column(String(50), nullable=True)  # pdf, dwg, svg, jpg, etc.
    file_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)  # bytes
    mime_type = Column(String(100), nullable=True)
    current_version = Column(Integer, default=1)
    linked_entity_type = Column(String(100), nullable=True)  # product, work_order, project, customer, etc.
    linked_entity_id = Column(Integer, nullable=True)
    tags = Column(Text, nullable=True)  # JSON array of tags
    is_archived = Column(Boolean, default=False)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    change_notes = Column(Text, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document", back_populates="versions")


# =====================================================
# PAYROLL MODULE
# =====================================================

class PayrollPeriod(Base):
    __tablename__ = "payroll_periods"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    period_type = Column(String(50), default="biweekly")  # weekly, biweekly, monthly
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    pay_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="open")  # open, processing, closed, paid
    total_gross = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    total_net = Column(Float, default=0.0)
    processed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    payslips = relationship("Payslip", back_populates="period", cascade="all, delete-orphan")


class Payslip(Base):
    __tablename__ = "payslips"
    
    id = Column(Integer, primary_key=True, index=True)
    payslip_number = Column(String(50), unique=True, nullable=False, index=True)
    period_id = Column(Integer, ForeignKey("payroll_periods.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    regular_hours = Column(Float, default=0.0)
    overtime_hours = Column(Float, default=0.0)
    hourly_rate = Column(Float, default=0.0)
    regular_pay = Column(Float, default=0.0)
    overtime_pay = Column(Float, default=0.0)
    bonus = Column(Float, default=0.0)
    commission = Column(Float, default=0.0)
    gross_pay = Column(Float, default=0.0)
    tax_deduction = Column(Float, default=0.0)
    insurance_deduction = Column(Float, default=0.0)
    retirement_deduction = Column(Float, default=0.0)
    other_deductions = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    net_pay = Column(Float, default=0.0)
    status = Column(String(50), default="draft")  # draft, approved, paid, cancelled
    payment_method = Column(String(50), nullable=True)  # direct_deposit, check, cash
    payment_reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    period = relationship("PayrollPeriod", back_populates="payslips")
    employee = relationship("Employee")
    lines = relationship("PayslipLine", back_populates="payslip", cascade="all, delete-orphan")


class PayslipLine(Base):
    __tablename__ = "payslip_lines"
    
    id = Column(Integer, primary_key=True, index=True)
    payslip_id = Column(Integer, ForeignKey("payslips.id", ondelete="CASCADE"), nullable=False)
    line_type = Column(String(50), nullable=False)  # earning, deduction, tax, benefit
    code = Column(String(50), nullable=True)  # REG, OT, FED_TAX, etc.
    description = Column(String(255), nullable=False)
    hours = Column(Float, nullable=True)
    rate = Column(Float, nullable=True)
    amount = Column(Float, default=0.0)
    is_taxable = Column(Boolean, default=True)
    
    # Relationships
    payslip = relationship("Payslip", back_populates="lines")


# =====================================================
# POINT OF SALE (POS) MODULE
# =====================================================

class POSTerminal(Base):
    __tablename__ = "pos_terminals"
    
    id = Column(Integer, primary_key=True, index=True)
    terminal_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    last_session_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class POSSession(Base):
    __tablename__ = "pos_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_number = Column(String(50), unique=True, nullable=False, index=True)
    terminal_id = Column(Integer, ForeignKey("pos_terminals.id", ondelete="SET NULL"), nullable=True)
    opened_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    closed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)
    opening_balance = Column(Float, default=0.0)
    closing_balance = Column(Float, nullable=True)
    expected_balance = Column(Float, nullable=True)
    cash_difference = Column(Float, nullable=True)
    total_sales = Column(Float, default=0.0)
    total_returns = Column(Float, default=0.0)
    total_cash = Column(Float, default=0.0)
    total_card = Column(Float, default=0.0)
    transaction_count = Column(Integer, default=0)
    status = Column(String(50), default="open")  # open, closing, closed
    notes = Column(Text, nullable=True)
    
    # Relationships
    transactions = relationship("POSTransaction", back_populates="session")


class POSTransaction(Base):
    __tablename__ = "pos_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_number = Column(String(50), unique=True, nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("pos_sessions.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_name = Column(String(255), nullable=True)
    transaction_type = Column(String(50), default="sale")  # sale, return, exchange
    subtotal = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    amount_tendered = Column(Float, default=0.0)
    change_given = Column(Float, default=0.0)
    payment_method = Column(String(50), default="cash")  # cash, card, split
    card_last_four = Column(String(4), nullable=True)
    status = Column(String(50), default="completed")  # pending, completed, voided, refunded
    cashier_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    session = relationship("POSSession", back_populates="transactions")
    items = relationship("POSTransactionItem", back_populates="transaction", cascade="all, delete-orphan")


class POSTransactionItem(Base):
    __tablename__ = "pos_transaction_items"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("pos_transactions.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name = Column(String(255), nullable=False)
    sku = Column(String(100), nullable=True)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    discount_percent = Column(Float, default=0.0)
    tax_percent = Column(Float, default=0.0)
    line_total = Column(Float, default=0.0)
    
    # Relationships
    transaction = relationship("POSTransaction", back_populates="items")


# =====================================================
# TOOLING & CONSUMABLES MODULE
# =====================================================

class Tool(Base):
    __tablename__ = "tools"
    
    id = Column(Integer, primary_key=True, index=True)
    tool_number = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)  # saw_blade, router_bit, drill_bit, sandpaper_disc, etc.
    brand = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    size = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    location = Column(String(100), nullable=True)
    assigned_to_resource = Column(Integer, ForeignKey("production_resources.id", ondelete="SET NULL"), nullable=True)
    purchase_date = Column(DateTime(timezone=True), nullable=True)
    purchase_cost = Column(Float, default=0.0)
    lifespan_hours = Column(Float, nullable=True)  # Expected lifespan in hours
    lifespan_units = Column(Float, nullable=True)  # Expected lifespan in units produced
    hours_used = Column(Float, default=0.0)
    units_produced = Column(Float, default=0.0)
    last_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    next_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="available")  # available, in_use, maintenance, retired
    condition = Column(String(50), default="good")  # new, good, fair, poor, worn
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    maintenance_logs = relationship("ToolMaintenanceLog", back_populates="tool", cascade="all, delete-orphan")


class ToolMaintenanceLog(Base):
    __tablename__ = "tool_maintenance_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    tool_id = Column(Integer, ForeignKey("tools.id", ondelete="CASCADE"), nullable=False)
    maintenance_type = Column(String(100), nullable=False)  # sharpening, cleaning, repair, replacement, inspection
    maintenance_date = Column(DateTime(timezone=True), server_default=func.now())
    performed_by = Column(String(100), nullable=True)
    cost = Column(Float, default=0.0)
    hours_at_maintenance = Column(Float, nullable=True)
    condition_before = Column(String(50), nullable=True)
    condition_after = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    next_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    tool = relationship("Tool", back_populates="maintenance_logs")


class Consumable(Base):
    __tablename__ = "consumables"
    
    id = Column(Integer, primary_key=True, index=True)
    consumable_number = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)  # sandpaper, glue, finish, screws, nails, etc.
    brand = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    unit_of_measure = Column(String(50), default="pcs")  # pcs, sheets, liters, kg, box
    quantity_on_hand = Column(Float, default=0.0)
    quantity_reserved = Column(Float, default=0.0)
    reorder_point = Column(Float, default=10.0)
    reorder_quantity = Column(Float, default=50.0)
    unit_cost = Column(Float, default=0.0)
    location = Column(String(100), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    supplier_sku = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    usage_logs = relationship("ConsumableUsage", back_populates="consumable")


class ConsumableUsage(Base):
    __tablename__ = "consumable_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    consumable_id = Column(Integer, ForeignKey("consumables.id", ondelete="CASCADE"), nullable=False)
    quantity_used = Column(Float, nullable=False)
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    used_by = Column(String(100), nullable=True)
    usage_date = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text, nullable=True)
    
    # Relationships
    consumable = relationship("Consumable", back_populates="usage_logs")


# =====================================================
# CUSTOMER/SUPPLIER PORTAL MODULE
# =====================================================

class PortalUser(Base):
    __tablename__ = "portal_users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    user_type = Column(String(50), nullable=False)  # customer, supplier
    linked_customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=True)
    linked_supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    notification_preferences = Column(Text, nullable=True)  # JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    messages = relationship("PortalMessage", back_populates="portal_user", cascade="all, delete-orphan")
    sessions = relationship("PortalSession", back_populates="portal_user", cascade="all, delete-orphan")


class PortalSession(Base):
    __tablename__ = "portal_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    portal_user_id = Column(Integer, ForeignKey("portal_users.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    portal_user = relationship("PortalUser", back_populates="sessions")


class PortalMessage(Base):
    __tablename__ = "portal_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    portal_user_id = Column(Integer, ForeignKey("portal_users.id", ondelete="CASCADE"), nullable=False)
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    direction = Column(String(20), nullable=False)  # inbound (from portal user), outbound (to portal user)
    related_entity_type = Column(String(100), nullable=True)  # sales_order, invoice, purchase_order
    related_entity_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    replied_to_id = Column(Integer, ForeignKey("portal_messages.id", ondelete="SET NULL"), nullable=True)
    sent_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # For outbound messages
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    portal_user = relationship("PortalUser", back_populates="messages")


class PortalNotification(Base):
    __tablename__ = "portal_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    portal_user_id = Column(Integer, ForeignKey("portal_users.id", ondelete="CASCADE"), nullable=False)
    notification_type = Column(String(100), nullable=False)  # order_status, invoice_due, shipment_update
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    related_entity_type = Column(String(100), nullable=True)
    related_entity_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
