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
import utils

router = APIRouter()

@router.post("/", response_model=schemas.Product, status_code=201)
@router.post("", response_model=schemas.Product, status_code=201)  # Support both with and without trailing slash
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    """Create a new product with auto-generated SKU"""
    from sqlalchemy.exc import SQLAlchemyError, IntegrityError
    
    try:
        # Validate product data
        if not product.name or len(product.name.strip()) == 0:
            raise HTTPException(status_code=400, detail="Product name is required")
        
        if product.base_price < 0:
            raise HTTPException(status_code=400, detail="Base price cannot be negative")
        
        if product.cost < 0:
            raise HTTPException(status_code=400, detail="Cost cannot be negative")
        
        if product.product_type not in ["Final", "Sub-assembly", "Raw Material"]:
            raise HTTPException(status_code=400, detail="Product type must be 'Final', 'Sub-assembly', or 'Raw Material'")
        
        # Auto-generate SKU
        try:
            sku = utils.generate_product_sku(db, product.product_type)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generating SKU: {str(e)}")
        
        product_data = product.model_dump()
        product_data["sku"] = sku
        db_product = models.Product(**product_data)
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
        return db_product
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Product with this SKU already exists or constraint violation")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("/categories")
@router.get("/categories/list")  # Support both endpoints
def get_product_categories(db: Session = Depends(get_db)):
    """Get list of all product categories"""
    from sqlalchemy import distinct
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        categories = db.query(distinct(models.Product.category)).filter(
            models.Product.category.isnot(None),
            models.Product.category != ""
        ).all()
        # Sort categories alphabetically and return as JSON-serializable list
        result = sorted([cat[0] for cat in categories if cat[0]])
        return result  # FastAPI will serialize this automatically
    except SQLAlchemyError as e:
        logger.error(f"Database error in get_product_categories: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        logger.error(f"Unexpected error in get_product_categories: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/", response_model=schemas.ProductList)
@router.get("", response_model=schemas.ProductList)  # Support both with and without trailing slash
def get_products(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=1000, description="Maximum number of records to return"),
    is_active: Optional[str] = Query(None, description="Filter by active status (true/false/1/0)"),
    category: Optional[str] = Query(None, description="Filter by category", max_length=100),
    product_type: Optional[str] = Query(None, description="Filter by product type (Final, Sub-assembly, or Raw Material)", max_length=20),
    search: Optional[str] = Query(None, description="Search by name or SKU", max_length=100),
    db: Session = Depends(get_db)
):
    """Get products with pagination and filtering"""
    from sqlalchemy import func
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        query = db.query(models.Product)
        
        # Handle is_active parameter - accept string and convert to bool
        if is_active is not None:
            # Convert string to boolean (handles "true", "false", "1", "0", etc.)
            if isinstance(is_active, str):
                active_bool = is_active.lower() in ('true', '1', 'yes', 'on')
            else:
                active_bool = bool(is_active)
            query = query.filter(models.Product.is_active == active_bool)
        if category:
            # Sanitize category input
            category_clean = category.strip()[:100]
            query = query.filter(models.Product.category == category_clean)
        if product_type:
            if product_type not in ["Final", "Sub-assembly", "Raw Material"]:
                raise HTTPException(status_code=400, detail="Invalid product_type. Must be 'Final', 'Sub-assembly', or 'Raw Material'")
            query = query.filter(models.Product.product_type == product_type)
        if search:
            # Sanitize search input and limit length
            search_clean = search.strip()[:100]
            if len(search_clean) > 0:
                search_term = f"%{search_clean}%"
                query = query.filter(
                    (models.Product.name.ilike(search_term)) |
                    (models.Product.sku.ilike(search_term))
                )
        
        # Get total count before pagination
        total = query.count()
        
        # Get paginated results with eager loading
        products = query.options(
            joinedload(models.Product.ingredients).joinedload(models.ProductIngredient.ingredient)
        ).order_by(models.Product.created_at.desc()).offset(skip).limit(limit).all()
        
        return {
            "items": products,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/{product_id}", response_model=schemas.Product)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get a single product by ID with eager loading of relationships"""
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        if product_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid product ID")
        
        product = db.query(models.Product).options(
            joinedload(models.Product.ingredients).joinedload(models.ProductIngredient.ingredient),
            joinedload(models.Product.order_items),
            joinedload(models.Product.inventory_items)
        ).filter(models.Product.id == product_id).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        return product
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.put("/{product_id}", response_model=schemas.Product)
def update_product(
    product_id: int,
    product_update: schemas.ProductUpdate,
    db: Session = Depends(get_db)
):
    """Update a product with validation"""
    from sqlalchemy.exc import SQLAlchemyError, IntegrityError
    
    try:
        if product_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid product ID")
        
        db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if not db_product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        update_data = product_update.model_dump(exclude_unset=True)
        
        # Validate update data
        if 'name' in update_data:
            if not update_data['name'] or len(update_data['name'].strip()) == 0:
                raise HTTPException(status_code=400, detail="Product name cannot be empty")
        
        if 'base_price' in update_data and update_data['base_price'] < 0:
            raise HTTPException(status_code=400, detail="Base price cannot be negative")
        
        if 'cost' in update_data and update_data['cost'] < 0:
            raise HTTPException(status_code=400, detail="Cost cannot be negative")
        
        if 'product_type' in update_data:
            if update_data['product_type'] not in ["Final", "Sub-assembly", "Raw Material"]:
                raise HTTPException(status_code=400, detail="Invalid product type")
            # Validate product_type can't be changed if product has ingredients
            if update_data['product_type'] != db_product.product_type:
                ingredients_count = db.query(models.ProductIngredient).filter(
                    models.ProductIngredient.product_id == product_id
                ).count()
                if ingredients_count > 0:
                    raise HTTPException(
                        status_code=400, 
                        detail="Cannot change product type: product has ingredients/materials assigned"
                    )
        
        for field, value in update_data.items():
            setattr(db_product, field, value)
        
        db.commit()
        db.refresh(db_product)
        return db_product
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

@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Delete a product with validation checks"""
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        if product_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid product ID")
        
        db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if not db_product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Check if product is used in any sales orders
        order_items_count = db.query(models.SalesOrderItem).filter(
            models.SalesOrderItem.product_id == product_id
        ).count()
        if order_items_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete product: it is used in {order_items_count} sales order(s). Set as inactive instead."
            )
        
        # Check if product is used as ingredient in other products
        used_as_ingredient = db.query(models.ProductIngredient).filter(
            models.ProductIngredient.ingredient_id == product_id
        ).count()
        if used_as_ingredient > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete product: it is used as ingredient in {used_as_ingredient} other product(s). Set as inactive instead."
            )
        
        # Check if product has inventory items
        inventory_count = db.query(models.InventoryItem).filter(
            models.InventoryItem.product_id == product_id
        ).count()
        if inventory_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete product: it has {inventory_count} inventory item(s). Set as inactive instead."
            )
        
        db.delete(db_product)
        db.commit()
        return None
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

# Product Ingredients (BOM) endpoints
@router.post("/{product_id}/ingredients", response_model=schemas.ProductIngredient, status_code=201)
def add_product_ingredient(
    product_id: int,
    ingredient: schemas.ProductIngredientCreate,
    db: Session = Depends(get_db)
):
    """Add an ingredient to a product"""
    from sqlalchemy.exc import SQLAlchemyError, IntegrityError
    
    try:
        if product_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid product ID")
        
        if ingredient.ingredient_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid ingredient ID")
        
        # Validate quantity
        if ingredient.quantity <= 0:
            raise HTTPException(status_code=400, detail="Ingredient quantity must be greater than 0")
        
        if ingredient.quantity > 1000000:  # Reasonable upper limit
            raise HTTPException(status_code=400, detail="Ingredient quantity is too large")
        
        # Verify product exists
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Prevent circular dependencies (product can't be ingredient of itself)
        if product_id == ingredient.ingredient_id:
            raise HTTPException(status_code=400, detail="Product cannot be an ingredient of itself")
        
        # Verify ingredient exists and is Sub-assembly type
        ingredient_product = db.query(models.Product).filter(models.Product.id == ingredient.ingredient_id).first()
        if not ingredient_product:
            raise HTTPException(status_code=404, detail="Ingredient product not found")
        
        # Allow Sub-assembly and Raw Material as ingredients
        if ingredient_product.product_type not in ["Sub-assembly", "Raw Material"]:
            raise HTTPException(
                status_code=400, 
                detail="Only Sub-assembly or Raw Material products can be used as ingredients/materials"
            )
        
        # Check if already exists
        existing = db.query(models.ProductIngredient).filter(
            models.ProductIngredient.product_id == product_id,
            models.ProductIngredient.ingredient_id == ingredient.ingredient_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="This ingredient is already added to the product")
        
        db_ingredient = models.ProductIngredient(
            product_id=product_id,
            ingredient_id=ingredient.ingredient_id,
            quantity=ingredient.quantity
        )
        db.add(db_ingredient)
        db.commit()
        db.refresh(db_ingredient)
        return db_ingredient
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="This ingredient relationship already exists or constraint violation")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/{product_id}/ingredients", response_model=List[schemas.ProductIngredient])
def get_product_ingredients(product_id: int, db: Session = Depends(get_db)):
    """Get all ingredients for a product"""
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        if product_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid product ID")
        
        # Verify product exists
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Use eager loading to avoid N+1 queries
        ingredients = db.query(models.ProductIngredient).options(
            joinedload(models.ProductIngredient.ingredient)
        ).filter(
            models.ProductIngredient.product_id == product_id
        ).all()
        
        return ingredients
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.delete("/{product_id}/ingredients/{ingredient_id}", status_code=204)
def remove_product_ingredient(
    product_id: int,
    ingredient_id: int,
    db: Session = Depends(get_db)
):
    """Remove an ingredient from a product"""
    try:
        if product_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid product ID")
        if ingredient_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid ingredient ID")
        
        db_ingredient = db.query(models.ProductIngredient).filter(
            models.ProductIngredient.product_id == product_id,
            models.ProductIngredient.id == ingredient_id
        ).first()
        if not db_ingredient:
            raise HTTPException(status_code=404, detail="Ingredient not found")
        
        db.delete(db_ingredient)
        db.commit()
        return None
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error removing ingredient: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error removing ingredient: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")

@router.get("/{product_id}/sales-orders")
def get_product_sales_orders(product_id: int, db: Session = Depends(get_db)):
    """Get all sales orders that contain this product"""
    from sqlalchemy.exc import SQLAlchemyError
    
    try:
        if product_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid product ID")
        
        # Verify product exists
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Use more efficient query with eager loading to avoid N+1
        orders = db.query(models.SalesOrder).join(
            models.SalesOrderItem
        ).filter(
            models.SalesOrderItem.product_id == product_id
        ).options(
            joinedload(models.SalesOrder.items).joinedload(models.SalesOrderItem.product)
        ).distinct().all()
        
        return orders
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail="Database error occurred")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
