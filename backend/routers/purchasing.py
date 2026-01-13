from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import Optional
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

def generate_po_number(db: Session) -> str:
    """Generate unique PO number in format: PO000000"""
    last_po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.po_number.like("PO%")
    ).order_by(models.PurchaseOrder.id.desc()).first()
    
    if last_po and last_po.po_number:
        try:
            num_str = last_po.po_number[2:]
            num = int(num_str) + 1 if num_str.isdigit() else 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    
    return f"PO{num:06d}"

@router.post("/", response_model=schemas.PurchaseOrder, status_code=201)
def create_purchase_order(po: schemas.PurchaseOrderCreate, db: Session = Depends(get_db)):
    """Create a new purchase order"""
    try:
        supplier = db.query(models.Supplier).filter(models.Supplier.id == po.supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        if not po.items or len(po.items) == 0:
            raise HTTPException(status_code=400, detail="Purchase order must have at least one item")
        
        po_number = generate_po_number(db)
        total_amount = 0.0
        po_items = []
        
        for item_data in po.items:
            product = db.query(models.Product).filter(models.Product.id == item_data.product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found")
            
            line_total = round(item_data.unit_price * item_data.quantity, 2)
            
            po_items.append(models.PurchaseOrderItem(
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                received_quantity=0.0,
                line_total=line_total,
                notes=item_data.notes
            ))
            total_amount += line_total
        
        tax_rate = float(os.getenv("TAX_RATE", "0.10"))
        tax_amount = round(total_amount * tax_rate, 2)
        grand_total = round(total_amount + tax_amount, 2)
        
        db_po = models.PurchaseOrder(
            po_number=po_number,
            supplier_id=po.supplier_id,
            expected_delivery_date=po.expected_delivery_date,
            status=po.status,
            notes=po.notes,
            total_amount=round(total_amount, 2),
            tax_amount=tax_amount,
            grand_total=grand_total,
            items=po_items
        )
        
        db.add(db_po)
        db.commit()
        db.refresh(db_po)
        
        for item in db_po.items:
            item.product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        
        return db_po
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="PO number already exists")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating PO: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/", response_model=schemas.PurchaseOrderList)
def get_purchase_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db)
):
    """Get purchase orders with pagination and filtering"""
    try:
        query = db.query(models.PurchaseOrder)
        
        if status:
            query = query.filter(models.PurchaseOrder.status == status)
        if supplier_id:
            query = query.filter(models.PurchaseOrder.supplier_id == supplier_id)
        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(models.PurchaseOrder.po_number.ilike(search_term))
        
        total = query.count()
        pos = query.options(
            joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseOrderItem.product),
            joinedload(models.PurchaseOrder.supplier)
        ).order_by(models.PurchaseOrder.created_at.desc()).offset(skip).limit(limit).all()
        
        return {"items": pos, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error getting POs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/{po_id}", response_model=schemas.PurchaseOrder)
def get_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """Get a single purchase order by ID"""
    try:
        po = db.query(models.PurchaseOrder).options(
            joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseOrderItem.product),
            joinedload(models.PurchaseOrder.supplier)
        ).filter(models.PurchaseOrder.id == po_id).first()
        
        if not po:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        return po
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting PO: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.put("/{po_id}", response_model=schemas.PurchaseOrder)
def update_purchase_order(po_id: int, po_update: schemas.PurchaseOrderUpdate, db: Session = Depends(get_db)):
    """Update a purchase order"""
    try:
        db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
        if not db_po:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        if db_po.status == "Received":
            raise HTTPException(status_code=400, detail="Cannot edit received purchase order")
        
        update_data = po_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_po, field, value)
        
        db.commit()
        db.refresh(db_po)
        
        db_po = db.query(models.PurchaseOrder).options(
            joinedload(models.PurchaseOrder.items).joinedload(models.PurchaseOrderItem.product)
        ).filter(models.PurchaseOrder.id == po_id).first()
        
        return db_po
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating PO: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.delete("/{po_id}", status_code=204)
def delete_purchase_order(po_id: int, db: Session = Depends(get_db)):
    """Delete a purchase order"""
    try:
        db_po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
        if not db_po:
            raise HTTPException(status_code=404, detail="Purchase order not found")
        
        if db_po.status != "Draft":
            raise HTTPException(status_code=400, detail="Can only delete draft purchase orders")
        
        db.delete(db_po)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting PO: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")
