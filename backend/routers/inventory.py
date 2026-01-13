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

@router.post("/items", response_model=schemas.InventoryItem, status_code=201)
def create_inventory_item(item: schemas.InventoryItemCreate, db: Session = Depends(get_db)):
    """Create a new inventory item with validation"""
    from sqlalchemy.exc import SQLAlchemyError, IntegrityError
    
    try:
        if item.product_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid product ID")
        
        # Validate quantities with reasonable limits
        if item.quantity_on_hand < 0:
            raise HTTPException(status_code=400, detail="Quantity on hand cannot be negative")
        if item.quantity_on_hand > 1000000000:  # Reasonable upper limit
            raise HTTPException(status_code=400, detail="Quantity on hand is too large")
        
        if item.reorder_point < 0:
            raise HTTPException(status_code=400, detail="Reorder point cannot be negative")
        if item.reorder_quantity < 0:
            raise HTTPException(status_code=400, detail="Reorder quantity cannot be negative")
        
        if not item.location or len(item.location.strip()) == 0:
            raise HTTPException(status_code=400, detail="Location is required")
        if len(item.location) > 100:
            raise HTTPException(status_code=400, detail="Location name is too long (max 100 characters)")
        
        # Check if product exists
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Check if inventory item already exists for this product at this location
        existing = db.query(models.InventoryItem).filter(
            models.InventoryItem.product_id == item.product_id,
            models.InventoryItem.location == item.location.strip()
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Inventory item already exists for this product at this location")
        
        db_item = models.InventoryItem(**item.model_dump())
        db_item.location = db_item.location.strip()  # Sanitize location
        db_item.quantity_reserved = 0.0
        db_item.quantity_available = item.quantity_on_hand - db_item.quantity_reserved
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        
        # Load product relationship with eager loading
        db_item.product = db.query(models.Product).filter(models.Product.id == db_item.product_id).first()
        return db_item
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Constraint violation")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/items")
def get_inventory_items(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of records to return"),
    product_id: Optional[int] = Query(None, ge=1),
    location: Optional[str] = Query(None, max_length=100),
    low_stock: Optional[bool] = Query(None, description="Filter items below reorder point"),
    search: Optional[str] = Query(None, description="Search by product name or SKU", max_length=100),
    db: Session = Depends(get_db)
):
    """Get inventory items with pagination and filtering"""
    from sqlalchemy import func
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        query = db.query(models.InventoryItem)
        
        if product_id:
            query = query.filter(models.InventoryItem.product_id == product_id)
        if location:
            # Sanitize location input
            location_clean = location.strip()[:100]
            query = query.filter(models.InventoryItem.location == location_clean)
        if low_stock:
            query = query.filter(models.InventoryItem.quantity_on_hand <= models.InventoryItem.reorder_point)
        if search:
            # Sanitize search input
            search_clean = search.strip()[:100]
            if len(search_clean) > 0:
                search_term = f"%{search_clean}%"
                # Join with products table for search - use eager loading
                query = query.join(models.Product).filter(
                    (models.Product.name.ilike(search_term)) |
                    (models.Product.sku.ilike(search_term))
                )
        
        # Get total count before pagination
        total = query.count()
        
        # Get paginated results with eager loading to avoid N+1 queries
        items = query.options(
            joinedload(models.InventoryItem.product)
        ).order_by(models.InventoryItem.created_at.desc()).offset(skip).limit(limit).all()
        
        return {
            "items": items,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/items/{item_id}", response_model=schemas.InventoryItem)
def get_inventory_item(item_id: int, db: Session = Depends(get_db)):
    """Get a single inventory item by ID"""
    try:
        if item_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid item ID")
        
        item = db.query(models.InventoryItem).options(
            joinedload(models.InventoryItem.product)
        ).filter(models.InventoryItem.id == item_id).first()
        
        if not item:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        
        return item
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error getting inventory item: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error getting inventory item: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.put("/items/{item_id}", response_model=schemas.InventoryItem)
def update_inventory_item(
    item_id: int,
    item_update: schemas.InventoryItemUpdate,
    db: Session = Depends(get_db)
):
    """Update an inventory item with validation"""
    try:
        if item_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid item ID")
        
        db_item = db.query(models.InventoryItem).filter(models.InventoryItem.id == item_id).first()
        if not db_item:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        
        update_data = item_update.model_dump(exclude_unset=True)
        
        # Validate quantities
        if 'quantity_on_hand' in update_data:
            if update_data['quantity_on_hand'] < 0:
                raise HTTPException(status_code=400, detail="Quantity on hand cannot be negative")
            if update_data['quantity_on_hand'] > 1000000000:
                raise HTTPException(status_code=400, detail="Quantity on hand is too large")
        
        if 'reorder_point' in update_data and update_data['reorder_point'] < 0:
            raise HTTPException(status_code=400, detail="Reorder point cannot be negative")
        if 'reorder_quantity' in update_data and update_data['reorder_quantity'] < 0:
            raise HTTPException(status_code=400, detail="Reorder quantity cannot be negative")
        
        if 'location' in update_data:
            if not update_data['location'] or len(update_data['location'].strip()) == 0:
                raise HTTPException(status_code=400, detail="Location cannot be empty")
            if len(update_data['location']) > 100:
                raise HTTPException(status_code=400, detail="Location name is too long")
            update_data['location'] = update_data['location'].strip()
        
        for field, value in update_data.items():
            setattr(db_item, field, value)
        
        # Recalculate available quantity
        db_item.quantity_available = db_item.quantity_on_hand - db_item.quantity_reserved
        if db_item.quantity_available < 0:
            db_item.quantity_available = 0
        
        db.commit()
        db.refresh(db_item)
        
        # Load product relationship with eager loading
        db_item.product = db.query(models.Product).filter(models.Product.id == db_item.product_id).first()
        return db_item
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error updating inventory item: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Constraint violation")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error updating inventory item: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating inventory item: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.post("/movements", response_model=schemas.InventoryMovement, status_code=201)
def create_inventory_movement(movement: schemas.InventoryMovementCreate, db: Session = Depends(get_db)):
    """Create an inventory movement with validation and quantity updates"""
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        if movement.inventory_item_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid inventory item ID")
        
        # Validate movement type
        valid_types = ["IN", "OUT", "ADJUST", "TRANSFER"]
        if movement.movement_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid movement type. Must be one of: {', '.join(valid_types)}"
            )
        
        # Validate quantity with reasonable limits
        if movement.quantity <= 0:
            raise HTTPException(status_code=400, detail="Movement quantity must be greater than 0")
        if movement.quantity > 1000000000:  # Reasonable upper limit
            raise HTTPException(status_code=400, detail="Movement quantity is too large")
        
        # Verify inventory item exists
        inventory_item = db.query(models.InventoryItem).filter(
            models.InventoryItem.id == movement.inventory_item_id
        ).first()
        if not inventory_item:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        
        # Create movement record
        db_movement = models.InventoryMovement(**movement.model_dump())
        db.add(db_movement)
        
        # Update inventory quantities based on movement type
        if movement.movement_type == "IN":
            # Check for overflow
            if inventory_item.quantity_on_hand + movement.quantity > 1000000000:
                db.rollback()
                raise HTTPException(status_code=400, detail="Quantity would exceed maximum limit")
            inventory_item.quantity_on_hand += movement.quantity
        elif movement.movement_type == "OUT":
            if inventory_item.quantity_available < movement.quantity:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient inventory available. Available: {inventory_item.quantity_available}, Requested: {movement.quantity}"
                )
            inventory_item.quantity_on_hand -= movement.quantity
            # Check for negative quantity
            if inventory_item.quantity_on_hand < 0:
                inventory_item.quantity_on_hand = 0
        elif movement.movement_type == "ADJUST":
            if movement.quantity < 0:
                db.rollback()
                raise HTTPException(status_code=400, detail="Adjusted quantity cannot be negative")
            if movement.quantity > 1000000000:
                db.rollback()
                raise HTTPException(status_code=400, detail="Adjusted quantity is too large")
            inventory_item.quantity_on_hand = movement.quantity
        # TRANSFER handled separately if needed
        
        # Recalculate available quantity
        inventory_item.quantity_available = inventory_item.quantity_on_hand - inventory_item.quantity_reserved
        if inventory_item.quantity_available < 0:
            inventory_item.quantity_available = 0
        
        db.commit()
        db.refresh(db_movement)
        return db_movement
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/movements", response_model=List[schemas.InventoryMovement])
def get_inventory_movements(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    inventory_item_id: Optional[int] = Query(None, ge=1),
    movement_type: Optional[str] = Query(None, max_length=50),
    db: Session = Depends(get_db)
):
    """Get inventory movements with filtering"""
    try:
        query = db.query(models.InventoryMovement)
        
        if inventory_item_id:
            query = query.filter(models.InventoryMovement.inventory_item_id == inventory_item_id)
        if movement_type:
            valid_types = ["IN", "OUT", "ADJUST", "TRANSFER"]
            if movement_type not in valid_types:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid movement type. Must be one of: {', '.join(valid_types)}"
                )
            query = query.filter(models.InventoryMovement.movement_type == movement_type)
        
        return query.order_by(models.InventoryMovement.created_at.desc()).offset(skip).limit(limit).all()
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error getting movements: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error getting movements: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/low-stock", response_model=List[schemas.InventoryItem])
def get_low_stock_items(db: Session = Depends(get_db)):
    """Get all inventory items below reorder point"""
    try:
        # Use eager loading to avoid N+1 queries
        items = db.query(models.InventoryItem).options(
            joinedload(models.InventoryItem.product)
        ).filter(
            models.InventoryItem.quantity_on_hand <= models.InventoryItem.reorder_point
        ).all()
        
        return items
    except SQLAlchemyError as e:
        logger.error(f"Database error getting low stock items: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error getting low stock items: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

