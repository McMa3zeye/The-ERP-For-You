from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
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

@router.get("/health")
def expenses_health():
    """Health check endpoint for expenses router"""
    return {"status": "ok", "router": "expenses"}

def generate_expense_number(db: Session) -> str:
    """Generate Expense number: EXP000000"""
    last = db.query(models.Expense).filter(models.Expense.expense_number.like("EXP%")).order_by(models.Expense.id.desc()).first()
    num = int(last.expense_number[3:]) + 1 if last and last.expense_number else 1
    return f"EXP{num:06d}"

@router.post("/", response_model=schemas.Expense, status_code=201)
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    """Create expense"""
    try:
        from datetime import datetime
        expense_data = expense.model_dump()
        # Ensure expense_date is properly handled
        if not expense_data.get('expense_date'):
            expense_data['expense_date'] = datetime.now()
        
        db_expense = models.Expense(
            expense_number=generate_expense_number(db),
            **expense_data
        )
        db.add(db_expense)
        db.commit()
        db.refresh(db_expense)
        return db_expense
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error creating expense: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Expense number already exists")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating expense: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while creating expense")

@router.get("/", response_model=schemas.ExpenseList)
def get_expenses(skip: int = Query(0), limit: int = Query(20), status: Optional[str] = None, category: Optional[str] = None, db: Session = Depends(get_db)):
    """Get expenses"""
    try:
        query = db.query(models.Expense)
        if status:
            query = query.filter(models.Expense.status == status)
        if category:
            query = query.filter(models.Expense.category == category)
        total = query.count()
        expenses = query.order_by(models.Expense.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": expenses, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error getting expenses: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/{expense_id}", response_model=schemas.Expense)
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    try:
        expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        return expense
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting expense: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.put("/{expense_id}", response_model=schemas.Expense)
def update_expense(expense_id: int, expense_update: schemas.ExpenseUpdate, db: Session = Depends(get_db)):
    try:
        db_expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
        if not db_expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        update_data = expense_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_expense, field, value)
        
        db.commit()
        db.refresh(db_expense)
        return db_expense
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating expense: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    try:
        db_expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
        if not db_expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        
        if db_expense.status == "Reimbursed":
            raise HTTPException(status_code=400, detail="Cannot delete reimbursed expense")
        
        db.delete(db_expense)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting expense: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")
