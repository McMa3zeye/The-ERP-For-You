"""
Data Import Router
CSV/Excel import with validation and error reporting
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from typing import Optional, List, Dict, Any
from datetime import datetime
import csv
import io
import json
import logging

from database import get_db
from dependencies import get_current_user, require_superuser, AuditLogger, PermissionChecker
import models
import utils

logger = logging.getLogger(__name__)
router = APIRouter()


# =====================================================
# IMPORT CONFIGURATION
# =====================================================

# Define import schemas for each entity type
IMPORT_SCHEMAS = {
    "products": {
        "model": "Product",
        "required_fields": ["name", "product_type"],
        "optional_fields": ["description", "category", "wood_type", "dimensions", "base_price", "cost"],
        "field_types": {
            "name": str,
            "product_type": str,
            "description": str,
            "category": str,
            "wood_type": str,
            "dimensions": str,
            "base_price": float,
            "cost": float
        },
        "validators": {
            "product_type": lambda x: x in ["Final", "Sub-assembly", "Raw Material"]
        }
    },
    "customers": {
        "model": "Customer",
        "required_fields": ["company_name"],
        "optional_fields": ["contact_name", "email", "phone", "address", "city", "state", "zip_code", "country", "notes"],
        "field_types": {
            "company_name": str,
            "contact_name": str,
            "email": str,
            "phone": str,
            "address": str,
            "city": str,
            "state": str,
            "zip_code": str,
            "country": str,
            "notes": str
        }
    },
    "suppliers": {
        "model": "Supplier",
        "required_fields": ["name"],
        "optional_fields": ["contact_person", "email", "phone", "address", "city", "state", "zip_code", "country", "payment_terms", "lead_time_days", "notes"],
        "field_types": {
            "name": str,
            "contact_person": str,
            "email": str,
            "phone": str,
            "address": str,
            "city": str,
            "state": str,
            "zip_code": str,
            "country": str,
            "payment_terms": str,
            "lead_time_days": int,
            "notes": str
        }
    },
    "employees": {
        "model": "Employee",
        "required_fields": ["first_name", "last_name"],
        "optional_fields": ["email", "phone", "department", "position", "hire_date", "hourly_rate", "salary"],
        "field_types": {
            "first_name": str,
            "last_name": str,
            "email": str,
            "phone": str,
            "department": str,
            "position": str,
            "hire_date": "date",
            "hourly_rate": float,
            "salary": float
        }
    },
    "inventory": {
        "model": "InventoryItem",
        "required_fields": ["product_id", "quantity_on_hand"],
        "optional_fields": ["location", "reorder_point", "reorder_quantity"],
        "field_types": {
            "product_id": int,
            "quantity_on_hand": float,
            "location": str,
            "reorder_point": float,
            "reorder_quantity": float
        }
    },
    "chart_of_accounts": {
        "model": "ChartOfAccount",
        "required_fields": ["account_number", "name", "account_type"],
        "optional_fields": ["description", "normal_balance"],
        "field_types": {
            "account_number": str,
            "name": str,
            "account_type": str,
            "description": str,
            "normal_balance": str
        },
        "validators": {
            "account_type": lambda x: x.lower() in ["asset", "liability", "equity", "revenue", "expense"],
            "normal_balance": lambda x: x.lower() in ["debit", "credit"] if x else True
        }
    }
}


def parse_value(value: str, field_type) -> Any:
    """Parse a string value to the appropriate type"""
    if value is None or value.strip() == "":
        return None
    
    value = value.strip()
    
    if field_type == str:
        return value
    elif field_type == int:
        return int(float(value))  # Handle "10.0" -> 10
    elif field_type == float:
        return float(value.replace(",", "").replace("$", ""))
    elif field_type == bool:
        return value.lower() in ("true", "1", "yes", "y")
    elif field_type == "date":
        # Try common date formats
        for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]:
            try:
                return datetime.strptime(value, fmt)
            except:
                continue
        raise ValueError(f"Invalid date format: {value}")
    else:
        return value


def validate_row(row: Dict[str, str], schema: dict, row_num: int) -> tuple:
    """
    Validate a single row against the schema.
    Returns (parsed_data, errors)
    """
    errors = []
    parsed_data = {}
    
    # Check required fields
    for field in schema["required_fields"]:
        if field not in row or not row[field] or row[field].strip() == "":
            errors.append(f"Row {row_num}: Missing required field '{field}'")
    
    # Parse and validate all fields
    all_fields = schema["required_fields"] + schema.get("optional_fields", [])
    field_types = schema.get("field_types", {})
    validators = schema.get("validators", {})
    
    for field in all_fields:
        if field in row and row[field]:
            try:
                # Parse value
                field_type = field_types.get(field, str)
                parsed_value = parse_value(row[field], field_type)
                
                # Run custom validator if exists
                if field in validators and parsed_value is not None:
                    if not validators[field](parsed_value):
                        errors.append(f"Row {row_num}: Invalid value for '{field}': {row[field]}")
                        continue
                
                parsed_data[field] = parsed_value
                
            except Exception as e:
                errors.append(f"Row {row_num}: Error parsing '{field}': {str(e)}")
    
    return parsed_data, errors


# =====================================================
# IMPORT ENDPOINTS
# =====================================================

@router.get("/schemas")
def get_import_schemas(
    current_user: models.User = Depends(get_current_user)
):
    """Get available import schemas and their field requirements"""
    schemas_info = {}
    for name, schema in IMPORT_SCHEMAS.items():
        schemas_info[name] = {
            "required_fields": schema["required_fields"],
            "optional_fields": schema.get("optional_fields", []),
            "field_types": {k: str(v) if not isinstance(v, str) else v for k, v in schema.get("field_types", {}).items()}
        }
    return {"schemas": schemas_info}


@router.get("/template/{entity_type}")
def get_import_template(
    entity_type: str,
    current_user: models.User = Depends(get_current_user)
):
    """Get a CSV template for importing an entity type"""
    if entity_type not in IMPORT_SCHEMAS:
        raise HTTPException(status_code=400, detail=f"Unknown entity type. Available: {list(IMPORT_SCHEMAS.keys())}")
    
    schema = IMPORT_SCHEMAS[entity_type]
    all_fields = schema["required_fields"] + schema.get("optional_fields", [])
    
    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(all_fields)
    # Add example row
    example_row = [f"example_{field}" for field in all_fields]
    writer.writerow(example_row)
    
    return {
        "entity_type": entity_type,
        "template_csv": output.getvalue(),
        "fields": all_fields,
        "required": schema["required_fields"]
    }


@router.post("/validate/{entity_type}")
async def validate_import_file(
    entity_type: str,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    """
    Validate an import file without actually importing.
    Returns validation results and preview of data.
    """
    if entity_type not in IMPORT_SCHEMAS:
        raise HTTPException(status_code=400, detail=f"Unknown entity type. Available: {list(IMPORT_SCHEMAS.keys())}")
    
    schema = IMPORT_SCHEMAS[entity_type]
    
    try:
        # Read file
        contents = await file.read()
        text = contents.decode("utf-8-sig")  # Handle BOM
        
        reader = csv.DictReader(io.StringIO(text))
        
        all_errors = []
        valid_rows = []
        row_num = 1
        
        for row in reader:
            row_num += 1
            parsed_data, errors = validate_row(row, schema, row_num)
            
            if errors:
                all_errors.extend(errors)
            else:
                valid_rows.append(parsed_data)
        
        return {
            "filename": file.filename,
            "entity_type": entity_type,
            "total_rows": row_num - 1,
            "valid_rows": len(valid_rows),
            "error_count": len(all_errors),
            "errors": all_errors[:50],  # Limit error output
            "preview": valid_rows[:10],  # Preview first 10 valid rows
            "can_import": len(all_errors) == 0
        }
        
    except Exception as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")


@router.post("/import/{entity_type}")
async def import_data(
    entity_type: str,
    file: UploadFile = File(...),
    skip_errors: bool = Query(False, description="Continue importing even if some rows have errors"),
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """
    Import data from a CSV file.
    """
    if entity_type not in IMPORT_SCHEMAS:
        raise HTTPException(status_code=400, detail=f"Unknown entity type. Available: {list(IMPORT_SCHEMAS.keys())}")
    
    schema = IMPORT_SCHEMAS[entity_type]
    
    # Get the model class
    model_map = {
        "products": models.Product,
        "customers": models.Customer,
        "suppliers": models.Supplier,
        "employees": models.Employee,
        "inventory": models.InventoryItem,
        "chart_of_accounts": models.ChartOfAccount
    }
    
    model_class = model_map.get(entity_type)
    if not model_class:
        raise HTTPException(status_code=400, detail="Entity type not supported for import")
    
    try:
        # Read file
        contents = await file.read()
        text = contents.decode("utf-8-sig")
        
        reader = csv.DictReader(io.StringIO(text))
        
        all_errors = []
        imported_count = 0
        skipped_count = 0
        row_num = 1
        
        for row in reader:
            row_num += 1
            parsed_data, errors = validate_row(row, schema, row_num)
            
            if errors:
                all_errors.extend(errors)
                if not skip_errors:
                    db.rollback()
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "message": "Validation errors found",
                            "errors": all_errors,
                            "imported_before_error": imported_count
                        }
                    )
                skipped_count += 1
                continue
            
            try:
                # Special handling for products (auto-generate SKU)
                if entity_type == "products":
                    parsed_data["sku"] = utils.generate_product_sku(db, parsed_data.get("product_type", "Final"))
                
                # Create record
                record = model_class(**parsed_data)
                db.add(record)
                db.flush()  # Get ID immediately for error reporting
                imported_count += 1
                
            except IntegrityError as e:
                db.rollback()
                all_errors.append(f"Row {row_num}: Duplicate or constraint violation - {str(e)[:100]}")
                if not skip_errors:
                    raise HTTPException(status_code=400, detail={"message": "Database constraint error", "errors": all_errors})
                skipped_count += 1
        
        db.commit()
        
        logger.info(f"Import completed: {entity_type}, {imported_count} records by {current_user.username}")
        
        return {
            "message": "Import completed",
            "entity_type": entity_type,
            "imported": imported_count,
            "skipped": skipped_count,
            "errors": all_errors if all_errors else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


# =====================================================
# BULK OPERATIONS
# =====================================================

@router.post("/bulk-update/{entity_type}")
async def bulk_update(
    entity_type: str,
    file: UploadFile = File(...),
    id_column: str = Query("id", description="Column containing the record ID"),
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """
    Bulk update existing records from a CSV file.
    Requires an ID column to identify records.
    """
    model_map = {
        "products": models.Product,
        "customers": models.Customer,
        "suppliers": models.Supplier,
        "employees": models.Employee
    }
    
    model_class = model_map.get(entity_type)
    if not model_class:
        raise HTTPException(status_code=400, detail="Entity type not supported for bulk update")
    
    try:
        contents = await file.read()
        text = contents.decode("utf-8-sig")
        
        reader = csv.DictReader(io.StringIO(text))
        
        updated_count = 0
        not_found = []
        errors = []
        
        for row in reader:
            if id_column not in row or not row[id_column]:
                errors.append(f"Missing ID in row")
                continue
            
            try:
                record_id = int(row[id_column])
            except:
                errors.append(f"Invalid ID: {row[id_column]}")
                continue
            
            record = db.query(model_class).filter(model_class.id == record_id).first()
            if not record:
                not_found.append(record_id)
                continue
            
            # Update fields (excluding id)
            for field, value in row.items():
                if field != id_column and hasattr(record, field) and value:
                    try:
                        setattr(record, field, value)
                    except:
                        pass
            
            updated_count += 1
        
        db.commit()
        
        return {
            "message": "Bulk update completed",
            "updated": updated_count,
            "not_found": not_found,
            "errors": errors if errors else None
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Bulk update error: {e}")
        raise HTTPException(status_code=500, detail=f"Bulk update failed: {str(e)}")
