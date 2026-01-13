from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from database import get_db
import models
import schemas
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def generate_rma_number(db: Session) -> str:
    last = db.query(models.ReturnOrder).order_by(models.ReturnOrder.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"RMA{next_num:06d}"

@router.get("/", response_model=schemas.ReturnOrderList)
@router.get("", response_model=schemas.ReturnOrderList)
def get_returns(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.ReturnOrder).options(
            joinedload(models.ReturnOrder.customer),
            joinedload(models.ReturnOrder.items).joinedload(models.ReturnOrderItem.product)
        )
        if status:
            query = query.filter(models.ReturnOrder.status == status)
        if search:
            query = query.filter(models.ReturnOrder.rma_number.ilike(f"%{search}%"))
        total = db.query(models.ReturnOrder).count()
        returns = query.order_by(models.ReturnOrder.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": returns, "total": total, "skip": skip, "limit": limit}
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{return_id}", response_model=schemas.ReturnOrder)
def get_return(return_id: int, db: Session = Depends(get_db)):
    return_order = db.query(models.ReturnOrder).options(
        joinedload(models.ReturnOrder.customer),
        joinedload(models.ReturnOrder.items).joinedload(models.ReturnOrderItem.product)
    ).filter(models.ReturnOrder.id == return_id).first()
    if not return_order:
        raise HTTPException(status_code=404, detail="Return not found")
    return return_order

@router.post("/", response_model=schemas.ReturnOrder, status_code=201)
def create_return(return_order: schemas.ReturnOrderCreate, db: Session = Depends(get_db)):
    try:
        db_return = models.ReturnOrder(
            rma_number=generate_rma_number(db),
            sales_order_id=return_order.sales_order_id,
            customer_id=return_order.customer_id,
            reason=return_order.reason,
            status=return_order.status,
            disposition=return_order.disposition,
            refund_amount=return_order.refund_amount,
            restocking_fee=return_order.restocking_fee,
            notes=return_order.notes
        )
        db.add(db_return)
        db.flush()
        
        for item in return_order.items:
            db_item = models.ReturnOrderItem(
                return_order_id=db_return.id,
                product_id=item.product_id,
                quantity=item.quantity,
                reason=item.reason,
                condition=item.condition
            )
            db.add(db_item)
        
        db.commit()
        db.refresh(db_return)
        return db_return
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating return: {e}")
        raise HTTPException(status_code=500, detail="Error creating return")

@router.put("/{return_id}", response_model=schemas.ReturnOrder)
def update_return(return_id: int, return_order: schemas.ReturnOrderUpdate, db: Session = Depends(get_db)):
    try:
        db_return = db.query(models.ReturnOrder).filter(models.ReturnOrder.id == return_id).first()
        if not db_return:
            raise HTTPException(status_code=404, detail="Return not found")
        for key, value in return_order.model_dump(exclude_unset=True).items():
            setattr(db_return, key, value)
        db.commit()
        db.refresh(db_return)
        return db_return
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating return: {e}")
        raise HTTPException(status_code=500, detail="Error updating return")

@router.delete("/{return_id}", status_code=204)
def delete_return(return_id: int, db: Session = Depends(get_db)):
    try:
        db_return = db.query(models.ReturnOrder).filter(models.ReturnOrder.id == return_id).first()
        if not db_return:
            raise HTTPException(status_code=404, detail="Return not found")
        db.delete(db_return)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting return: {e}")
        raise HTTPException(status_code=500, detail="Error deleting return")
