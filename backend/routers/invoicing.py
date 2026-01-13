from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime, timedelta
import sys
import os
import logging

logger = logging.getLogger(__name__)

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
from database import get_db
import models
import schemas

router = APIRouter()

def generate_invoice_number(db: Session) -> str:
    """Generate unique Invoice number in format: INV000000"""
    last_inv = db.query(models.Invoice).filter(
        models.Invoice.invoice_number.like("INV%")
    ).order_by(models.Invoice.id.desc()).first()
    
    num = int(last_inv.invoice_number[3:]) + 1 if last_inv and last_inv.invoice_number else 1
    return f"INV{num:06d}"

@router.post("/", response_model=schemas.Invoice, status_code=201)
def create_invoice(invoice: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    """Create a new invoice"""
    try:
        customer_name = None
        if invoice.customer_id:
            customer = db.query(models.Customer).filter(models.Customer.id == invoice.customer_id).first()
            if not customer:
                raise HTTPException(status_code=404, detail="Customer not found")
            customer_name = customer.company_name
        elif invoice.customer_name:
            customer_name = invoice.customer_name.strip()
        else:
            raise HTTPException(status_code=400, detail="Either customer_id or customer_name required")
        
        if not invoice.items or len(invoice.items) == 0:
            raise HTTPException(status_code=400, detail="Invoice must have at least one item")
        
        invoice_number = generate_invoice_number(db)
        total_amount = sum(item.unit_price * item.quantity * (1 - item.discount_percent / 100) 
                          for item in invoice.items)
        tax_rate = float(os.getenv("TAX_RATE", "0.10"))
        tax_amount = round(total_amount * tax_rate, 2)
        grand_total = round(total_amount + tax_amount, 2)
        
        due_date = invoice.due_date
        if not due_date and invoice.payment_terms:
            if "Net 30" in invoice.payment_terms:
                due_date = datetime.now() + timedelta(days=30)
            elif "Net 15" in invoice.payment_terms:
                due_date = datetime.now() + timedelta(days=15)
        
        db_invoice = models.Invoice(
            invoice_number=invoice_number,
            customer_id=invoice.customer_id,
            customer_name=customer_name,
            sales_order_id=invoice.sales_order_id,
            due_date=due_date,
            payment_terms=invoice.payment_terms,
            status="Draft",
            total_amount=round(total_amount, 2),
            tax_amount=tax_amount,
            grand_total=grand_total,
            amount_paid=0.0,
            amount_due=grand_total,
            notes=invoice.notes,
            items=[models.InvoiceItem(
                product_id=item.product_id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount_percent=item.discount_percent,
                line_total=round(item.unit_price * item.quantity * (1 - item.discount_percent / 100), 2),
                notes=item.notes
            ) for item in invoice.items]
        )
        db.add(db_invoice)
        db.commit()
        db.refresh(db_invoice)
        
        for item in db_invoice.items:
            item.product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        
        return db_invoice
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invoice number already exists")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating invoice: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/", response_model=schemas.InvoiceList)
def get_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get invoices with pagination"""
    try:
        query = db.query(models.Invoice)
        if status:
            query = query.filter(models.Invoice.status == status)
        if customer_id:
            query = query.filter(models.Invoice.customer_id == customer_id)
        if search:
            query = query.filter(models.Invoice.invoice_number.ilike(f"%{search}%"))
        
        total = query.count()
        invoices = query.options(
            joinedload(models.Invoice.items).joinedload(models.InvoiceItem.product),
            joinedload(models.Invoice.customer)
        ).order_by(models.Invoice.created_at.desc()).offset(skip).limit(limit).all()
        
        return {"items": invoices, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/{invoice_id}", response_model=schemas.Invoice)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Get invoice by ID"""
    invoice = db.query(models.Invoice).options(
        joinedload(models.Invoice.items).joinedload(models.InvoiceItem.product)
    ).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@router.put("/{invoice_id}", response_model=schemas.Invoice)
def update_invoice(invoice_id: int, invoice_update: schemas.InvoiceUpdate, db: Session = Depends(get_db)):
    """Update invoice"""
    db_invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if db_invoice.status == "Paid":
        raise HTTPException(status_code=400, detail="Cannot edit paid invoice")
    
    for field, value in invoice_update.model_dump(exclude_unset=True).items():
        setattr(db_invoice, field, value)
    
    db.commit()
    db.refresh(db_invoice)
    return db_invoice

@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Delete invoice"""
    db_invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if db_invoice.status == "Paid":
        raise HTTPException(status_code=400, detail="Cannot delete paid invoice")
    
    db.delete(db_invoice)
    db.commit()
    return None
