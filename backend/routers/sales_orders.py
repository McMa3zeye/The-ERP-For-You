from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import List, Optional
from datetime import datetime
import sys
import os
import logging

logger = logging.getLogger(__name__)

# Add parent directory to path so we can import from backend folder
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
from database import get_db, engine
import models
import schemas
import utils

router = APIRouter()

@router.post("/", response_model=schemas.SalesOrder, status_code=201)
@router.post("", response_model=schemas.SalesOrder, status_code=201)  # Support both with and without trailing slash
def create_sales_order(order: schemas.SalesOrderCreate, db: Session = Depends(get_db)):
    """Create a new sales order with validation"""
    from sqlalchemy.exc import SQLAlchemyError, IntegrityError
    
    try:
        # Validate customer - either customer_id or customer_name must be provided
        customer = None
        customer_name = None
        customer_email = None
        customer_address = None
        
        if order.customer_id:
            # Get customer by ID
            customer = db.query(models.Customer).filter(models.Customer.id == order.customer_id).first()
            if not customer:
                raise HTTPException(status_code=404, detail=f"Customer {order.customer_id} not found")
            customer_name = customer.company_name
            customer_email = customer.email
            customer_address = customer.address
        elif order.customer_name:
            # Fallback to manual entry
            customer_name = order.customer_name.strip()
            if len(customer_name) == 0:
                raise HTTPException(status_code=400, detail="Customer name is required")
            if len(customer_name) > 255:
                raise HTTPException(status_code=400, detail="Customer name is too long")
            customer_email = order.customer_email.strip() if order.customer_email else None
            customer_address = order.customer_address.strip() if order.customer_address else None
        else:
            raise HTTPException(status_code=400, detail="Either customer_id or customer_name must be provided")
        
        if customer_email and len(customer_email) > 255:
            raise HTTPException(status_code=400, detail="Customer email is too long")
        
        if not order.items or len(order.items) == 0:
            raise HTTPException(status_code=400, detail="Sales order must have at least one item")
        
        if len(order.items) > 100:  # Reasonable limit
            raise HTTPException(status_code=400, detail="Sales order cannot have more than 100 items")
        
        # Validate all items first before processing
        for item_data in order.items:
            if item_data.product_id <= 0:
                raise HTTPException(status_code=400, detail="Invalid product ID in order items")
            if item_data.quantity <= 0:
                raise HTTPException(status_code=400, detail="Item quantity must be greater than 0")
            if item_data.quantity > 1000000:  # Reasonable limit
                raise HTTPException(status_code=400, detail="Item quantity is too large")
            if item_data.unit_price < 0:
                raise HTTPException(status_code=400, detail="Unit price cannot be negative")
            if item_data.unit_price > 1000000000:  # Reasonable limit
                raise HTTPException(status_code=400, detail="Unit price is too large")
            if item_data.discount_percent < 0 or item_data.discount_percent > 100:
                raise HTTPException(status_code=400, detail="Discount percent must be between 0 and 100")
        
        # Generate order number using utils (SO000000 format)
        try:
            order_number = utils.generate_sales_order_number(db)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating order number: {str(e)}")
        
        # Calculate totals
        total_amount = 0.0
        order_items = []
        
        for item_data in order.items:
            # Verify product exists
            product = db.query(models.Product).filter(models.Product.id == item_data.product_id).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found")
            
            if not product.is_active:
                raise HTTPException(status_code=400, detail=f"Product {product.sku} is inactive and cannot be ordered")
            
            # Use product's base price if unit_price is 0 or not provided
            unit_price = item_data.unit_price if item_data.unit_price > 0 else product.base_price
            
            # Calculate line total with precision
            discount_amount = (unit_price * item_data.quantity) * (item_data.discount_percent / 100)
            line_total = round((unit_price * item_data.quantity) - discount_amount, 2)
            
            order_items.append(models.SalesOrderItem(
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                unit_price=unit_price,
                discount_percent=item_data.discount_percent,
                line_total=line_total,
                notes=item_data.notes
            ))
            
            total_amount += line_total
        
        # Calculate tax (simplified - 10% for now, configurable later)
        # Get tax rate from environment or use default
        tax_rate = float(os.getenv("TAX_RATE", "0.10"))
        tax_amount = round(total_amount * tax_rate, 2)
        grand_total = round(total_amount + tax_amount, 2)
    
        # Create order
        db_order = models.SalesOrder(
            order_number=order_number,
            customer_id=order.customer_id if order.customer_id else None,
            customer_name=customer_name,
            customer_email=customer_email,
            customer_address=customer_address,
            shipping_address=order.shipping_address.strip() if order.shipping_address else None,
            shipping_method=order.shipping_method.strip() if order.shipping_method else None,
            status=order.status,
            notes=order.notes.strip() if order.notes else None,
            total_amount=round(total_amount, 2),
            tax_amount=tax_amount,
            grand_total=grand_total,
            items=order_items
        )
        
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        # Load product relationships for items with eager loading
        for item in db_order.items:
            item.product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        
        return db_order
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Order number already exists or constraint violation")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating sales order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating sales order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/", response_model=schemas.SalesOrderList)
@router.get("", response_model=schemas.SalesOrderList)  # Support both with and without trailing slash
def get_sales_orders(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of records to return"),
    status: Optional[str] = Query(None, max_length=50),
    search: Optional[str] = Query(None, description="Search by customer name or order number", max_length=100),
    db: Session = Depends(get_db)
):
    """Get sales orders with pagination and filtering"""
    from sqlalchemy import func, inspect
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        query = db.query(models.SalesOrder)
        
        # Validate status if provided
        valid_statuses = [
            "Order Created", "Order Accepted", "Ready for Production",
            "In Production", "Finished Production", "Order Shipped", "Order Received"
        ]
        if status:
            if status not in valid_statuses:
                raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
            query = query.filter(models.SalesOrder.status == status)
        
        if search:
            # Sanitize search input
            search_clean = search.strip()[:100]
            if len(search_clean) > 0:
                search_term = f"%{search_clean}%"
                query = query.filter(
                    (models.SalesOrder.customer_name.ilike(search_term)) |
                    (models.SalesOrder.order_number.ilike(search_term))
                )
        
        # Get total count
        total = query.count()
        
        # Check if customer_id column exists in the database
        inspector = inspect(engine)
        has_customer_id = False
        try:
            columns = [col['name'] for col in inspector.get_columns('sales_orders')]
            has_customer_id = 'customer_id' in columns
        except Exception:
            # Table might not exist yet or inspection failed
            has_customer_id = False
        
        # Get paginated results with eager loading to avoid N+1 queries
        # Try to include customer eager loading, but fallback if schema doesn't support it
        try:
            if has_customer_id:
                try:
                    orders = query.options(
                        joinedload(models.SalesOrder.items).joinedload(models.SalesOrderItem.product),
                        joinedload(models.SalesOrder.customer)
                    ).order_by(models.SalesOrder.created_at.desc()).offset(skip).limit(limit).all()
                except Exception as customer_error:
                    # If customer loading fails, fall back to without it
                    logger.warning(f"Error loading customers with eager loading, using fallback: {customer_error}")
                    orders = query.options(
                        joinedload(models.SalesOrder.items).joinedload(models.SalesOrderItem.product)
                    ).order_by(models.SalesOrder.created_at.desc()).offset(skip).limit(limit).all()
            else:
                # Fallback if customer_id column doesn't exist yet
                orders = query.options(
                    joinedload(models.SalesOrder.items).joinedload(models.SalesOrderItem.product)
                ).order_by(models.SalesOrder.created_at.desc()).offset(skip).limit(limit).all()
        except Exception as e:
            # Final fallback: try without any eager loading
            logger.error(f"Error loading orders with eager loading: {e}", exc_info=True)
            try:
                orders = query.order_by(models.SalesOrder.created_at.desc()).offset(skip).limit(limit).all()
                # Manually load relationships
                for order in orders:
                    db.refresh(order, ['items'])
                    for item in order.items:
                        db.refresh(item, ['product'])
            except Exception as e2:
                logger.error(f"Critical error loading orders: {e2}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Database error loading orders: {str(e2)}")
        
        return {
            "items": orders,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error in get_sales_orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error occurred: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error in get_sales_orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@router.get("/{order_id}", response_model=schemas.SalesOrder)
def get_sales_order(order_id: int, db: Session = Depends(get_db)):
    """Get a single sales order by ID"""
    try:
        if order_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid order ID")
        
        # Use eager loading to avoid N+1 queries
        order = db.query(models.SalesOrder).options(
            joinedload(models.SalesOrder.items).joinedload(models.SalesOrderItem.product),
            joinedload(models.SalesOrder.customer)
        ).filter(models.SalesOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        return order
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error getting sales order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error getting sales order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.put("/{order_id}", response_model=schemas.SalesOrder)
def update_sales_order(
    order_id: int,
    order_update: schemas.SalesOrderUpdate,
    db: Session = Depends(get_db)
):
    """Update a sales order with validation"""
    try:
        if order_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid order ID")
        
        db_order = db.query(models.SalesOrder).filter(models.SalesOrder.id == order_id).first()
        if not db_order:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        # Don't allow editing if order is at final status
        if db_order.status == "Order Received":
            raise HTTPException(status_code=400, detail="Cannot edit orders that are already received")
        
        update_data = order_update.model_dump(exclude_unset=True)
        
        # Validate update data
        if 'customer_name' in update_data:
            if not update_data['customer_name'] or len(update_data['customer_name'].strip()) == 0:
                raise HTTPException(status_code=400, detail="Customer name cannot be empty")
            if len(update_data['customer_name']) > 255:
                raise HTTPException(status_code=400, detail="Customer name is too long")
            update_data['customer_name'] = update_data['customer_name'].strip()
        
        if 'customer_email' in update_data and update_data['customer_email']:
            if len(update_data['customer_email']) > 255:
                raise HTTPException(status_code=400, detail="Customer email is too long")
            update_data['customer_email'] = update_data['customer_email'].strip()
        
        if 'status' in update_data:
            valid_statuses = [
                "Order Created", "Order Accepted", "Ready for Production",
                "In Production", "Finished Production", "Order Shipped", "Order Received"
            ]
            if update_data['status'] not in valid_statuses:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
                )
        
        for field, value in update_data.items():
            setattr(db_order, field, value)
        
        db.commit()
        db.refresh(db_order)
        
        # Load product relationships with eager loading
        db_order = db.query(models.SalesOrder).options(
            joinedload(models.SalesOrder.items).joinedload(models.SalesOrderItem.product)
        ).filter(models.SalesOrder.id == order_id).first()
        
        return db_order
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error updating sales order: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Constraint violation")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error updating sales order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating sales order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.post("/{order_id}/next-status", response_model=schemas.SalesOrder)
def advance_order_status(order_id: int, db: Session = Depends(get_db)):
    """Move order to next status in progression with material deduction"""
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        if order_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid order ID")
        
        db_order = db.query(models.SalesOrder).options(
            joinedload(models.SalesOrder.items).joinedload(models.SalesOrderItem.product)
        ).filter(models.SalesOrder.id == order_id).first()
        
        if not db_order:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        # Get next status
        next_status = utils.get_next_status(db_order.status)
        if not next_status:
            raise HTTPException(status_code=400, detail="Order is already at final status")
        
        # If moving to "Ready for Production", deduct materials
        if next_status == "Ready for Production":
            # For each order item (product), deduct its ingredients
            # Use eager loading to avoid N+1 queries
            for order_item in db_order.items:
                product = order_item.product
                if not product:
                    product = db.query(models.Product).filter(models.Product.id == order_item.product_id).first()
                    if not product:
                        logger.warning(f"Product {order_item.product_id} not found for order item {order_item.id}")
                        continue
                
                # Only process Final products (Sub-assemblies are materials themselves)
                if product.product_type != "Final":
                    continue
                
                # Get ingredients for this product with eager loading
                ingredients = db.query(models.ProductIngredient).options(
                    joinedload(models.ProductIngredient.ingredient)
                ).filter(
                    models.ProductIngredient.product_id == product.id
                ).all()
                
                for ingredient_rel in ingredients:
                    ingredient_product = ingredient_rel.ingredient
                    if not ingredient_product:
                        ingredient_product = db.query(models.Product).filter(
                            models.Product.id == ingredient_rel.ingredient_id
                        ).first()
                        if not ingredient_product:
                            logger.warning(f"Ingredient product {ingredient_rel.ingredient_id} not found")
                            continue
                    
                    # Calculate total quantity needed (order quantity × ingredient quantity per product)
                    total_needed = order_item.quantity * ingredient_rel.quantity
                    
                    if total_needed <= 0:
                        continue
                    
                    # Find inventory for this ingredient material
                    inventory_item = db.query(models.InventoryItem).filter(
                        models.InventoryItem.product_id == ingredient_product.id
                    ).first()
                    
                    if inventory_item:
                        if inventory_item.quantity_available < total_needed:
                            db.rollback()
                            raise HTTPException(
                                status_code=400,
                                detail=f"Insufficient material {ingredient_product.sku} ({ingredient_product.name}). "
                                       f"Available: {inventory_item.quantity_available}, Needed: {total_needed}"
                            )
                        
                        # Deduct from inventory
                        inventory_item.quantity_on_hand -= total_needed
                        inventory_item.quantity_available = inventory_item.quantity_on_hand - inventory_item.quantity_reserved
                        if inventory_item.quantity_available < 0:
                            inventory_item.quantity_available = 0
                        
                        # Create inventory movement record
                        movement = models.InventoryMovement(
                            inventory_item_id=inventory_item.id,
                            movement_type="OUT",
                            quantity=total_needed,
                            reference_type="SALES_ORDER",
                            reference_id=order_id,
                            notes=f"Used for {product.sku} in order {db_order.order_number}"
                        )
                        db.add(movement)
                    else:
                        db.rollback()
                        raise HTTPException(
                            status_code=400,
                            detail=f"Inventory not found for material {ingredient_product.sku} ({ingredient_product.name}). "
                                   f"Please create inventory item first."
                        )
        
        # Update status
        db_order.status = next_status
        db.commit()
        db.refresh(db_order)
        
        # Reload with eager loading
        db_order = db.query(models.SalesOrder).options(
            joinedload(models.SalesOrder.items).joinedload(models.SalesOrderItem.product)
        ).filter(models.SalesOrder.id == order_id).first()
        
        return db_order
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error advancing order status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error advancing order status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.delete("/{order_id}", status_code=204)
def delete_sales_order(order_id: int, db: Session = Depends(get_db)):
    """Delete a sales order with validation"""
    try:
        if order_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid order ID")
        
        db_order = db.query(models.SalesOrder).filter(models.SalesOrder.id == order_id).first()
        if not db_order:
            raise HTTPException(status_code=404, detail="Sales order not found")
        
        if db_order.status != "Order Created":
            raise HTTPException(
                status_code=400,
                detail=f"Can only delete orders in 'Order Created' status. Current status: {db_order.status}"
            )
        
        db.delete(db_order)
        db.commit()
        return None
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error deleting sales order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error deleting sales order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

