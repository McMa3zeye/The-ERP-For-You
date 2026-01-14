"""
System Settings & Company Configuration Router
Manages company-wide settings, preferences, and configuration
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from datetime import datetime
from database import get_db
from dependencies import get_current_user, require_superuser, AuditLogger
import models
import schemas
import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter()


# =====================================================
# SYSTEM SETTINGS CRUD
# =====================================================

@router.get("/")
@router.get("")
def get_all_settings(
    include_private: bool = False,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all system settings (public or all if admin)"""
    try:
        query = db.query(models.SystemSetting)
        
        # Non-superusers only see public settings
        if not current_user.is_superuser and not include_private:
            query = query.filter(models.SystemSetting.is_public == True)
        
        settings = query.order_by(models.SystemSetting.key).all()
        
        # Convert to dict for easy consumption
        result = {}
        for s in settings:
            value = s.value
            # Parse JSON values
            if s.data_type == "json" and value:
                try:
                    value = json.loads(value)
                except:
                    pass
            elif s.data_type == "integer" and value:
                try:
                    value = int(value)
                except:
                    pass
            elif s.data_type == "boolean" and value:
                value = value.lower() in ("true", "1", "yes")
            elif s.data_type == "float" and value:
                try:
                    value = float(value)
                except:
                    pass
            result[s.key] = value
        
        return {"settings": result}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/{key}")
