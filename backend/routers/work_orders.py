from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
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

def generate_wo_number(db: Session) -> str:
    """Generate Work Order number: WO000000"""
    last_wo = db.query(models.WorkOrder).filter(models.WorkOrder.wo_number.like("WO%")).order_by(models.WorkOrder.id.desc()).first()
    num = int(last_wo.wo_number[2:]) + 1 if last_wo and last_wo.wo_number else 1
    return f"WO{num:06d}"

@router.post("/", response_model=schemas.WorkOrder, status_code=201)
def create_work_order(wo: schemas.WorkOrderCreate, db: Session = Depends(get_db)):
    """Create work order"""
    try:
        product = db.query(models.Product).filter(models.Product.id == wo.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        db_wo = models.WorkOrder(
            wo_number=generate_wo_number(db),
            sales_order_id=wo.sales_order_id,
            product_id=wo.product_id,
            quantity=wo.quantity,
            start_date=wo.start_date,
            finish_date=wo.finish_date,
            due_date=wo.due_date,
            status=wo.status,
            priority=wo.priority,
            notes=wo.notes
        )
        db.add(db_wo)
        db.commit()
        db.refresh(db_wo)
        db_wo.product = product
        return db_wo
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error creating work order: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="WO number already exists")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating work order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while creating work order")

@router.get("/", response_model=schemas.WorkOrderList)
def get_work_orders(skip: int = Query(0), limit: int = Query(20), status: Optional[str] = None, db: Session = Depends(get_db)):
    """Get work orders"""
    try:
        query = db.query(models.WorkOrder)
        if status:
            query = query.filter(models.WorkOrder.status == status)
        total = query.count()
        wos = query.options(joinedload(models.WorkOrder.product)).order_by(models.WorkOrder.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": wos, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error getting work orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/{wo_id}", response_model=schemas.WorkOrder)
def get_work_order(wo_id: int, db: Session = Depends(get_db)):
    try:
        wo = db.query(models.WorkOrder).options(joinedload(models.WorkOrder.product)).filter(models.WorkOrder.id == wo_id).first()
        if not wo:
            raise HTTPException(status_code=404, detail="Work order not found")
        return wo
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting work order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.put("/{wo_id}", response_model=schemas.WorkOrder)
def update_work_order(wo_id: int, wo_update: schemas.WorkOrderUpdate, db: Session = Depends(get_db)):
    try:
        db_wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == wo_id).first()
        if not db_wo:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        update_data = wo_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_wo, field, value)
        
        if wo_update.completed_quantity and wo_update.completed_quantity >= db_wo.quantity:
            db_wo.status = "Completed"
        
        db.commit()
        db.refresh(db_wo)
        return db_wo
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating work order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.delete("/{wo_id}", status_code=204)
def delete_work_order(wo_id: int, db: Session = Depends(get_db)):
    try:
        db_wo = db.query(models.WorkOrder).filter(models.WorkOrder.id == wo_id).first()
        if not db_wo:
            raise HTTPException(status_code=404, detail="Work order not found")
        if db_wo.status == "Completed":
            raise HTTPException(status_code=400, detail="Cannot delete completed work order")
        db.delete(db_wo)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting work order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")
