from __future__ import annotations  # Enable postponed evaluation of annotations
from pydantic import BaseModel, Field
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

# Products & Pricing Schemas
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    unit_of_measure: str = "pcs"
    category: str = "Raw Material"
    currency_code: str = "USD"
    product_type: str = "Goods"  # Goods, service, both
    base_price: float = 0.0
    cost: float = 0.0
    is_active: bool = True
    is_tracked: bool = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unit_of_measure: Optional[str] = None
    category: Optional[str] = None
    currency_code: Optional[str] = None
    product_type: Optional[str] = None
    base_price: Optional[float] = None
    cost: Optional[float] = None
    is_active: Optional[bool] = None
    is_tracked: Optional[bool] = None

class Product(ProductBase):
    id: int
    sku: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ProductList(BaseModel):
    items: List[Product]
    total: int
    skip: int
    limit: int

# Product Ingredients (BOM) - defined after Product to avoid circular reference
class ProductIngredientBase(BaseModel):
    ingredient_id: int
    quantity: float = 1.0

class ProductIngredientCreate(ProductIngredientBase):
    pass

class ProductIngredient(ProductIngredientBase):
    id: int
    product_id: int
    created_at: datetime
    ingredient: Optional[Product] = None
    
    class Config:
        from_attributes = True

# Inventory Schemas
class InventoryItemBase(BaseModel):
    product_id: int
    location: str = "main_warehouse"
    quantity_on_hand: float = 0.0
    reorder_point: float = 0.0
    reorder_quantity: float = 0.0

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemUpdate(BaseModel):
    location: Optional[str] = None
    quantity_on_hand: Optional[float] = None
    reorder_point: Optional[float] = None
    reorder_quantity: Optional[float] = None

class InventoryItem(InventoryItemBase):
    id: int
    quantity_reserved: float
    quantity_available: float
    last_counted: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    product: Optional[Product] = None
    
    class Config:
        from_attributes = True

class InventoryMovementBase(BaseModel):
    inventory_item_id: int
    movement_type: str  # IN, OUT, ADJUST, TRANSFER
    quantity: float
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    notes: Optional[str] = None

class InventoryMovementCreate(InventoryMovementBase):
    pass

class InventoryMovement(InventoryMovementBase):
    id: int
    created_at: datetime
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True

# Sales Orders Schemas
class SalesOrderItemBase(BaseModel):
    product_id: int
    quantity: float
    unit_price: float
    discount_percent: float = 0.0
    notes: Optional[str] = None

class SalesOrderItemCreate(SalesOrderItemBase):
    pass

class SalesOrderItem(SalesOrderItemBase):
    id: int
    order_id: int
    line_total: float
    product: Optional[Product] = None
    
    class Config:
        from_attributes = True

class SalesOrderBase(BaseModel):
    customer_id: Optional[int] = None  # Use customer_id if available, otherwise fallback to customer_name
    customer_name: Optional[str] = None  # Required only if customer_id is not provided
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    shipping_address: Optional[str] = None
    shipping_method: Optional[str] = None
    status: str = "Order Created"
    notes: Optional[str] = None

class SalesOrderCreate(SalesOrderBase):
    items: List[SalesOrderItemCreate] = []

class SalesOrderUpdate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    shipping_address: Optional[str] = None
    shipping_method: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class SalesOrder(SalesOrderBase):
    id: int
    order_number: str
    order_date: datetime
    total_amount: float
    tax_amount: float
    grand_total: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    items: List[SalesOrderItem] = []
    # Customer is defined later, so we use forward reference
    customer: Optional["Customer"] = None
    
    class Config:
        from_attributes = True
        # Enable model rebuild to resolve forward references
        populate_by_name = True

class SalesOrderList(BaseModel):
    items: List[SalesOrder]
    total: int
    skip: int
    limit: int
    
    class Config:
        from_attributes = True

# Customers Schemas
class CustomerBase(BaseModel):
    company_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    siret: Optional[str] = None
    contact_name: Optional[str] = None
    commentary: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    siret: Optional[str] = None
    contact_name: Optional[str] = None
    commentary: Optional[str] = None

