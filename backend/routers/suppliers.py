from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
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

@router.post("/", response_model=schemas.Supplier, status_code=201)
def create_supplier(supplier: schemas.SupplierCreate, db: Session = Depends(get_db)):
    """Create a new supplier"""
    try:
        if not supplier.company_name or len(supplier.company_name.strip()) == 0:
            raise HTTPException(status_code=400, detail="Company name is required")
        
        db_supplier = models.Supplier(**supplier.model_dump())
        db.add(db_supplier)
        db.commit()
        db.refresh(db_supplier)
        return db_supplier
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Supplier code already exists")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating supplier: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/", response_model=schemas.SupplierList)
def get_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    """Get suppliers with pagination and filtering"""
    try:
        query = db.query(models.Supplier)
        
        if is_active is not None:
            query = query.filter(models.Supplier.is_active == is_active)
        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(
                (models.Supplier.company_name.ilike(search_term)) |
                (models.Supplier.supplier_code.ilike(search_term))
            )
        
        total = query.count()
        suppliers = query.order_by(models.Supplier.company_name.asc()).offset(skip).limit(limit).all()
        
        return {"items": suppliers, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error getting suppliers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/{supplier_id}", response_model=schemas.Supplier)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """Get a single supplier by ID"""
    try:
        supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        return supplier
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting supplier: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.put("/{supplier_id}", response_model=schemas.Supplier)
def update_supplier(supplier_id: int, supplier_update: schemas.SupplierUpdate, db: Session = Depends(get_db)):
    """Update a supplier"""
    try:
        db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
        if not db_supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        update_data = supplier_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_supplier, field, value)
        
        db.commit()
        db.refresh(db_supplier)
        return db_supplier
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating supplier: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.delete("/{supplier_id}", status_code=204)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """Delete a supplier"""
    try:
        db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
        if not db_supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        # Check if supplier has purchase orders
        po_count = db.query(models.PurchaseOrder).filter(
            models.PurchaseOrder.supplier_id == supplier_id
        ).count()
        if po_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete supplier: they have {po_count} purchase order(s)"
            )
        
        db.delete(db_supplier)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting supplier: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")