def get_setting(
    key: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific setting by key"""
    setting = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == key
    ).first()
    
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    # Check access
    if not setting.is_public and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return setting


@router.put("/{key}")
def update_setting(
    key: str,
    value: str,
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """Update a system setting (admin only)"""
    try:
        setting = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == key
        ).first()
        
        if not setting:
            raise HTTPException(status_code=404, detail="Setting not found")
        
        old_value = setting.value
        setting.value = value
        db.commit()
        
        logger.info(f"Setting '{key}' updated by user {current_user.username}")
        
        return {"message": "Setting updated", "key": key, "old_value": old_value, "new_value": value}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating setting: {e}")
        raise HTTPException(status_code=500, detail="Error updating setting")


@router.post("/")
@router.post("")
def create_setting(
    key: str,
    value: str,
    description: Optional[str] = None,
    data_type: str = "string",
    is_public: bool = False,
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """Create a new system setting (admin only)"""
    try:
        existing = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == key
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Setting already exists")
        
        setting = models.SystemSetting(
            key=key,
            value=value,
            description=description,
            data_type=data_type,
            is_public=is_public
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
        
        return setting
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating setting: {e}")
        raise HTTPException(status_code=500, detail="Error creating setting")


@router.post("/init-company")
def initialize_company_settings(
    company_name: str,
    company_address: Optional[str] = None,
    company_phone: Optional[str] = None,
    company_email: Optional[str] = None,
    tax_rate: float = 0.0,
    currency: str = "USD",
    currency_symbol: str = "$",
    date_format: str = "MM/DD/YYYY",
    fiscal_year_start: str = "01-01",
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """Initialize company settings (first-time setup)"""
    try:
        default_settings = [
            # Company Info
            {"key": "company.name", "value": company_name, "description": "Company name", "is_public": True},
            {"key": "company.address", "value": company_address or "", "description": "Company address", "is_public": True},
            {"key": "company.phone", "value": company_phone or "", "description": "Company phone", "is_public": True},
            {"key": "company.email", "value": company_email or "", "description": "Company email", "is_public": True},
            {"key": "company.logo_url", "value": "", "description": "Company logo URL", "is_public": True},
            
            # Financial
            {"key": "finance.currency", "value": currency, "description": "Default currency code", "is_public": True},
            {"key": "finance.currency_symbol", "value": currency_symbol, "description": "Currency symbol", "is_public": True},
            {"key": "finance.tax_rate", "value": str(tax_rate), "data_type": "float", "description": "Default tax rate (%)", "is_public": True},
            {"key": "finance.fiscal_year_start", "value": fiscal_year_start, "description": "Fiscal year start (MM-DD)", "is_public": False},
            {"key": "finance.payment_terms_days", "value": "30", "data_type": "integer", "description": "Default payment terms", "is_public": False},
            
            # Inventory
            {"key": "inventory.costing_method", "value": "average", "description": "Inventory costing method (average, fifo, lifo)", "is_public": False},
            {"key": "inventory.low_stock_threshold", "value": "10", "data_type": "integer", "description": "Default low stock alert threshold", "is_public": False},
            {"key": "inventory.allow_negative", "value": "false", "data_type": "boolean", "description": "Allow negative inventory", "is_public": False},
            
            # Orders
            {"key": "orders.require_approval", "value": "false", "data_type": "boolean", "description": "Require approval for orders over threshold", "is_public": False},
            {"key": "orders.approval_threshold", "value": "10000", "data_type": "float", "description": "Order amount requiring approval", "is_public": False},
            {"key": "orders.auto_generate_invoice", "value": "false", "data_type": "boolean", "description": "Auto-generate invoice on shipment", "is_public": False},
            
            # Formatting
            {"key": "format.date", "value": date_format, "description": "Date format", "is_public": True},
            {"key": "format.decimal_places", "value": "2", "data_type": "integer", "description": "Decimal places for money", "is_public": True},
            
            # Security
            {"key": "security.session_timeout_minutes", "value": "480", "data_type": "integer", "description": "Session timeout in minutes", "is_public": False},
            {"key": "security.max_login_attempts", "value": "5", "data_type": "integer", "description": "Max failed login attempts before lockout", "is_public": False},
            {"key": "security.lockout_duration_minutes", "value": "30", "data_type": "integer", "description": "Account lockout duration", "is_public": False},
            {"key": "security.password_min_length", "value": "8", "data_type": "integer", "description": "Minimum password length", "is_public": False},
            
            # Notifications
            {"key": "notifications.email_enabled", "value": "false", "data_type": "boolean", "description": "Enable email notifications", "is_public": False},
            {"key": "notifications.smtp_host", "value": "", "description": "SMTP server host", "is_public": False},
            {"key": "notifications.smtp_port", "value": "587", "data_type": "integer", "description": "SMTP server port", "is_public": False},
            {"key": "notifications.smtp_user", "value": "", "description": "SMTP username", "is_public": False},
            {"key": "notifications.smtp_password", "value": "", "description": "SMTP password (encrypted)", "is_public": False},
            {"key": "notifications.from_email", "value": "", "description": "From email address", "is_public": False},
            
            # Backup
            {"key": "backup.auto_enabled", "value": "true", "data_type": "boolean", "description": "Enable automatic backups", "is_public": False},
            {"key": "backup.retention_days", "value": "30", "data_type": "integer", "description": "Backup retention period", "is_public": False},
        ]
        
        created = 0
        for setting_data in default_settings:
            existing = db.query(models.SystemSetting).filter(
                models.SystemSetting.key == setting_data["key"]
            ).first()
            if not existing:
                setting = models.SystemSetting(**setting_data)
                db.add(setting)
                created += 1
        
        db.commit()
        return {"message": f"Company initialized with {created} settings"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error initializing company settings: {e}")
        raise HTTPException(status_code=500, detail="Error initializing settings")


# =====================================================
# COMPANY INFO ENDPOINTS (PUBLIC)
# =====================================================

@router.get("/company/info")
def get_company_info(db: Session = Depends(get_db)):
    """Get public company information (no auth required)"""
    try:
        settings = db.query(models.SystemSetting).filter(
            models.SystemSetting.key.like("company.%"),
            models.SystemSetting.is_public == True
        ).all()
        
        result = {}
        for s in settings:
            key = s.key.replace("company.", "")
            result[key] = s.value
        
        return result
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")
