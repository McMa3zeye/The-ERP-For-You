"""
Authentication, Authorization, and Audit Dependencies
Used across all routers to enforce security
"""
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List
import json
import logging

from database import get_db
import models

logger = logging.getLogger(__name__)


# =====================================================
# AUTHENTICATION DEPENDENCIES
# =====================================================

def get_token_from_request(request: Request) -> Optional[str]:
    """Extract token from Authorization header or cookie"""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    # Also check cookies for frontend sessions
    return request.cookies.get("session_token")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> models.User:
    """
    Get current authenticated user from session token.
    Raises 401 if not authenticated.
    """
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Find valid session
    session = db.query(models.Session).filter(
        models.Session.token == token,
        models.Session.is_active == True,
        models.Session.expires_at > datetime.utcnow()
    ).first()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Get user
    user = db.query(models.User).filter(
        models.User.id == session.user_id,
        models.User.is_active == True
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled"
        )
    
    # Check if user is locked out
    if user.lockout_until and user.lockout_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is temporarily locked"
        )
    
    # Update session last activity
    session.last_activity = datetime.utcnow()
    db.commit()
    
    return user


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """
    Get current user if authenticated, None otherwise.
    Does not raise exceptions for unauthenticated requests.
    """
    try:
        return get_current_user(request, db)
    except HTTPException:
        return None


def get_current_active_user(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    """Ensure user is active"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


def require_superuser(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    """Require superuser/admin privileges"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superuser privileges required"
        )
    return current_user


# =====================================================
# PERMISSION CHECKING
# =====================================================

def get_user_permissions(user: models.User, db: Session) -> set:
    """Get all permission codes for a user"""
    if user.is_superuser:
        # Superusers have all permissions
        all_perms = db.query(models.Permission.code).all()
        return {p[0] for p in all_perms}
    
    permissions = set()
    for role in user.roles:
        if role.is_active:
            for perm in role.permissions:
                permissions.add(perm.code)
    return permissions


def check_permission(user: models.User, permission_code: str, db: Session) -> bool:
    """Check if user has a specific permission"""
    if user.is_superuser:
        return True
    
    user_perms = get_user_permissions(user, db)
    return permission_code in user_perms


