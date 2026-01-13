from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import List, Optional
import sys
import os
import logging

logger = logging.getLogger(__name__)

# Add parent directory to path so we can import from backend folder
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
from database import get_db
import models
import schemas

router = APIRouter()

@router.post("/", response_model=schemas.Customer, status_code=201)
@router.post("", response_model=schemas.Customer, status_code=201)  # Support both with and without trailing slash
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    """Create a new customer"""
    try:
        # Validate customer data
        if not customer.company_name or len(customer.company_name.strip()) == 0:
            raise HTTPException(status_code=400, detail="Company name is required")
        
        if len(customer.company_name) > 255:
            raise HTTPException(status_code=400, detail="Company name is too long")
        
        if customer.email and len(customer.email) > 255:
            raise HTTPException(status_code=400, detail="Email is too long")
        
        if customer.siret and len(customer.siret) > 50:
            raise HTTPException(status_code=400, detail="SIRET number is too long")
        
        # Create customer
        db_customer = models.Customer(**customer.model_dump())
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        return db_customer
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error creating customer: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Constraint violation")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating customer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating customer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/", response_model=schemas.CustomerList)
@router.get("", response_model=schemas.CustomerList)  # Support both with and without trailing slash
def get_customers(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of records to return"),
    search: Optional[str] = Query(None, description="Search by company name, email, or contact name", max_length=100),
    db: Session = Depends(get_db)
):
    """Get customers with pagination and filtering"""
    try:
        query = db.query(models.Customer)
        
        if search:
            # Sanitize search input
            search_clean = search.strip()[:100]
            if len(search_clean) > 0:
                search_term = f"%{search_clean}%"
                query = query.filter(
                    (models.Customer.company_name.ilike(search_term)) |
                    (models.Customer.email.ilike(search_term)) |
                    (models.Customer.contact_name.ilike(search_term))
                )
        
        # Get total count
        total = query.count()
        
        # Get paginated results
        customers = query.order_by(models.Customer.company_name.asc()).offset(skip).limit(limit).all()
        
        return {
            "items": customers,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except SQLAlchemyError as e:
        logger.error(f"Database error in get_customers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error in get_customers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/{customer_id}", response_model=schemas.Customer)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """Get a single customer by ID with their orders"""
    try:
        if customer_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID")
        
        customer = db.query(models.Customer).options(
            joinedload(models.Customer.orders).joinedload(models.SalesOrder.items)
        ).filter(models.Customer.id == customer_id).first()
        
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return customer
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error getting customer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error getting customer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.put("/{customer_id}", response_model=schemas.Customer)
def update_customer(
    customer_id: int,
    customer_update: schemas.CustomerUpdate,
    db: Session = Depends(get_db)
):
    """Update a customer"""
    try:
        if customer_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID")
        
        db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
        if not db_customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        update_data = customer_update.model_dump(exclude_unset=True)
        
        # Validate update data
        if 'company_name' in update_data:
            if not update_data['company_name'] or len(update_data['company_name'].strip()) == 0:
                raise HTTPException(status_code=400, detail="Company name cannot be empty")
            if len(update_data['company_name']) > 255:
                raise HTTPException(status_code=400, detail="Company name is too long")
            update_data['company_name'] = update_data['company_name'].strip()
        
        if 'email' in update_data and update_data['email']:
            if len(update_data['email']) > 255:
                raise HTTPException(status_code=400, detail="Email is too long")
            update_data['email'] = update_data['email'].strip()
        
        if 'siret' in update_data and update_data['siret']:
            if len(update_data['siret']) > 50:
                raise HTTPException(status_code=400, detail="SIRET number is too long")
            update_data['siret'] = update_data['siret'].strip()
        
        for field, value in update_data.items():
            setattr(db_customer, field, value)
        
        db.commit()
        db.refresh(db_customer)
        return db_customer
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error updating customer: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Constraint violation")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error updating customer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating customer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    """Delete a customer with validation checks"""
    try:
        if customer_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID")
        
        db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
        if not db_customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Check if customer has any orders
        orders_count = db.query(models.SalesOrder).filter(
            models.SalesOrder.customer_id == customer_id
        ).count()
        if orders_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete customer: they have {orders_count} sales order(s)."
            )
        
        db.delete(db_customer)
        db.commit()
        return None
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error deleting customer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error deleting customer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/{customer_id}/orders")
def get_customer_orders(customer_id: int, db: Session = Depends(get_db)):
    """Get all sales orders for a specific customer"""
    try:
        if customer_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid customer ID")
        
        # Verify customer exists
        customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get orders with eager loading
        orders = db.query(models.SalesOrder).options(
            joinedload(models.SalesOrder.items).joinedload(models.SalesOrderItem.product)
        ).filter(models.SalesOrder.customer_id == customer_id).order_by(models.SalesOrder.created_at.desc()).all()
        
        return orders
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error getting customer orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error getting customer orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
