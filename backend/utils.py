"""
Utility functions for SKU and order number generation
"""
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from threading import Lock
import logging
import models

logger = logging.getLogger(__name__)

# Lock for thread-safe SKU/order number generation
_sku_lock = Lock()
_order_lock = Lock()

def generate_product_sku(db: Session, product_type: str = "Final") -> str:
    """
    Generate unique SKU in format:
    - Products: P-xxxx-0000-0000
    - Materials: M-xxxx-0000-0000
    
    Where xxxx is year (e.g., 2026) and 0000-0000 is sequential number
    
    Thread-safe implementation to prevent race conditions.
    """
    # Validate product_type
    if product_type not in ["Final", "Sub-assembly", "Raw Material"]:
        logger.warning(f"Invalid product_type '{product_type}', defaulting to 'Final'")
        product_type = "Final"
    
    # SKU prefix: P for Final, M for Sub-assembly, R for Raw Material
    if product_type == "Final":
        prefix = "P"
    elif product_type == "Sub-assembly":
        prefix = "M"
    else:  # Raw Material
        prefix = "R"
    year = datetime.now().strftime("%Y")
    
    # Use lock to prevent race conditions
    with _sku_lock:
        try:
            # Find last SKU with this prefix and year
            last_product = db.query(models.Product).filter(
                models.Product.sku.like(f"{prefix}-{year}-%")
            ).order_by(models.Product.id.desc()).first()
        except SQLAlchemyError as e:
            logger.error(f"Database error in SKU generation: {e}", exc_info=True)
            # If column doesn't exist yet, just find any product with this prefix
            try:
                last_product = db.query(models.Product).filter(
                    models.Product.sku.like(f"{prefix}-%")
                ).order_by(models.Product.id.desc()).first()
            except SQLAlchemyError as e2:
                logger.error(f"Database error in fallback SKU generation: {e2}", exc_info=True)
                last_product = None
        
        if last_product and last_product.sku:
            # Extract sequence number from SKU like "P-2026-0001-0001"
            parts = last_product.sku.split("-")
            if len(parts) == 4:
                try:
                    seq1 = int(parts[2])
                    seq2 = int(parts[3])
                    # Validate sequence numbers
                    if seq1 < 0 or seq1 > 9999 or seq2 < 0 or seq2 > 9999:
                        logger.warning(f"Invalid sequence numbers in SKU {last_product.sku}, resetting")
                        seq1 = 1
                        seq2 = 1
                    else:
                        # Increment
                        if seq2 < 9999:
                            seq2 += 1
                        else:
                            seq2 = 1
                            seq1 += 1
                            if seq1 > 9999:
                                logger.error("SKU sequence overflow!")
                                seq1 = 1
                                seq2 = 1
                except (ValueError, IndexError) as e:
                    logger.warning(f"Error parsing SKU {last_product.sku}: {e}, resetting sequence")
                    seq1 = 1
                    seq2 = 1
            else:
                seq1 = 1
                seq2 = 1
        else:
            seq1 = 1
            seq2 = 1
        
        sku = f"{prefix}-{year}-{seq1:04d}-{seq2:04d}"
        
        # Double-check SKU doesn't already exist (rare but possible race condition)
        max_retries = 5
        retry_count = 0
        while retry_count < max_retries:
            existing = db.query(models.Product).filter(models.Product.sku == sku).first()
            if not existing:
                break
            # If exists, increment and try again
            if seq2 < 9999:
                seq2 += 1
            else:
                seq2 = 1
                seq1 += 1
            sku = f"{prefix}-{year}-{seq1:04d}-{seq2:04d}"
            retry_count += 1
        
        if retry_count >= max_retries:
            logger.error(f"Failed to generate unique SKU after {max_retries} retries")
            raise ValueError("Failed to generate unique SKU")
        
        return sku

def generate_sales_order_number(db: Session) -> str:
    """
    Generate unique Sales Order number in format: SO000000
    
    Thread-safe implementation to prevent race conditions.
    """
    # Use lock to prevent race conditions
    with _order_lock:
        try:
            # Find last order number
            last_order = db.query(models.SalesOrder).filter(
                models.SalesOrder.order_number.like("SO%")
            ).order_by(models.SalesOrder.id.desc()).first()
            
            if last_order and last_order.order_number:
                # Extract number from "SO000001"
                try:
                    num_str = last_order.order_number[2:]
                    if len(num_str) == 6:  # Validate format
                        num = int(num_str)
                        if num < 0 or num > 999999:
                            logger.warning(f"Invalid order number {last_order.order_number}, resetting")
                            num = 1
                        else:
                            num += 1
                            if num > 999999:
                                logger.error("Order number overflow!")
                                num = 1
                    else:
                        logger.warning(f"Invalid order number format {last_order.order_number}, resetting")
                        num = 1
                except (ValueError, IndexError) as e:
                    logger.warning(f"Error parsing order number {last_order.order_number}: {e}, resetting")
                    num = 1
            else:
                num = 1
            
            order_number = f"SO{num:06d}"
            
            # Double-check order number doesn't already exist
            max_retries = 5
            retry_count = 0
            while retry_count < max_retries:
                existing = db.query(models.SalesOrder).filter(
                    models.SalesOrder.order_number == order_number
                ).first()
                if not existing:
                    break
                # If exists, increment and try again
                num += 1
                if num > 999999:
                    num = 1
                order_number = f"SO{num:06d}"
                retry_count += 1
            
            if retry_count >= max_retries:
                logger.error(f"Failed to generate unique order number after {max_retries} retries")
                raise ValueError("Failed to generate unique order number")
            
            return order_number
            
        except SQLAlchemyError as e:
            logger.error(f"Database error in order number generation: {e}", exc_info=True)
            raise

# Status progression for Sales Orders
SO_STATUSES = [
    "Order Created",
    "Order Accepted", 
    "Ready for Production",
    "In Production",
    "Finished Production",
    "Order Shipped",
    "Order Received"
]

def get_next_status(current_status: str) -> str | None:
    """Get next status in progression, or None if at final status"""
    try:
        current_idx = SO_STATUSES.index(current_status)
        if current_idx < len(SO_STATUSES) - 1:
            return SO_STATUSES[current_idx + 1]
        return None  # Already at final status
    except ValueError:
        # If status not in list, start from beginning
        return SO_STATUSES[0]