class PermissionChecker:
    """
    Dependency class to check for specific permissions.
    Usage: Depends(PermissionChecker("products.create"))
    """
    def __init__(self, permission: str):
        self.permission = permission
    
    def __call__(
        self,
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> models.User:
        if not check_permission(current_user, self.permission, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {self.permission}"
            )
        return current_user


class AnyPermissionChecker:
    """
    Dependency to check for any of multiple permissions.
    Usage: Depends(AnyPermissionChecker(["products.view", "products.admin"]))
    """
    def __init__(self, permissions: List[str]):
        self.permissions = permissions
    
    def __call__(
        self,
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> models.User:
        user_perms = get_user_permissions(current_user, db)
        if not any(p in user_perms for p in self.permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: requires one of {self.permissions}"
            )
        return current_user


# Shorthand permission dependencies for common modules
require_products_view = PermissionChecker("products.view")
require_products_create = PermissionChecker("products.create")
require_products_edit = PermissionChecker("products.edit")
require_products_delete = PermissionChecker("products.delete")

require_inventory_view = PermissionChecker("inventory.view")
require_inventory_manage = PermissionChecker("inventory.manage")

require_sales_view = PermissionChecker("sales.view")
require_sales_create = PermissionChecker("sales.create")
require_sales_edit = PermissionChecker("sales.edit")

require_purchasing_view = PermissionChecker("purchasing.view")
require_purchasing_create = PermissionChecker("purchasing.create")

require_finance_view = PermissionChecker("finance.view")
require_finance_manage = PermissionChecker("finance.manage")

require_hr_view = PermissionChecker("hr.view")
require_hr_manage = PermissionChecker("hr.manage")

require_admin = PermissionChecker("admin.access")


# =====================================================
# AUDIT LOGGING
# =====================================================

def create_audit_log(
    db: Session,
    user_id: Optional[int],
    action: str,
    module: str,
    record_id: Optional[int] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Create an audit log entry"""
    try:
        log = models.AuditLog(
            user_id=user_id,
            action=action,
            module=module,
            record_id=record_id,
            old_value=json.dumps(old_value) if old_value else None,
            new_value=json.dumps(new_value) if new_value else None,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to create audit log: {e}")
        # Don't fail the main operation if audit logging fails
        db.rollback()


class AuditLogger:
    """
    Helper class for audit logging within request context.
    Usage:
        audit = AuditLogger(request, db, current_user)
        audit.log("Created product", "products", record_id=new_product.id)
    """
    def __init__(self, request: Request, db: Session, user: Optional[models.User] = None):
        self.db = db
        self.user_id = user.id if user else None
        self.ip_address = request.client.host if request.client else None
        self.user_agent = request.headers.get("user-agent", "")[:500]
    
    def log(
        self,
        action: str,
        module: str,
        record_id: Optional[int] = None,
        old_value: Optional[dict] = None,
        new_value: Optional[dict] = None
    ):
        create_audit_log(
            self.db,
            self.user_id,
            action,
            module,
            record_id,
            old_value,
            new_value,
            self.ip_address,
            self.user_agent
        )


# =====================================================
# WORKFLOW / DATA INTEGRITY HELPERS
# =====================================================

class WorkflowError(HTTPException):
    """Custom exception for workflow violations"""
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def check_period_open(db: Session, period_type: str, date: datetime) -> bool:
    """
    Check if the fiscal/payroll period for a given date is still open.
    Returns True if period is open (or no period exists), False if closed.
    """
    if period_type == "fiscal":
        period = db.query(models.FiscalPeriod).filter(
            models.FiscalPeriod.start_date <= date,
            models.FiscalPeriod.end_date >= date
        ).first()
        if period and period.is_closed:
            return False
    elif period_type == "payroll":
        period = db.query(models.PayrollPeriod).filter(
            models.PayrollPeriod.start_date <= date,
            models.PayrollPeriod.end_date >= date
        ).first()
        if period and period.status == "closed":
            return False
    return True


def require_period_open(db: Session, period_type: str, date: datetime):
    """Raise error if period is closed"""
    if not check_period_open(db, period_type, date):
        raise WorkflowError(f"Cannot modify records in a closed {period_type} period")


# Status transition rules
INVOICE_STATUS_TRANSITIONS = {
    "draft": ["sent", "cancelled"],
    "sent": ["paid", "partial", "overdue", "cancelled"],
    "partial": ["paid", "overdue"],
    "overdue": ["paid", "partial", "cancelled"],
    "paid": [],  # Final state
    "cancelled": []  # Final state
}

SALES_ORDER_STATUS_TRANSITIONS = {
    "Pending": ["Confirmed", "Cancelled"],
    "Confirmed": ["In Production", "Shipped", "Cancelled"],
    "In Production": ["Ready", "Shipped"],
    "Ready": ["Shipped"],
    "Shipped": ["Delivered"],
    "Delivered": [],  # Final
    "Cancelled": []  # Final
}

WORK_ORDER_STATUS_TRANSITIONS = {
    "Pending": ["In Progress", "Cancelled"],
    "In Progress": ["Completed", "On Hold"],
    "On Hold": ["In Progress", "Cancelled"],
    "Completed": [],  # Final
    "Cancelled": []  # Final
}


def validate_status_transition(current: str, new: str, transitions: dict, entity_name: str):
    """Validate that a status transition is allowed"""
    allowed = transitions.get(current, [])
    if new not in allowed and new != current:
        raise WorkflowError(
            f"Invalid {entity_name} status transition: {current} -> {new}. "
            f"Allowed: {allowed}"
        )


# =====================================================
# RATE LIMITING (Simple in-memory)
# =====================================================

from collections import defaultdict
import time

_rate_limit_store = defaultdict(list)


def check_rate_limit(key: str, max_requests: int = 100, window_seconds: int = 60) -> bool:
    """
    Simple rate limiting. Returns True if request is allowed, False if rate limited.
    """
    now = time.time()
    window_start = now - window_seconds
    
    # Clean old entries
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if t > window_start]
    
    if len(_rate_limit_store[key]) >= max_requests:
        return False
    
    _rate_limit_store[key].append(now)
    return True


class RateLimiter:
    """
    Dependency for rate limiting.
    Usage: Depends(RateLimiter(max_requests=10, window_seconds=60))
    """
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
    
    def __call__(self, request: Request):
        # Rate limit by IP
        client_ip = request.client.host if request.client else "unknown"
        if not check_rate_limit(client_ip, self.max_requests, self.window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later."
            )
