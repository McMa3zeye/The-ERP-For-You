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

def generate_payment_number(db: Session) -> str:
    """Generate Payment number: PAY000000"""
    last = db.query(models.Payment).filter(models.Payment.payment_number.like("PAY%")).order_by(models.Payment.id.desc()).first()
    num = int(last.payment_number[3:]) + 1 if last and last.payment_number else 1
    return f"PAY{num:06d}"

@router.post("/", response_model=schemas.Payment, status_code=201)
def create_payment(payment: schemas.PaymentCreate, db: Session = Depends(get_db)):
    """Create payment"""
    try:
        db_payment = models.Payment(
            payment_number=generate_payment_number(db),
            **payment.model_dump()
        )
        
        # Update invoice if linked
        if payment.invoice_id:
            invoice = db.query(models.Invoice).filter(models.Invoice.id == payment.invoice_id).first()
            if invoice:
                invoice.amount_paid = (invoice.amount_paid or 0) + payment.amount
                invoice.amount_due = invoice.grand_total - invoice.amount_paid
                if invoice.amount_due <= 0:
                    invoice.status = "Paid"
                elif invoice.amount_paid > 0:
                    invoice.status = "Partially Paid"
        
        db.add(db_payment)
        db.commit()
        db.refresh(db_payment)
        
        if db_payment.invoice_id:
            db_payment.invoice = db.query(models.Invoice).filter(models.Invoice.id == db_payment.invoice_id).first()
        if db_payment.customer_id:
            db_payment.customer = db.query(models.Customer).filter(models.Customer.id == db_payment.customer_id).first()
        
        return db_payment
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error creating payment: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Payment number already exists")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating payment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while creating payment")

@router.get("/", response_model=schemas.PaymentList)
def get_payments(skip: int = Query(0), limit: int = Query(20), invoice_id: Optional[int] = None, customer_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get payments"""
    try:
        query = db.query(models.Payment)
        if invoice_id:
            query = query.filter(models.Payment.invoice_id == invoice_id)
        if customer_id:
            query = query.filter(models.Payment.customer_id == customer_id)
        total = query.count()
        payments = query.options(joinedload(models.Payment.invoice), joinedload(models.Payment.customer)).order_by(models.Payment.payment_date.desc()).offset(skip).limit(limit).all()
        return {"items": payments, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error getting payments: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/{payment_id}", response_model=schemas.Payment)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    try:
        payment = db.query(models.Payment).options(joinedload(models.Payment.invoice), joinedload(models.Payment.customer)).filter(models.Payment.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        return payment
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting payment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.put("/{payment_id}", response_model=schemas.Payment)
def update_payment(payment_id: int, payment_update: schemas.PaymentUpdate, db: Session = Depends(get_db)):
    try:
        db_payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
        if not db_payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        update_data = payment_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_payment, field, value)
        
        db.commit()
        db.refresh(db_payment)
        return db_payment
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating payment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.delete("/{payment_id}", status_code=204)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    try:
        db_payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
        if not db_payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Update invoice if linked
        if db_payment.invoice_id:
            invoice = db.query(models.Invoice).filter(models.Invoice.id == db_payment.invoice_id).first()
            if invoice:
                invoice.amount_paid = max(0, (invoice.amount_paid or 0) - db_payment.amount)
                invoice.amount_due = invoice.grand_total - invoice.amount_paid
                if invoice.amount_paid == 0:
                    invoice.status = "Sent"
                elif invoice.amount_due > 0:
                    invoice.status = "Partially Paid"
        
        db.delete(db_payment)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting payment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")