class Customer(CustomerBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class CustomerList(BaseModel):
    items: List[Customer]
    total: int
    skip: int
    limit: int
    
    class Config:
        from_attributes = True

# Quotes Schemas
class QuoteItemBase(BaseModel):
    product_id: int
    quantity: float
    unit_price: float
    discount_percent: float = 0.0
    notes: Optional[str] = None

class QuoteItemCreate(QuoteItemBase):
    pass

class QuoteItem(QuoteItemBase):
    id: int
    quote_id: int
    line_total: float
    product: Optional[Product] = None
    
    class Config:
        from_attributes = True

class QuoteBase(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    valid_until: Optional[datetime] = None
    status: str = "Draft"
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None

class QuoteCreate(QuoteBase):
    items: List[QuoteItemCreate] = []

class QuoteUpdate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    status: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None

class Quote(QuoteBase):
    id: int
    quote_number: str
    quote_date: datetime
    total_amount: float
    tax_amount: float
    grand_total: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[QuoteItem] = []
    customer: Optional[Customer] = None
    
    class Config:
        from_attributes = True

class QuoteList(BaseModel):
    items: List[Quote]
    total: int
    skip: int
    limit: int

# Invoices Schemas
class InvoiceItemBase(BaseModel):
    product_id: int
    description: Optional[str] = None
    quantity: float
    unit_price: float
    discount_percent: float = 0.0
    notes: Optional[str] = None

class InvoiceItemCreate(InvoiceItemBase):
    pass

class InvoiceItem(InvoiceItemBase):
    id: int
    invoice_id: int
    line_total: float
    product: Optional[Product] = None
    
    class Config:
        from_attributes = True

class InvoiceBase(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    sales_order_id: Optional[int] = None
    due_date: Optional[datetime] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None

class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate] = []

class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None

class Invoice(InvoiceBase):
    id: int
    invoice_number: str
    invoice_date: datetime
    status: str
    total_amount: float
    tax_amount: float
    grand_total: float
    amount_paid: float
    amount_due: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[InvoiceItem] = []
    customer: Optional[Customer] = None
    
    class Config:
        from_attributes = True

class InvoiceList(BaseModel):
    items: List[Invoice]
    total: int
    skip: int
    limit: int

# Payments Schemas
class PaymentBase(BaseModel):
    invoice_id: Optional[int] = None
    customer_id: Optional[int] = None
    amount: float
    payment_method: str = "Cash"
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class PaymentCreate(PaymentBase):
    pass

class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class Payment(PaymentBase):
    id: int
    payment_number: str
    payment_date: datetime
    created_at: datetime
    created_by: Optional[str] = None
    invoice: Optional[Invoice] = None
    customer: Optional[Customer] = None
    
    class Config:
        from_attributes = True

class PaymentList(BaseModel):
    items: List[Payment]
    total: int
    skip: int
    limit: int

# Suppliers Schemas
class SupplierBase(BaseModel):
    supplier_code: str
    company_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    contact_name: Optional[str] = None
    payment_terms: Optional[str] = None
    lead_time_days: int = 0
    rating: float = 0.0
    is_active: bool = True
    notes: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    contact_name: Optional[str] = None
    payment_terms: Optional[str] = None
    lead_time_days: Optional[int] = None
    rating: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class Supplier(SupplierBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class SupplierList(BaseModel):
    items: List[Supplier]
    total: int
    skip: int
    limit: int

# Purchase Orders Schemas
class PurchaseOrderItemBase(BaseModel):
    product_id: int
    quantity: float
    unit_price: float
    notes: Optional[str] = None

class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass

class PurchaseOrderItem(PurchaseOrderItemBase):
    id: int
    order_id: int
    received_quantity: float
    line_total: float
    product: Optional[Product] = None
    
    class Config:
        from_attributes = True

class PurchaseOrderBase(BaseModel):
    supplier_id: int
    expected_delivery_date: Optional[datetime] = None
    status: str = "Draft"
    notes: Optional[str] = None

class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[PurchaseOrderItemCreate] = []

class PurchaseOrderUpdate(BaseModel):
    expected_delivery_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PurchaseOrder(PurchaseOrderBase):
    id: int
    po_number: str
    order_date: datetime
    total_amount: float
    tax_amount: float
    grand_total: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[PurchaseOrderItem] = []
    supplier: Optional[Supplier] = None
    
    class Config:
        from_attributes = True

class PurchaseOrderList(BaseModel):
    items: List[PurchaseOrder]
    total: int
    skip: int
    limit: int

# Work Orders Schemas
class WorkOrderBase(BaseModel):
    sales_order_id: Optional[int] = None
    product_id: int
    quantity: float
    start_date: Optional[datetime] = None
    finish_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    status: str = "Created"
    priority: str = "Normal"
    notes: Optional[str] = None

class WorkOrderCreate(WorkOrderBase):
    pass

class WorkOrderUpdate(BaseModel):
    status: Optional[str] = None
    completed_quantity: Optional[float] = None
    start_date: Optional[datetime] = None
    finish_date: Optional[datetime] = None
    priority: Optional[str] = None
    notes: Optional[str] = None

class WorkOrder(WorkOrderBase):
    id: int
    wo_number: str
    completed_quantity: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    product: Optional[Product] = None
    
    class Config:
        from_attributes = True

class WorkOrderList(BaseModel):
    items: List[WorkOrder]
    total: int
    skip: int
    limit: int

# Expenses Schemas
class ExpenseBase(BaseModel):
    category: Optional[str] = None
    description: str
    amount: float
    expense_date: Optional[datetime] = None
    payment_method: str = "Cash"
    vendor: Optional[str] = None
    receipt_number: Optional[str] = None
    status: str = "Pending"
    notes: Optional[str] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class Expense(ExpenseBase):
    id: int
    expense_number: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    
    class Config:
        from_attributes = True

class ExpenseList(BaseModel):
    items: List[Expense]
    total: int
    skip: int
    limit: int

# Projects Schemas
class ProjectTaskBase(BaseModel):
    task_name: str
    description: Optional[str] = None
    status: str = "Not Started"
    priority: str = "Normal"
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None

class ProjectTaskCreate(ProjectTaskBase):
    pass

class ProjectTask(ProjectTaskBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    project_code: str
    name: str
    description: Optional[str] = None
    customer_id: Optional[int] = None
    status: str = "Planning"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget: float = 0.0
    owner: Optional[str] = None
    notes: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = None
    notes: Optional[str] = None

class Project(ProjectBase):
    id: int
    actual_cost: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    customer: Optional[Customer] = None
    tasks: List[ProjectTask] = []
    
    class Config:
        from_attributes = True

class ProjectList(BaseModel):
    items: List[Project]
    total: int
    skip: int
    limit: int

# Support Tickets Schemas
class SupportTicketBase(BaseModel):
    customer_id: Optional[int] = None
    subject: str
    description: str
    category: Optional[str] = None
    priority: str = "Medium"
    status: str = "Open"
    assigned_to: Optional[str] = None
    resolution: Optional[str] = None

class SupportTicketCreate(SupportTicketBase):
    pass

class SupportTicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution: Optional[str] = None

class SupportTicket(SupportTicketBase):
    id: int
    ticket_number: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    customer: Optional[Customer] = None
    
    class Config:
        from_attributes = True

class SupportTicketList(BaseModel):
    items: List[SupportTicket]
    total: int
    skip: int
    limit: int

# Leads Schemas
class LeadBase(BaseModel):
    company_name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: str = "New"
    stage: str = "Lead"
    estimated_value: float = 0.0
    probability: int = 0
    expected_close_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None

class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    stage: Optional[str] = None
    estimated_value: Optional[float] = None
    probability: Optional[int] = None
    expected_close_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    notes: Optional[str] = None

class Lead(LeadBase):
    id: int
    lead_number: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class LeadList(BaseModel):
    items: List[Lead]
    total: int
    skip: int
    limit: int

# Warehouse Location Schemas
class WarehouseLocationBase(BaseModel):
    name: str
    warehouse: Optional[str] = None
    zone: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    bin: Optional[str] = None
    location_type: str = "Storage"
    capacity: float = 0.0
    is_active: bool = True
    notes: Optional[str] = None

class WarehouseLocationCreate(WarehouseLocationBase):
    pass

class WarehouseLocationUpdate(BaseModel):
    name: Optional[str] = None
    warehouse: Optional[str] = None
    zone: Optional[str] = None
    aisle: Optional[str] = None
    rack: Optional[str] = None
    bin: Optional[str] = None
    location_type: Optional[str] = None
    capacity: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class WarehouseLocation(WarehouseLocationBase):
    id: int
    location_code: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class WarehouseLocationList(BaseModel):
    items: List[WarehouseLocation]
    total: int
    skip: int
    limit: int

# BOM Component Schemas
class BOMComponentBase(BaseModel):
    component_id: int
    quantity: float
    unit_of_measure: str = "pcs"
    scrap_rate: float = 0.0
    notes: Optional[str] = None

class BOMComponentCreate(BOMComponentBase):
    pass

class BOMComponent(BOMComponentBase):
    id: int
    bom_id: int
    component: Optional[Product] = None
    
    class Config:
        from_attributes = True

# Bill of Materials Schemas
class BillOfMaterialsBase(BaseModel):
    product_id: int
    version: str = "1.0"
    status: str = "Draft"
    effective_date: Optional[datetime] = None
    quantity: float = 1.0
    labor_hours: float = 0.0
    labor_cost: float = 0.0
    overhead_cost: float = 0.0
    notes: Optional[str] = None

class BillOfMaterialsCreate(BillOfMaterialsBase):
    components: List[BOMComponentCreate] = []

class BillOfMaterialsUpdate(BaseModel):
    version: Optional[str] = None
    status: Optional[str] = None
    effective_date: Optional[datetime] = None
    quantity: Optional[float] = None
    labor_hours: Optional[float] = None
    labor_cost: Optional[float] = None
    overhead_cost: Optional[float] = None
    notes: Optional[str] = None

class BillOfMaterials(BillOfMaterialsBase):
    id: int
    bom_number: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    product: Optional[Product] = None
    components: List[BOMComponent] = []
    
    class Config:
        from_attributes = True

class BillOfMaterialsList(BaseModel):
    items: List[BillOfMaterials]
    total: int
    skip: int
    limit: int

# Quality Inspection Schemas
class QualityInspectionBase(BaseModel):
    inspection_type: str = "Incoming"
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    product_id: Optional[int] = None
    quantity_inspected: float = 0.0
    quantity_passed: float = 0.0
    quantity_failed: float = 0.0
    status: str = "Pending"
    inspector: Optional[str] = None
    result_notes: Optional[str] = None

class QualityInspectionCreate(QualityInspectionBase):
    pass

class QualityInspectionUpdate(BaseModel):
    status: Optional[str] = None
    quantity_inspected: Optional[float] = None
    quantity_passed: Optional[float] = None
    quantity_failed: Optional[float] = None
    inspector: Optional[str] = None
    result_notes: Optional[str] = None

class QualityInspection(QualityInspectionBase):
    id: int
    inspection_number: str
    inspection_date: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None
    product: Optional[Product] = None
    
    class Config:
        from_attributes = True

class QualityInspectionList(BaseModel):
    items: List[QualityInspection]
    total: int
    skip: int
    limit: int

# Shipment Schemas
class ShipmentBase(BaseModel):
    sales_order_id: Optional[int] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    ship_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    status: str = "Pending"
    shipping_cost: float = 0.0
    weight: float = 0.0
    dimensions: Optional[str] = None
    ship_from: Optional[str] = None
    ship_to: Optional[str] = None
    notes: Optional[str] = None

class ShipmentCreate(ShipmentBase):
    pass

class ShipmentUpdate(BaseModel):
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    ship_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    status: Optional[str] = None
    shipping_cost: Optional[float] = None
    weight: Optional[float] = None
    dimensions: Optional[str] = None
    ship_from: Optional[str] = None
    ship_to: Optional[str] = None
    notes: Optional[str] = None

class Shipment(ShipmentBase):
    id: int
    shipment_number: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ShipmentList(BaseModel):
    items: List[Shipment]
    total: int
    skip: int
    limit: int

# Return Order Item Schemas
class ReturnOrderItemBase(BaseModel):
    product_id: int
    quantity: float
    reason: Optional[str] = None
    condition: Optional[str] = None

class ReturnOrderItemCreate(ReturnOrderItemBase):
    pass

class ReturnOrderItem(ReturnOrderItemBase):
    id: int
    return_order_id: int
    product: Optional[Product] = None
    
    class Config:
        from_attributes = True

# Return Order Schemas
class ReturnOrderBase(BaseModel):
    sales_order_id: Optional[int] = None
    customer_id: Optional[int] = None
    reason: Optional[str] = None
    status: str = "Requested"
    disposition: Optional[str] = None
    refund_amount: float = 0.0
    restocking_fee: float = 0.0
    notes: Optional[str] = None

class ReturnOrderCreate(ReturnOrderBase):
    items: List[ReturnOrderItemCreate] = []

class ReturnOrderUpdate(BaseModel):
    status: Optional[str] = None
    disposition: Optional[str] = None
    refund_amount: Optional[float] = None
    restocking_fee: Optional[float] = None
    notes: Optional[str] = None

class ReturnOrder(ReturnOrderBase):
    id: int
    rma_number: str
    return_date: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[ReturnOrderItem] = []
    customer: Optional[Customer] = None
    
    class Config:
        from_attributes = True

class ReturnOrderList(BaseModel):
    items: List[ReturnOrder]
    total: int
    skip: int
    limit: int

# Time Entry Schemas
class TimeEntryBase(BaseModel):
    employee_name: str
    employee_id: Optional[int] = None
    date: datetime
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    hours_worked: float = 0.0
    overtime_hours: float = 0.0
    break_duration: float = 0.0
    entry_type: str = "Regular"
    project_id: Optional[int] = None
    work_order_id: Optional[int] = None
    notes: Optional[str] = None
    status: str = "Draft"

class TimeEntryCreate(TimeEntryBase):
    pass

class TimeEntryUpdate(BaseModel):
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    hours_worked: Optional[float] = None
    overtime_hours: Optional[float] = None
    break_duration: Optional[float] = None
    entry_type: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class TimeEntry(TimeEntryBase):
    id: int
    entry_number: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class TimeEntryList(BaseModel):
    items: List[TimeEntry]
    total: int
    skip: int
    limit: int

# Employee Schemas
class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    hire_date: Optional[datetime] = None
    termination_date: Optional[datetime] = None
    status: str = "Active"
    manager_id: Optional[int] = None
    hourly_rate: float = 0.0
    salary: float = 0.0
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    notes: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None
    hire_date: Optional[datetime] = None
    termination_date: Optional[datetime] = None
    status: Optional[str] = None
    manager_id: Optional[int] = None
    hourly_rate: Optional[float] = None
    salary: Optional[float] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    notes: Optional[str] = None

class Employee(EmployeeBase):
    id: int
    employee_number: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class EmployeeList(BaseModel):
    items: List[Employee]
    total: int
    skip: int
    limit: int

# Asset Schemas
class AssetBase(BaseModel):
    name: str
    category: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_cost: float = 0.0
    current_value: float = 0.0
    warranty_expiry: Optional[datetime] = None
    location: Optional[str] = None
    assigned_to: Optional[str] = None
    status: str = "Active"
    last_maintenance_date: Optional[datetime] = None
    next_maintenance_date: Optional[datetime] = None
    notes: Optional[str] = None

class AssetCreate(AssetBase):
    pass

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_cost: Optional[float] = None
    current_value: Optional[float] = None
    warranty_expiry: Optional[datetime] = None
    location: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = None
    last_maintenance_date: Optional[datetime] = None
    next_maintenance_date: Optional[datetime] = None
    notes: Optional[str] = None

class Asset(AssetBase):
    id: int
    asset_number: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class AssetList(BaseModel):
    items: List[Asset]
    total: int
    skip: int
    limit: int


# =====================================================
# ADMIN & SECURITY SCHEMAS
# =====================================================

# Permission Schemas
class PermissionBase(BaseModel):
    name: str
    code: str
    module: str
    description: Optional[str] = None

class PermissionCreate(PermissionBase):
    pass

class Permission(PermissionBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class PermissionList(BaseModel):
    items: List[Permission]
    total: int
    skip: int
    limit: int


# Role Schemas
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

class RoleCreate(RoleBase):
    permission_ids: List[int] = []

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    permission_ids: Optional[List[int]] = None

class Role(RoleBase):
    id: int
    is_system: bool
    permissions: List[Permission] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class RoleList(BaseModel):
    items: List[Role]
    total: int
    skip: int
    limit: int


# User Schemas
class UserBase(BaseModel):
    username: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True

class UserCreate(UserBase):
    password: str
    role_ids: List[int] = []
    is_superuser: bool = False

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    role_ids: Optional[List[int]] = None
    notes: Optional[str] = None

class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserPasswordReset(BaseModel):
    new_password: str

class User(UserBase):
    id: int
    is_superuser: bool
    last_login: Optional[datetime] = None
    must_change_password: bool
    two_factor_enabled: bool
    roles: List[Role] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UserList(BaseModel):
    items: List[User]
    total: int
    skip: int
    limit: int


# Session Schemas
class UserSessionBase(BaseModel):
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_info: Optional[str] = None

class UserSession(UserSessionBase):
    id: int
    user_id: int
    is_active: bool
    expires_at: datetime
    created_at: datetime
    last_activity: datetime
    
    class Config:
        from_attributes = True

class UserSessionList(BaseModel):
    items: List[UserSession]
    total: int


# Auth Schemas
class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: User

class TokenVerify(BaseModel):
    token: str

class AuthMeResponse(BaseModel):
    user: User
    permissions: List[str] = []

class ForgotPasswordRequest(BaseModel):
    email: str

class ForgotPasswordResponse(BaseModel):
    message: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ResetPasswordResponse(BaseModel):
    message: str


class AdminBootstrapResponse(BaseModel):
    message: str
    username: str
    password: str
    note: str


# Audit Log Schemas
class AuditLogBase(BaseModel):
    action: str
    module: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    entity_name: Optional[str] = None

class AuditLog(AuditLogBase):
    id: int
    user_id: Optional[int] = None
    old_values: Optional[str] = None
    new_values: Optional[str] = None
    ip_address: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class AuditLogList(BaseModel):
    items: List[AuditLog]
    total: int
    skip: int
    limit: int


# System Settings Schemas
class SystemSettingBase(BaseModel):
    key: str
    value: Optional[str] = None
    value_type: str = "string"
    category: str = "general"
    description: Optional[str] = None
    is_sensitive: bool = False

class SystemSettingCreate(SystemSettingBase):
    pass

class SystemSettingUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None

class SystemSetting(SystemSettingBase):
    id: int
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class SystemSettingList(BaseModel):
    items: List[SystemSetting]
    total: int


# =====================================================
# REPORTING SCHEMAS
# =====================================================

# Report Template Schemas
class ReportTemplateBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    module: str
    report_type: str = "table"
    query_config: Optional[str] = None
    filter_config: Optional[str] = None
    column_config: Optional[str] = None
    chart_config: Optional[str] = None
    grouping_config: Optional[str] = None
    sorting_config: Optional[str] = None
    is_active: bool = True

class ReportTemplateCreate(ReportTemplateBase):
    pass

class ReportTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    report_type: Optional[str] = None
    query_config: Optional[str] = None
    filter_config: Optional[str] = None
    column_config: Optional[str] = None
    chart_config: Optional[str] = None
    grouping_config: Optional[str] = None
    sorting_config: Optional[str] = None
    is_active: Optional[bool] = None

class ReportTemplate(ReportTemplateBase):
    id: int
    is_system: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ReportTemplateList(BaseModel):
    items: List[ReportTemplate]
    total: int
    skip: int
    limit: int


# Saved Report Schemas
class SavedReportBase(BaseModel):
    template_id: int
    name: str
    description: Optional[str] = None
    filters_applied: Optional[str] = None
    columns_selected: Optional[str] = None
    grouping_applied: Optional[str] = None
    sorting_applied: Optional[str] = None
    is_favorite: bool = False
    is_shared: bool = False
    share_with_roles: Optional[str] = None
    schedule_enabled: bool = False
    schedule_cron: Optional[str] = None
    schedule_recipients: Optional[str] = None

class SavedReportCreate(SavedReportBase):
    pass

class SavedReportUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    filters_applied: Optional[str] = None
    columns_selected: Optional[str] = None
    grouping_applied: Optional[str] = None
    sorting_applied: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_shared: Optional[bool] = None
    share_with_roles: Optional[str] = None
    schedule_enabled: Optional[bool] = None
    schedule_cron: Optional[str] = None
    schedule_recipients: Optional[str] = None

class SavedReport(SavedReportBase):
    id: int
    last_run_at: Optional[datetime] = None
    created_by: Optional[int] = None
    template: Optional[ReportTemplate] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class SavedReportList(BaseModel):
    items: List[SavedReport]
    total: int
    skip: int
    limit: int


# Report Execution Schemas
class ReportExecutionBase(BaseModel):
    saved_report_id: Optional[int] = None
    template_id: Optional[int] = None
    execution_type: str = "manual"
    filters_used: Optional[str] = None
    file_format: Optional[str] = None

class ReportExecutionCreate(ReportExecutionBase):
    pass

class ReportExecution(ReportExecutionBase):
    id: int
    executed_by: Optional[int] = None
    status: str
    row_count: Optional[int] = None
    file_path: Optional[str] = None
    error_message: Optional[str] = None
    duration_ms: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ReportExecutionList(BaseModel):
    items: List[ReportExecution]
    total: int
    skip: int
    limit: int


# Report Data Response (for running reports)
class ReportDataResponse(BaseModel):
    columns: List[dict]
    data: List[dict]
    total_rows: int
    filters_applied: Optional[dict] = None
    generated_at: datetime


# =====================================================
# ACCOUNTING / GENERAL LEDGER SCHEMAS
# =====================================================

class ChartOfAccountBase(BaseModel):
    account_number: str
    name: str
    account_type: str  # asset, liability, equity, revenue, expense
    parent_id: Optional[int] = None
    description: Optional[str] = None
    is_active: bool = True
    normal_balance: str = "debit"

class ChartOfAccountCreate(ChartOfAccountBase):
    pass

class ChartOfAccountUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    parent_id: Optional[int] = None

class ChartOfAccount(ChartOfAccountBase):
    id: int
    is_system: bool
    current_balance: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ChartOfAccountList(BaseModel):
    items: List[ChartOfAccount]
    total: int
    skip: int
    limit: int


class FiscalPeriodBase(BaseModel):
    name: str
    period_type: str = "month"
    start_date: datetime
    end_date: datetime

class FiscalPeriodCreate(FiscalPeriodBase):
    pass

class FiscalPeriod(FiscalPeriodBase):
    id: int
    is_closed: bool
    closed_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class FiscalPeriodList(BaseModel):
    items: List[FiscalPeriod]
    total: int


class JournalEntryLineBase(BaseModel):
    account_id: int
    description: Optional[str] = None
    debit: float = 0.0
    credit: float = 0.0

class JournalEntryLineCreate(JournalEntryLineBase):
    pass

class JournalEntryLine(JournalEntryLineBase):
    id: int
    journal_entry_id: int
    account: Optional[ChartOfAccount] = None
    
    class Config:
        from_attributes = True


class JournalEntryBase(BaseModel):
    entry_date: datetime
    description: Optional[str] = None
    reference: Optional[str] = None
    entry_type: str = "manual"
    notes: Optional[str] = None

class JournalEntryCreate(JournalEntryBase):
    lines: List[JournalEntryLineCreate] = []

class JournalEntryUpdate(BaseModel):
    description: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

class JournalEntry(JournalEntryBase):
    id: int
    entry_number: str
    source_module: Optional[str] = None
    source_id: Optional[int] = None
    status: str
    total_debit: float
    total_credit: float
    lines: List[JournalEntryLine] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class JournalEntryList(BaseModel):
    items: List[JournalEntry]
    total: int
    skip: int
    limit: int


# =====================================================
# PRODUCTION PLANNING SCHEMAS
# =====================================================

class ProductionResourceBase(BaseModel):
    resource_code: str
    name: str
    resource_type: str
    description: Optional[str] = None
    location: Optional[str] = None
    capacity_per_hour: float = 1.0
    hourly_cost: float = 0.0
    is_available: bool = True

class ProductionResourceCreate(ProductionResourceBase):
    pass

class ProductionResourceUpdate(BaseModel):
    name: Optional[str] = None
    resource_type: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    capacity_per_hour: Optional[float] = None
    hourly_cost: Optional[float] = None
    is_available: Optional[bool] = None

class ProductionResource(ProductionResourceBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ProductionResourceList(BaseModel):
    items: List[ProductionResource]
    total: int
    skip: int
    limit: int


class ProductionScheduleBase(BaseModel):
    work_order_id: Optional[int] = None
    resource_id: Optional[int] = None
    product_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    scheduled_start: datetime
    scheduled_end: datetime
    quantity_planned: float = 1.0
    priority: int = 5
    color: Optional[str] = None
    notes: Optional[str] = None

class ProductionScheduleCreate(ProductionScheduleBase):
    pass

class ProductionScheduleUpdate(BaseModel):
    resource_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    quantity_planned: Optional[float] = None
    quantity_completed: Optional[float] = None
    priority: Optional[int] = None
    status: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None

class ProductionSchedule(ProductionScheduleBase):
    id: int
    schedule_number: str
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    quantity_completed: float
    status: str
    resource: Optional[ProductionResource] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ProductionScheduleList(BaseModel):
    items: List[ProductionSchedule]
    total: int
    skip: int
    limit: int


# =====================================================
# DOCUMENT MANAGEMENT SCHEMAS
# =====================================================

class DocumentVersionBase(BaseModel):
    change_notes: Optional[str] = None

class DocumentVersion(DocumentVersionBase):
    id: int
    document_id: int
    version_number: int
    file_path: str
    file_size: Optional[int] = None
    uploaded_by: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class DocumentBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    linked_entity_type: Optional[str] = None
    linked_entity_id: Optional[int] = None
    tags: Optional[str] = None

class DocumentCreate(DocumentBase):
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None

class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    linked_entity_type: Optional[str] = None
    linked_entity_id: Optional[int] = None
    tags: Optional[str] = None
    is_archived: Optional[bool] = None

class Document(DocumentBase):
    id: int
    document_number: str
    file_type: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    current_version: int
    is_archived: bool
    versions: List[DocumentVersion] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class DocumentList(BaseModel):
    items: List[Document]
    total: int
    skip: int
    limit: int


# =====================================================
# PAYROLL SCHEMAS
# =====================================================

class PayrollPeriodBase(BaseModel):
    name: str
    period_type: str = "biweekly"
    start_date: datetime
    end_date: datetime
    pay_date: Optional[datetime] = None

class PayrollPeriodCreate(PayrollPeriodBase):
    pass

class PayrollPeriodUpdate(BaseModel):
    name: Optional[str] = None
    pay_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class PayrollPeriod(PayrollPeriodBase):
    id: int
    status: str
    total_gross: float
    total_deductions: float
    total_net: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class PayrollPeriodList(BaseModel):
    items: List[PayrollPeriod]
    total: int
    skip: int
    limit: int


class PayslipLineBase(BaseModel):
    line_type: str
    code: Optional[str] = None
    description: str
    hours: Optional[float] = None
    rate: Optional[float] = None
    amount: float = 0.0
    is_taxable: bool = True

class PayslipLineCreate(PayslipLineBase):
    pass

class PayslipLine(PayslipLineBase):
    id: int
    payslip_id: int
    
    class Config:
        from_attributes = True


class PayslipBase(BaseModel):
    employee_id: int
    regular_hours: float = 0.0
    overtime_hours: float = 0.0
    bonus: float = 0.0
    commission: float = 0.0
    notes: Optional[str] = None

class PayslipCreate(PayslipBase):
    period_id: int

class PayslipUpdate(BaseModel):
    regular_hours: Optional[float] = None
    overtime_hours: Optional[float] = None
    bonus: Optional[float] = None
    commission: Optional[float] = None
    status: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None

class Payslip(PayslipBase):
    id: int
    payslip_number: str
    period_id: int
    hourly_rate: float
    regular_pay: float
    overtime_pay: float
    gross_pay: float
    tax_deduction: float
    insurance_deduction: float
    retirement_deduction: float
    other_deductions: float
    total_deductions: float
    net_pay: float
    status: str
    payment_method: Optional[str] = None
    lines: List[PayslipLine] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class PayslipList(BaseModel):
    items: List[Payslip]
    total: int
    skip: int
    limit: int


# =====================================================
# POS SCHEMAS
# =====================================================

class POSTerminalBase(BaseModel):
    terminal_code: str
    name: str
    location: Optional[str] = None
    is_active: bool = True

class POSTerminalCreate(POSTerminalBase):
    pass

class POSTerminal(POSTerminalBase):
    id: int
    last_session_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class POSTerminalList(BaseModel):
    items: List[POSTerminal]
    total: int


class POSSessionBase(BaseModel):
    terminal_id: Optional[int] = None
    opening_balance: float = 0.0

class POSSessionCreate(POSSessionBase):
    pass

class POSSessionClose(BaseModel):
    closing_balance: float
    notes: Optional[str] = None

class POSSession(POSSessionBase):
    id: int
    session_number: str
    opened_by: Optional[int] = None
    closed_by: Optional[int] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    closing_balance: Optional[float] = None
    expected_balance: Optional[float] = None
    cash_difference: Optional[float] = None
    total_sales: float
    total_returns: float
    total_cash: float
    total_card: float
    transaction_count: int
    status: str
    
    class Config:
        from_attributes = True

class POSSessionList(BaseModel):
    items: List[POSSession]
    total: int
    skip: int
    limit: int


class POSTransactionItemBase(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    sku: Optional[str] = None
    quantity: float = 1.0
    unit_price: float = 0.0
    discount_percent: float = 0.0
    tax_percent: float = 0.0

class POSTransactionItemCreate(POSTransactionItemBase):
    pass

class POSTransactionItem(POSTransactionItemBase):
    id: int
    transaction_id: int
    line_total: float
    
    class Config:
        from_attributes = True


class POSTransactionBase(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    transaction_type: str = "sale"
    payment_method: str = "cash"
    notes: Optional[str] = None

class POSTransactionCreate(POSTransactionBase):
    session_id: int
    items: List[POSTransactionItemCreate] = []
    amount_tendered: float = 0.0

class POSTransaction(POSTransactionBase):
    id: int
    transaction_number: str
    session_id: Optional[int] = None
    subtotal: float
    tax_amount: float
    discount_amount: float
    total: float
    amount_tendered: float
    change_given: float
    card_last_four: Optional[str] = None
    status: str
    cashier_id: Optional[int] = None
    items: List[POSTransactionItem] = []
    created_at: datetime
    
    class Config:
        from_attributes = True

class POSTransactionList(BaseModel):
    items: List[POSTransaction]
    total: int
    skip: int
    limit: int


# =====================================================
# TOOLING & CONSUMABLES SCHEMAS
# =====================================================

class ToolMaintenanceLogBase(BaseModel):
    maintenance_type: str
    performed_by: Optional[str] = None
    cost: float = 0.0
    condition_before: Optional[str] = None
    condition_after: Optional[str] = None
    notes: Optional[str] = None
    next_maintenance_date: Optional[datetime] = None

class ToolMaintenanceLogCreate(ToolMaintenanceLogBase):
    tool_id: int

class ToolMaintenanceLog(ToolMaintenanceLogBase):
    id: int
    tool_id: int
    maintenance_date: datetime
    hours_at_maintenance: Optional[float] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ToolBase(BaseModel):
    name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    size: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    lifespan_hours: Optional[float] = None
    lifespan_units: Optional[float] = None

class ToolCreate(ToolBase):
    tool_number: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_cost: float = 0.0

class ToolUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    size: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    assigned_to_resource: Optional[int] = None
    lifespan_hours: Optional[float] = None
    lifespan_units: Optional[float] = None
    hours_used: Optional[float] = None
    units_produced: Optional[float] = None
    status: Optional[str] = None
    condition: Optional[str] = None
    notes: Optional[str] = None

class Tool(ToolBase):
    id: int
    tool_number: str
    assigned_to_resource: Optional[int] = None
    purchase_date: Optional[datetime] = None
    purchase_cost: float
    hours_used: float
    units_produced: float
    last_maintenance_date: Optional[datetime] = None
    next_maintenance_date: Optional[datetime] = None
    status: str
    condition: str
    maintenance_logs: List[ToolMaintenanceLog] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ToolList(BaseModel):
    items: List[Tool]
    total: int
    skip: int
    limit: int


class ConsumableUsageBase(BaseModel):
    quantity_used: float
    work_order_id: Optional[int] = None
    project_id: Optional[int] = None
    used_by: Optional[str] = None
    notes: Optional[str] = None

class ConsumableUsageCreate(ConsumableUsageBase):
    consumable_id: int

class ConsumableUsage(ConsumableUsageBase):
    id: int
    consumable_id: int
    usage_date: datetime
    
    class Config:
        from_attributes = True


class ConsumableBase(BaseModel):
    name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    unit_of_measure: str = "pcs"
    reorder_point: float = 10.0
    reorder_quantity: float = 50.0
    unit_cost: float = 0.0
    location: Optional[str] = None

class ConsumableCreate(ConsumableBase):
    consumable_number: Optional[str] = None
    quantity_on_hand: float = 0.0
    supplier_id: Optional[int] = None
    supplier_sku: Optional[str] = None

class ConsumableUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    unit_of_measure: Optional[str] = None
    quantity_on_hand: Optional[float] = None
    reorder_point: Optional[float] = None
    reorder_quantity: Optional[float] = None
    unit_cost: Optional[float] = None
    location: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_sku: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class Consumable(ConsumableBase):
    id: int
    consumable_number: str
    quantity_on_hand: float
    quantity_reserved: float
    supplier_id: Optional[int] = None
    supplier_sku: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ConsumableList(BaseModel):
    items: List[Consumable]
    total: int
    skip: int
    limit: int


# =====================================================
# PORTAL SCHEMAS
# =====================================================

class PortalUserBase(BaseModel):
    email: str
    user_type: str  # customer, supplier
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None

class PortalUserCreate(PortalUserBase):
    password: str
    linked_customer_id: Optional[int] = None
    linked_supplier_id: Optional[int] = None

class PortalUserUpdate(BaseModel):
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    notification_preferences: Optional[str] = None

class PortalUser(PortalUserBase):
    id: int
    linked_customer_id: Optional[int] = None
    linked_supplier_id: Optional[int] = None
    is_active: bool
    is_verified: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class PortalUserList(BaseModel):
    items: List[PortalUser]
    total: int
    skip: int
    limit: int


class PortalLoginRequest(BaseModel):
    email: str
    password: str

class PortalLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: PortalUser


class PortalMessageBase(BaseModel):
    subject: str
    message: str
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None

class PortalMessageCreate(PortalMessageBase):
    portal_user_id: int
    direction: str = "outbound"

class PortalMessage(PortalMessageBase):
    id: int
    portal_user_id: int
    direction: str
    is_read: bool
    read_at: Optional[datetime] = None
    replied_to_id: Optional[int] = None
    sent_by_user_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class PortalMessageList(BaseModel):
    items: List[PortalMessage]
    total: int
    skip: int
    limit: int


class PortalNotificationBase(BaseModel):
    notification_type: str
    title: str
    message: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None

class PortalNotificationCreate(PortalNotificationBase):
    portal_user_id: int

class PortalNotification(PortalNotificationBase):
    id: int
    portal_user_id: int
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class PortalNotificationList(BaseModel):
    items: List[PortalNotification]
    total: int


# Rebuild models to resolve forward references after all classes are defined
if not TYPE_CHECKING:
    SalesOrder.model_rebuild()
    Invoice.model_rebuild()
    Quote.model_rebuild()
    BillOfMaterials.model_rebuild()
    ReturnOrder.model_rebuild()

