from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, text
from typing import Optional
from datetime import datetime
from database import get_db
import models
import schemas
import logging
import json
import csv
import io

logger = logging.getLogger(__name__)
router = APIRouter()


def generate_report_code(db: Session) -> str:
    last = db.query(models.ReportTemplate).order_by(models.ReportTemplate.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"RPT{next_num:06d}"


# =====================================================
# REPORT TEMPLATES ENDPOINTS
# =====================================================

@router.get("/templates", response_model=schemas.ReportTemplateList)
@router.get("/templates/", response_model=schemas.ReportTemplateList)
def get_report_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    module: Optional[str] = None,
    report_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.ReportTemplate)
        
        if module:
            query = query.filter(models.ReportTemplate.module == module)
        if report_type:
            query = query.filter(models.ReportTemplate.report_type == report_type)
        if is_active is not None:
            query = query.filter(models.ReportTemplate.is_active == is_active)
        if search:
            query = query.filter(
                (models.ReportTemplate.name.ilike(f"%{search}%")) |
                (models.ReportTemplate.code.ilike(f"%{search}%"))
            )
        
        total = query.count()
        templates = query.order_by(models.ReportTemplate.module, models.ReportTemplate.name).offset(skip).limit(limit).all()
        return {"items": templates, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/templates/{template_id}", response_model=schemas.ReportTemplate)
def get_report_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(models.ReportTemplate).filter(
        models.ReportTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Report template not found")
    return template


@router.post("/templates", response_model=schemas.ReportTemplate, status_code=201)
@router.post("/templates/", response_model=schemas.ReportTemplate, status_code=201)
def create_report_template(template: schemas.ReportTemplateCreate, db: Session = Depends(get_db)):
    try:
        # Auto-generate code if not provided
        code = template.code if template.code else generate_report_code(db)
        
        existing = db.query(models.ReportTemplate).filter(
            models.ReportTemplate.code == code
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Report code already exists")
        
        db_template = models.ReportTemplate(
            **template.model_dump(exclude={'code'}),
            code=code
        )
        db.add(db_template)
        db.commit()
        db.refresh(db_template)
        return db_template
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating report template: {e}")
        raise HTTPException(status_code=500, detail="Error creating report template")


@router.put("/templates/{template_id}", response_model=schemas.ReportTemplate)
def update_report_template(
    template_id: int,
    template: schemas.ReportTemplateUpdate,
    db: Session = Depends(get_db)
):
    try:
        db_template = db.query(models.ReportTemplate).filter(
            models.ReportTemplate.id == template_id
        ).first()
        if not db_template:
            raise HTTPException(status_code=404, detail="Report template not found")
        if db_template.is_system:
            raise HTTPException(status_code=400, detail="Cannot modify system report")
        
        for key, value in template.model_dump(exclude_unset=True).items():
            setattr(db_template, key, value)
        
        db.commit()
        db.refresh(db_template)
        return db_template
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating report template: {e}")
        raise HTTPException(status_code=500, detail="Error updating report template")


@router.delete("/templates/{template_id}", status_code=204)
def delete_report_template(template_id: int, db: Session = Depends(get_db)):
    try:
        db_template = db.query(models.ReportTemplate).filter(
            models.ReportTemplate.id == template_id
        ).first()
        if not db_template:
            raise HTTPException(status_code=404, detail="Report template not found")
        if db_template.is_system:
            raise HTTPException(status_code=400, detail="Cannot delete system report")
        
        db.delete(db_template)
        db.commit()
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting report template: {e}")
        raise HTTPException(status_code=500, detail="Error deleting report template")


# =====================================================
# SAVED REPORTS ENDPOINTS
# =====================================================

@router.get("/saved", response_model=schemas.SavedReportList)
@router.get("/saved/", response_model=schemas.SavedReportList)
def get_saved_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    template_id: Optional[int] = None,
    is_favorite: Optional[bool] = None,
    created_by: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.SavedReport).options(
            joinedload(models.SavedReport.template)
        )
        
        if template_id:
            query = query.filter(models.SavedReport.template_id == template_id)
        if is_favorite is not None:
            query = query.filter(models.SavedReport.is_favorite == is_favorite)
        if created_by:
            query = query.filter(models.SavedReport.created_by == created_by)
        if search:
            query = query.filter(models.SavedReport.name.ilike(f"%{search}%"))
        
        total = query.count()
        reports = query.order_by(models.SavedReport.updated_at.desc()).offset(skip).limit(limit).all()
        return {"items": reports, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/saved/{report_id}", response_model=schemas.SavedReport)
def get_saved_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.SavedReport).options(
        joinedload(models.SavedReport.template)
    ).filter(models.SavedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Saved report not found")
    return report


@router.post("/saved", response_model=schemas.SavedReport, status_code=201)
@router.post("/saved/", response_model=schemas.SavedReport, status_code=201)
def create_saved_report(report: schemas.SavedReportCreate, db: Session = Depends(get_db)):
    try:
        # Verify template exists
        template = db.query(models.ReportTemplate).filter(
            models.ReportTemplate.id == report.template_id
        ).first()
        if not template:
            raise HTTPException(status_code=404, detail="Report template not found")
        
        db_report = models.SavedReport(**report.model_dump())
        db.add(db_report)
        db.commit()
        db.refresh(db_report)
        return db_report
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating saved report: {e}")
        raise HTTPException(status_code=500, detail="Error creating saved report")


@router.put("/saved/{report_id}", response_model=schemas.SavedReport)
def update_saved_report(
    report_id: int,
    report: schemas.SavedReportUpdate,
    db: Session = Depends(get_db)
):
    try:
        db_report = db.query(models.SavedReport).filter(
            models.SavedReport.id == report_id
        ).first()
        if not db_report:
            raise HTTPException(status_code=404, detail="Saved report not found")
        
        for key, value in report.model_dump(exclude_unset=True).items():
            setattr(db_report, key, value)
        
        db.commit()
        db.refresh(db_report)
        return db_report
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating saved report: {e}")
        raise HTTPException(status_code=500, detail="Error updating saved report")


@router.delete("/saved/{report_id}", status_code=204)
def delete_saved_report(report_id: int, db: Session = Depends(get_db)):
    try:
        db_report = db.query(models.SavedReport).filter(
            models.SavedReport.id == report_id
        ).first()
        if not db_report:
            raise HTTPException(status_code=404, detail="Saved report not found")
        
        db.delete(db_report)
        db.commit()
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting saved report: {e}")
        raise HTTPException(status_code=500, detail="Error deleting saved report")


@router.post("/saved/{report_id}/toggle-favorite")
def toggle_favorite(report_id: int, db: Session = Depends(get_db)):
    try:
        db_report = db.query(models.SavedReport).filter(
            models.SavedReport.id == report_id
        ).first()
        if not db_report:
            raise HTTPException(status_code=404, detail="Saved report not found")
        
        db_report.is_favorite = not db_report.is_favorite
        db.commit()
        
        return {"is_favorite": db_report.is_favorite}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error toggling favorite: {e}")
        raise HTTPException(status_code=500, detail="Error toggling favorite")


# =====================================================
# REPORT EXECUTION ENDPOINTS
# =====================================================

@router.get("/executions", response_model=schemas.ReportExecutionList)
@router.get("/executions/", response_model=schemas.ReportExecutionList)
def get_report_executions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    saved_report_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.ReportExecution)
        
        if saved_report_id:
            query = query.filter(models.ReportExecution.saved_report_id == saved_report_id)
        if status:
            query = query.filter(models.ReportExecution.status == status)
        
        total = query.count()
        executions = query.order_by(models.ReportExecution.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": executions, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


# =====================================================
# REPORT RUNNING ENDPOINTS
# =====================================================

@router.post("/run/{template_id}")
def run_report(
    template_id: int,
    filters: Optional[dict] = None,
    db: Session = Depends(get_db)
):
    """Run a report template and return data"""
    try:
        template = db.query(models.ReportTemplate).filter(
            models.ReportTemplate.id == template_id
        ).first()
        if not template:
            raise HTTPException(status_code=404, detail="Report template not found")
        
        # Parse query config
        query_config = json.loads(template.query_config) if template.query_config else {}
        
        # Execute built-in reports based on module
        data = execute_builtin_report(db, template.module, template.code, filters or {})
        
        # Record execution
        execution = models.ReportExecution(
            template_id=template_id,
            execution_type="manual",
            status="completed",
            filters_used=json.dumps(filters) if filters else None,
            row_count=len(data.get("data", [])),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow()
        )
        db.add(execution)
        db.commit()
        
        return {
            "columns": data.get("columns", []),
            "data": data.get("data", []),
            "total_rows": len(data.get("data", [])),
            "filters_applied": filters,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running report: {e}")
        raise HTTPException(status_code=500, detail=f"Error running report: {str(e)}")


@router.get("/export/{template_id}")
def export_report(
    template_id: int,
    format: str = Query("csv", description="Export format: csv or json"),
    db: Session = Depends(get_db)
):
    """Export report to CSV or JSON"""
    try:
        template = db.query(models.ReportTemplate).filter(
            models.ReportTemplate.id == template_id
        ).first()
        if not template:
            raise HTTPException(status_code=404, detail="Report template not found")
        
        # Get report data
        data = execute_builtin_report(db, template.module, template.code, {})
        
        if format == "json":
            return Response(
                content=json.dumps(data, default=str, indent=2),
                media_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="{template.code}.json"'}
            )
        else:
            # CSV export
            output = io.StringIO()
            if data.get("data"):
                writer = csv.DictWriter(output, fieldnames=data["data"][0].keys())
                writer.writeheader()
                writer.writerows(data["data"])
            
            return Response(
                content=output.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{template.code}.csv"'}
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting report: {e}")
        raise HTTPException(status_code=500, detail=f"Error exporting report: {str(e)}")


# =====================================================
# BUILT-IN REPORTS
# =====================================================

def execute_builtin_report(db: Session, module: str, code: str, filters: dict) -> dict:
    """Execute built-in reports based on module and code"""
    
    # Sales Reports
    if module == "sales":
        return run_sales_report(db, code, filters)
    
    # Inventory Reports
    elif module == "inventory":
        return run_inventory_report(db, code, filters)
    
    # Finance Reports
    elif module == "finance":
        return run_finance_report(db, code, filters)
    
    # Product Reports
    elif module == "products":
        return run_product_report(db, code, filters)
    
    # Customer Reports
    elif module == "customers":
        return run_customer_report(db, code, filters)
    
    # Default empty report
    return {"columns": [], "data": []}


def run_sales_report(db: Session, code: str, filters: dict) -> dict:
    """Sales module reports"""
    
    if code == "sales_summary":
        results = db.query(
            func.date(models.SalesOrder.order_date).label("date"),
            func.count(models.SalesOrder.id).label("order_count"),
            func.sum(models.SalesOrder.grand_total).label("total_sales")
        ).group_by(func.date(models.SalesOrder.order_date)).order_by(
            func.date(models.SalesOrder.order_date).desc()
        ).limit(100).all()
        
        return {
            "columns": [
                {"key": "date", "label": "Date"},
                {"key": "order_count", "label": "Orders"},
                {"key": "total_sales", "label": "Total Sales"}
            ],
            "data": [{"date": str(r[0]), "order_count": r[1], "total_sales": float(r[2] or 0)} for r in results]
        }
    
    elif code == "sales_by_customer":
        results = db.query(
            models.SalesOrder.customer_name,
            func.count(models.SalesOrder.id).label("order_count"),
            func.sum(models.SalesOrder.grand_total).label("total_spent")
        ).group_by(models.SalesOrder.customer_name).order_by(
            func.sum(models.SalesOrder.grand_total).desc()
        ).limit(100).all()
        
        return {
            "columns": [
                {"key": "customer_name", "label": "Customer"},
                {"key": "order_count", "label": "Orders"},
                {"key": "total_spent", "label": "Total Spent"}
            ],
            "data": [{"customer_name": r[0], "order_count": r[1], "total_spent": float(r[2] or 0)} for r in results]
        }
    
    elif code == "sales_by_status":
        results = db.query(
            models.SalesOrder.status,
            func.count(models.SalesOrder.id).label("count"),
            func.sum(models.SalesOrder.grand_total).label("total")
        ).group_by(models.SalesOrder.status).all()
        
        return {
            "columns": [
                {"key": "status", "label": "Status"},
                {"key": "count", "label": "Count"},
                {"key": "total", "label": "Total Value"}
            ],
            "data": [{"status": r[0], "count": r[1], "total": float(r[2] or 0)} for r in results]
        }
    
    return {"columns": [], "data": []}


def run_inventory_report(db: Session, code: str, filters: dict) -> dict:
    """Inventory module reports"""
    
    if code == "stock_levels":
        results = db.query(
            models.InventoryItem.id,
            models.Product.name,
            models.Product.sku,
            models.InventoryItem.location,
            models.InventoryItem.quantity_on_hand,
            models.InventoryItem.quantity_reserved,
            models.InventoryItem.reorder_point
        ).join(models.Product).all()
        
        return {
            "columns": [
                {"key": "sku", "label": "SKU"},
                {"key": "name", "label": "Product"},
                {"key": "location", "label": "Location"},
                {"key": "quantity_on_hand", "label": "On Hand"},
                {"key": "quantity_reserved", "label": "Reserved"},
                {"key": "reorder_point", "label": "Reorder Point"}
            ],
            "data": [{
                "sku": r[2],
                "name": r[1],
                "location": r[3],
                "quantity_on_hand": float(r[4] or 0),
                "quantity_reserved": float(r[5] or 0),
                "reorder_point": float(r[6] or 0)
            } for r in results]
        }
    
    elif code == "low_stock":
        results = db.query(
            models.Product.name,
            models.Product.sku,
            models.InventoryItem.location,
            models.InventoryItem.quantity_on_hand,
            models.InventoryItem.reorder_point
        ).join(models.Product).filter(
            models.InventoryItem.quantity_on_hand <= models.InventoryItem.reorder_point
        ).all()
        
        return {
            "columns": [
                {"key": "sku", "label": "SKU"},
                {"key": "name", "label": "Product"},
                {"key": "location", "label": "Location"},
                {"key": "quantity_on_hand", "label": "On Hand"},
                {"key": "reorder_point", "label": "Reorder Point"}
            ],
            "data": [{
                "sku": r[1],
                "name": r[0],
                "location": r[2],
                "quantity_on_hand": float(r[3] or 0),
                "reorder_point": float(r[4] or 0)
            } for r in results]
        }
    
    return {"columns": [], "data": []}


def run_finance_report(db: Session, code: str, filters: dict) -> dict:
    """Finance module reports"""
    
    if code == "invoice_aging":
        results = db.query(
            models.Invoice.invoice_number,
            models.Invoice.customer_name,
            models.Invoice.grand_total,
            models.Invoice.amount_paid,
            models.Invoice.due_date,
            models.Invoice.status
        ).filter(models.Invoice.status != "paid").order_by(
            models.Invoice.due_date
        ).all()
        
        return {
            "columns": [
                {"key": "invoice_number", "label": "Invoice #"},
                {"key": "customer_name", "label": "Customer"},
                {"key": "grand_total", "label": "Total"},
                {"key": "amount_paid", "label": "Paid"},
                {"key": "balance", "label": "Balance"},
                {"key": "due_date", "label": "Due Date"},
                {"key": "status", "label": "Status"}
            ],
            "data": [{
                "invoice_number": r[0],
                "customer_name": r[1],
                "grand_total": float(r[2] or 0),
                "amount_paid": float(r[3] or 0),
                "balance": float((r[2] or 0) - (r[3] or 0)),
                "due_date": str(r[4]) if r[4] else "",
                "status": r[5]
            } for r in results]
        }
    
    elif code == "expense_summary":
        results = db.query(
            models.Expense.category,
            func.count(models.Expense.id).label("count"),
            func.sum(models.Expense.amount).label("total")
        ).group_by(models.Expense.category).order_by(
            func.sum(models.Expense.amount).desc()
        ).all()
        
        return {
            "columns": [
                {"key": "category", "label": "Category"},
                {"key": "count", "label": "Count"},
                {"key": "total", "label": "Total Amount"}
            ],
            "data": [{"category": r[0] or "Uncategorized", "count": r[1], "total": float(r[2] or 0)} for r in results]
        }
    
    return {"columns": [], "data": []}


def run_product_report(db: Session, code: str, filters: dict) -> dict:
    """Product module reports"""
    
    if code == "product_list":
        results = db.query(models.Product).filter(models.Product.is_active == True).all()
        
        return {
            "columns": [
                {"key": "sku", "label": "SKU"},
                {"key": "name", "label": "Name"},
                {"key": "category", "label": "Category"},
                {"key": "price", "label": "Price"},
                {"key": "cost", "label": "Cost"}
            ],
            "data": [{
                "sku": p.sku,
                "name": p.name,
                "category": p.category or "",
                "price": float(p.price or 0),
                "cost": float(p.cost or 0)
            } for p in results]
        }
    
    elif code == "product_profitability":
        results = db.query(
            models.Product.name,
            models.Product.sku,
            func.sum(models.SalesOrderItem.quantity).label("qty_sold"),
            func.sum(models.SalesOrderItem.line_total).label("revenue"),
            func.sum(models.SalesOrderItem.quantity * models.Product.cost).label("cost")
        ).join(models.SalesOrderItem).group_by(
            models.Product.id, models.Product.name, models.Product.sku
        ).order_by(func.sum(models.SalesOrderItem.line_total).desc()).limit(50).all()
        
        return {
            "columns": [
                {"key": "sku", "label": "SKU"},
                {"key": "name", "label": "Product"},
                {"key": "qty_sold", "label": "Qty Sold"},
                {"key": "revenue", "label": "Revenue"},
                {"key": "cost", "label": "Cost"},
                {"key": "profit", "label": "Profit"}
            ],
            "data": [{
                "sku": r[1],
                "name": r[0],
                "qty_sold": float(r[2] or 0),
                "revenue": float(r[3] or 0),
                "cost": float(r[4] or 0),
                "profit": float((r[3] or 0) - (r[4] or 0))
            } for r in results]
        }
    
    return {"columns": [], "data": []}


def run_customer_report(db: Session, code: str, filters: dict) -> dict:
    """Customer module reports"""
    
    if code == "customer_list":
        results = db.query(models.Customer).all()
        
        return {
            "columns": [
                {"key": "company_name", "label": "Company"},
                {"key": "contact_name", "label": "Contact"},
                {"key": "email", "label": "Email"},
                {"key": "phone", "label": "Phone"},
                {"key": "city", "label": "City"}
            ],
            "data": [{
                "company_name": c.company_name,
                "contact_name": c.contact_name or "",
                "email": c.email or "",
                "phone": c.phone or "",
                "city": c.city or ""
            } for c in results]
        }
    
    return {"columns": [], "data": []}


# =====================================================
# INITIALIZE DEFAULT REPORTS
# =====================================================

@router.post("/init-templates")
def initialize_report_templates(db: Session = Depends(get_db)):
    """Initialize default report templates"""
    try:
        default_templates = [
            # Sales Reports
            {"name": "Sales Summary", "code": "sales_summary", "module": "sales", "report_type": "table", "is_system": True},
            {"name": "Sales by Customer", "code": "sales_by_customer", "module": "sales", "report_type": "table", "is_system": True},
            {"name": "Sales by Status", "code": "sales_by_status", "module": "sales", "report_type": "chart", "is_system": True},
            
            # Inventory Reports
            {"name": "Stock Levels", "code": "stock_levels", "module": "inventory", "report_type": "table", "is_system": True},
            {"name": "Low Stock Alert", "code": "low_stock", "module": "inventory", "report_type": "table", "is_system": True},
            
            # Finance Reports
            {"name": "Invoice Aging", "code": "invoice_aging", "module": "finance", "report_type": "table", "is_system": True},
            {"name": "Expense Summary", "code": "expense_summary", "module": "finance", "report_type": "chart", "is_system": True},
            
            # Product Reports
            {"name": "Product List", "code": "product_list", "module": "products", "report_type": "table", "is_system": True},
            {"name": "Product Profitability", "code": "product_profitability", "module": "products", "report_type": "table", "is_system": True},
            
            # Customer Reports
            {"name": "Customer List", "code": "customer_list", "module": "customers", "report_type": "table", "is_system": True},
        ]
        
        created = 0
        for t in default_templates:
            existing = db.query(models.ReportTemplate).filter(
                models.ReportTemplate.code == t["code"]
            ).first()
            if not existing:
                template = models.ReportTemplate(**t)
                db.add(template)
                created += 1
        
        db.commit()
        return {"message": f"Initialized {created} report templates"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error initializing report templates: {e}")
        raise HTTPException(status_code=500, detail="Error initializing report templates")


@router.get("/modules")
def get_available_modules():
    """Get list of available report modules"""
    return {
        "modules": [
            {"code": "sales", "name": "Sales"},
            {"code": "inventory", "name": "Inventory"},
            {"code": "finance", "name": "Finance"},
            {"code": "products", "name": "Products"},
            {"code": "customers", "name": "Customers"},
            {"code": "purchasing", "name": "Purchasing"},
            {"code": "manufacturing", "name": "Manufacturing"},
            {"code": "quality", "name": "Quality"},
            {"code": "hr", "name": "Human Resources"},
            {"code": "assets", "name": "Assets"}
        ]
    }
