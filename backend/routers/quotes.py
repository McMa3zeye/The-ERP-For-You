from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import List, Optional
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
import utils

router = APIRouter()

def generate_quote_number(db: Session) -> str:
    """Generate unique Quote number in format: QT000000"""
    last_quote = db.query(models.Quote).filter(
        models.Quote.quote_number.like("QT%")
    ).order_by(models.Quote.id.desc()).first()
    
    if last_quote and last_quote.quote_number:
        try:
            num_str = last_quote.quote_number[2:]
            num = int(num_str) + 1 if num_str.isdigit() else 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    
    return f"QT{num:06d}"

@router.post("/", response_model=schemas.Quote, status_code=201)
def create_quote(quote: schemas.QuoteCreate, db: Session = Depends(get_db)):
    """Create a new quote"""
    try:
        customer_name = None
        customer_email = None
        customer_address = None
        
        if quote.customer_id:
            customer = db.query(models.Customer).filter(models.Customer.id == quote.customer_id).first()
            if not customer:
                raise HTTPException(status_code=404, detail="Customer not found")
            customer_name = customer.company_name
            customer_email = customer.email
            customer_address = customer.address
        elif quote.customer_name:
            customer_name = quote.customer_name.strip()
        else:
            raise HTTPException(status_code=400, detail="Either customer_id or customer_name must be provided")
        
        if not quote.items or len(quote.items) == 0:
            raise HTTPException(status_code=400, detail="Quote must have at least one item")
        
        quote_number = generate_quote_number(db)
        total_amount = 0.0
        quote_items = []
        
        for item_data in quote.items:
            product = db.query(models.Product).filter(models.Product.id == item_data.product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found")
            
            unit_price = item_data.unit_price if item_data.unit_price > 0 else product.base_price
            discount_amount = (unit_price * item_data.quantity) * (item_data.discount_percent / 100)
            line_total = round((unit_price * item_data.quantity) - discount_amount, 2)
            
            quote_items.append(models.QuoteItem(
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                unit_price=unit_price,
                discount_percent=item_data.discount_percent,
                line_total=line_total,
                notes=item_data.notes
            ))
            total_amount += line_total
        
        tax_rate = float(os.getenv("TAX_RATE", "0.10"))
        tax_amount = round(total_amount * tax_rate, 2)
        grand_total = round(total_amount + tax_amount, 2)
        
        db_quote = models.Quote(
            quote_number=quote_number,
            customer_id=quote.customer_id if quote.customer_id else None,
            customer_name=customer_name,
            customer_email=customer_email or quote.customer_email,
            customer_address=customer_address or quote.customer_address,
            valid_until=quote.valid_until,
            status=quote.status,
            notes=quote.notes,
            terms_conditions=quote.terms_conditions,
            total_amount=round(total_amount, 2),
            tax_amount=tax_amount,
            grand_total=grand_total,
            items=quote_items
        )
        
        db.add(db_quote)
        db.commit()
        db.refresh(db_quote)
        
        for item in db_quote.items:
            item.product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        
        return db_quote
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Quote number already exists")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating quote: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/", response_model=schemas.QuoteList)
def get_quotes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db)
):
    """Get quotes with pagination and filtering"""
    try:
        query = db.query(models.Quote)
        
        if status:
            query = query.filter(models.Quote.status == status)
        if search:
            search_term = f"%{search.strip()}%"
            query = query.filter(
                (models.Quote.quote_number.ilike(search_term)) |
                (models.Quote.customer_name.ilike(search_term))
            )
        
        total = query.count()
        quotes = query.options(
            joinedload(models.Quote.items).joinedload(models.QuoteItem.product),
            joinedload(models.Quote.customer)
        ).order_by(models.Quote.created_at.desc()).offset(skip).limit(limit).all()
        
        return {"items": quotes, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error getting quotes: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/{quote_id}", response_model=schemas.Quote)
def get_quote(quote_id: int, db: Session = Depends(get_db)):
    """Get a single quote by ID"""
    try:
        quote = db.query(models.Quote).options(
            joinedload(models.Quote.items).joinedload(models.QuoteItem.product),
            joinedload(models.Quote.customer)
        ).filter(models.Quote.id == quote_id).first()
        
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        return quote
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting quote: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.put("/{quote_id}", response_model=schemas.Quote)
def update_quote(quote_id: int, quote_update: schemas.QuoteUpdate, db: Session = Depends(get_db)):
    """Update a quote"""
    try:
        db_quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
        if not db_quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        update_data = quote_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_quote, field, value)
        
        db.commit()
        db.refresh(db_quote)
        
        db_quote = db.query(models.Quote).options(
            joinedload(models.Quote.items).joinedload(models.QuoteItem.product)
        ).filter(models.Quote.id == quote_id).first()
        
        return db_quote
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating quote: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.delete("/{quote_id}", status_code=204)
def delete_quote(quote_id: int, db: Session = Depends(get_db)):
    """Delete a quote"""
    try:
        db_quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
        if not db_quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        if db_quote.status == "Accepted":
            raise HTTPException(status_code=400, detail="Cannot delete accepted quote")
        
        db.delete(db_quote)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting quote: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")
