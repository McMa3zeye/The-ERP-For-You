from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from datetime import datetime
from database import get_db
import models
import schemas
import logging
import secrets
import hashlib
from security import hash_password
import json

logger = logging.getLogger(__name__)

# #region agent log
def _debug_log(location: str, message: str, data: dict, hypothesis_id: str = ""):
    """Write debug log entry to NDJSON file"""
    import time
    import os
    log_path = r"c:\Users\Afrit\Desktop\Omar\Project Money\Project Wood\.cursor\debug.log"
    entry = {"location": location, "message": message, "data": data, "timestamp": int(time.time() * 1000), "sessionId": "debug-session", "hypothesisId": hypothesis_id}
    try:
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as e:
        print(f"[DEBUG LOG ERROR] {e}")
# #endregion
router = APIRouter()


def _ensure_admin_role_with_all_permissions(db: Session) -> models.Role:
    """Ensure Administrator role exists and has all permissions."""
    admin_role = db.query(models.Role).filter(models.Role.name == "Administrator").first()
    if not admin_role:
        admin_role = models.Role(
            name="Administrator",
            description="Full system access - all permissions",
            is_system=True,
            is_active=True,
        )
        db.add(admin_role)
        db.flush()
    # attach all permissions
    admin_role.permissions = db.query(models.Permission).all()
    return admin_role


@router.post("/bootstrap-owner", response_model=schemas.AdminBootstrapResponse)
def bootstrap_owner_admin(reset_password: bool = False, db: Session = Depends(get_db)):
    """
    Bootstrap an owner admin account with full access.
    Intended for initial setup / recovery. If already exists, returns info message.
    """
    # Chosen defaults (can be changed later from Admin & Security)
    username = "owner"
    email = "owner@localhost"
    password = "WoodERP!2026-Owner"  # change immediately after first login

    try:
        # #region agent log
        _debug_log(
            "admin.py:bootstrap_owner:entry",
            "Bootstrap owner called",
            {"reset_password": bool(reset_password)},
            "A,B,C",
        )
        # #endregion

        # If this owner user already exists, reset only if explicitly requested.
        existing = db.query(models.User).filter(models.User.username == username).first()
        if existing:
            if reset_password:
                existing.password_hash = hash_password(password)
                existing.is_active = True
                existing.is_superuser = True
                existing.must_change_password = True
                existing.password_changed_at = datetime.utcnow()
                admin_role = _ensure_admin_role_with_all_permissions(db)
                existing.roles = [admin_role]
                db.commit()
                # #region agent log
                _debug_log(
                    "admin.py:bootstrap_owner:reset",
                    "Owner password reset",
                    {"user_id": existing.id},
                    "B",
                )
                # #endregion
                return {
                    "message": "Owner admin password was reset",
                    "username": username,
                    "password": password,
                    "note": "Please change the password immediately after logging in.",
                }
            else:
                return {
                    "message": "Owner admin already exists",
                    "username": username,
                    "password": password,
                    "note": "Password was NOT reset. Call /api/admin/bootstrap-owner?reset_password=true to reset it.",
                }

        # Ensure permissions exist (bootstrap-friendly)
        if db.query(models.Permission).count() == 0:
            # Reuse existing initializer in this router
            initialize_permissions(db)

        admin_role = _ensure_admin_role_with_all_permissions(db)

        owner_user = models.User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            first_name="Owner",
            last_name="Admin",
            is_active=True,
            is_superuser=True,
            must_change_password=True,
            password_changed_at=datetime.utcnow(),
        )
        owner_user.roles = [admin_role]
        db.add(owner_user)
        db.commit()

        return {
            "message": "Owner admin created successfully",
            "username": username,
            "password": password,
            "note": "Please change the password immediately after logging in.",
        }

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error bootstrapping owner admin: {e}")
        raise HTTPException(status_code=500, detail="Error creating owner admin user")


# =====================================================
# USERS ENDPOINTS
# =====================================================

@router.get("/users", response_model=schemas.UserList)
@router.get("/users/", response_model=schemas.UserList)
def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = None,
    role_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        # #region agent log
        _debug_log("admin.py:get_users:entry", "Function entry", {"skip": skip, "limit": limit, "is_active": is_active, "role_id": role_id, "search": search}, "A,B,E")
        # #endregion
        query = db.query(models.User).options(
            joinedload(models.User.roles).joinedload(models.Role.permissions)
        )
        
        if is_active is not None:
            query = query.filter(models.User.is_active == is_active)
        if role_id:
            query = query.filter(models.User.roles.any(models.Role.id == role_id))
        if search:
            query = query.filter(
                (models.User.username.ilike(f"%{search}%")) |
                (models.User.email.ilike(f"%{search}%")) |
                (models.User.first_name.ilike(f"%{search}%")) |
                (models.User.last_name.ilike(f"%{search}%"))
            )
        
        total = query.count()
        users = query.order_by(models.User.username).offset(skip).limit(limit).all()
        # #region agent log
        user_ids = [u.id for u in users]
        unique_user_ids = list(set(user_ids))
        _debug_log("admin.py:get_users:result", "Query results", {"total_from_count": total, "users_returned": len(users), "user_ids": user_ids, "unique_ids": unique_user_ids, "has_duplicates": len(user_ids) != len(unique_user_ids)}, "A,B,E")
        # #endregion
        return {"items": users, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/users/{user_id}", response_model=schemas.User)
def get_user(user_id: int, db: Session = Depends(get_db)):
    # #region agent log
    _debug_log("admin.py:get_user:entry", "Getting single user", {"user_id": user_id}, "B")
    # #endregion
    user = db.query(models.User).options(
        joinedload(models.User.roles).joinedload(models.Role.permissions)
    ).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # #region agent log
    _debug_log("admin.py:get_user:result", "User found", {"user_id": user.id, "roles_count": len(user.roles) if user.roles else 0}, "B")
    # #endregion
    return user


@router.post("/users", response_model=schemas.User, status_code=201)
@router.post("/users/", response_model=schemas.User, status_code=201)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        # Check if username or email exists
        existing = db.query(models.User).filter(
            (models.User.username == user.username) |
            (models.User.email == user.email)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username or email already exists")
        
        # Validate password
        if len(user.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        
        db_user = models.User(
            username=user.username,
            email=user.email,
            password_hash=hash_password(user.password),
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            is_active=user.is_active,
            is_superuser=user.is_superuser
        )
        db.add(db_user)
        db.flush()
        
        # Assign roles
        if user.role_ids:
            roles = db.query(models.Role).filter(models.Role.id.in_(user.role_ids)).all()
            db_user.roles = roles
        
        db.commit()
        db.refresh(db_user)
        return db_user
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Error creating user")


@router.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user: schemas.UserUpdate, db: Session = Depends(get_db)):
    try:
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        update_data = user.model_dump(exclude_unset=True)
        
        # Handle role updates separately
        role_ids = update_data.pop('role_ids', None)
        if role_ids is not None:
            roles = db.query(models.Role).filter(models.Role.id.in_(role_ids)).all()
            db_user.roles = roles
        
        for key, value in update_data.items():
            setattr(db_user, key, value)
        
        db.commit()
        db.refresh(db_user)
        return db_user
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail="Error updating user")


@router.post("/users/{user_id}/reset-password")
def reset_user_password(user_id: int, password_data: schemas.UserPasswordReset, db: Session = Depends(get_db)):
    try:
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if len(password_data.new_password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        
        db_user.password_hash = hash_password(password_data.new_password)
        db_user.must_change_password = True
        db_user.password_changed_at = datetime.utcnow()
        
        db.commit()
        return {"message": "Password reset successfully"}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error resetting password: {e}")
        raise HTTPException(status_code=500, detail="Error resetting password")


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    try:
        db_user = db.query(models.User).filter(models.User.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        if db_user.is_superuser:
            raise HTTPException(status_code=400, detail="Cannot delete superuser")
        
        db.delete(db_user)
        db.commit()
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail="Error deleting user")


# =====================================================
# ROLES ENDPOINTS
# =====================================================

@router.get("/roles", response_model=schemas.RoleList)
@router.get("/roles/", response_model=schemas.RoleList)
def get_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        # #region agent log
        _debug_log("admin.py:get_roles:entry", "Function entry", {"skip": skip, "limit": limit, "is_active": is_active, "search": search}, "A,B")
        # #endregion
        query = db.query(models.Role).options(joinedload(models.Role.permissions))
        
        if is_active is not None:
            query = query.filter(models.Role.is_active == is_active)
        if search:
            query = query.filter(models.Role.name.ilike(f"%{search}%"))
        
        total = query.count()
        roles = query.order_by(models.Role.name).offset(skip).limit(limit).all()
        # #region agent log
        role_ids = [r.id for r in roles]
        unique_role_ids = list(set(role_ids))
        _debug_log("admin.py:get_roles:result", "Query results", {"total_from_count": total, "roles_returned": len(roles), "role_ids": role_ids, "unique_ids": unique_role_ids, "has_duplicates": len(role_ids) != len(unique_role_ids)}, "A,B")
        # #endregion
        return {"items": roles, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/roles/{role_id}", response_model=schemas.Role)
def get_role(role_id: int, db: Session = Depends(get_db)):
    role = db.query(models.Role).options(
        joinedload(models.Role.permissions)
    ).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.post("/roles", response_model=schemas.Role, status_code=201)
@router.post("/roles/", response_model=schemas.Role, status_code=201)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(models.Role).filter(models.Role.name == role.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Role name already exists")
        
        db_role = models.Role(
            name=role.name,
            description=role.description,
            is_active=role.is_active
        )
        db.add(db_role)
        db.flush()
        
        if role.permission_ids:
            permissions = db.query(models.Permission).filter(
                models.Permission.id.in_(role.permission_ids)
            ).all()
            db_role.permissions = permissions
        
        db.commit()
        db.refresh(db_role)
        return db_role
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating role: {e}")
        raise HTTPException(status_code=500, detail="Error creating role")


@router.put("/roles/{role_id}", response_model=schemas.Role)
def update_role(role_id: int, role: schemas.RoleUpdate, db: Session = Depends(get_db)):
    try:
        db_role = db.query(models.Role).filter(models.Role.id == role_id).first()
        if not db_role:
            raise HTTPException(status_code=404, detail="Role not found")
        if db_role.is_system:
            raise HTTPException(status_code=400, detail="Cannot modify system role")
        
        update_data = role.model_dump(exclude_unset=True)
        
        permission_ids = update_data.pop('permission_ids', None)
        if permission_ids is not None:
            permissions = db.query(models.Permission).filter(
                models.Permission.id.in_(permission_ids)
            ).all()
            db_role.permissions = permissions
        
        for key, value in update_data.items():
            setattr(db_role, key, value)
        
        db.commit()
        db.refresh(db_role)
        return db_role
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating role: {e}")
        raise HTTPException(status_code=500, detail="Error updating role")


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(role_id: int, db: Session = Depends(get_db)):
    try:
        db_role = db.query(models.Role).filter(models.Role.id == role_id).first()
        if not db_role:
            raise HTTPException(status_code=404, detail="Role not found")
        if db_role.is_system:
            raise HTTPException(status_code=400, detail="Cannot delete system role")
        
        db.delete(db_role)
        db.commit()
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting role: {e}")
        raise HTTPException(status_code=500, detail="Error deleting role")


# =====================================================
# PERMISSIONS ENDPOINTS
# =====================================================

@router.get("/permissions", response_model=schemas.PermissionList)
@router.get("/permissions/", response_model=schemas.PermissionList)
def get_permissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    module: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Permission)
        
        if module:
            query = query.filter(models.Permission.module == module)
        if search:
            query = query.filter(
                (models.Permission.name.ilike(f"%{search}%")) |
                (models.Permission.code.ilike(f"%{search}%"))
            )
        
        total = query.count()
        permissions = query.order_by(models.Permission.module, models.Permission.name).offset(skip).limit(limit).all()
        return {"items": permissions, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/permissions", response_model=schemas.Permission, status_code=201)
@router.post("/permissions/", response_model=schemas.Permission, status_code=201)
def create_permission(permission: schemas.PermissionCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(models.Permission).filter(
            models.Permission.code == permission.code
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Permission code already exists")
        
        db_permission = models.Permission(**permission.model_dump())
        db.add(db_permission)
        db.commit()
        db.refresh(db_permission)
        return db_permission
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating permission: {e}")
        raise HTTPException(status_code=500, detail="Error creating permission")


@router.delete("/permissions/{permission_id}", status_code=204)
def delete_permission(permission_id: int, db: Session = Depends(get_db)):
    try:
        db_permission = db.query(models.Permission).filter(
            models.Permission.id == permission_id
        ).first()
        if not db_permission:
            raise HTTPException(status_code=404, detail="Permission not found")
        
        db.delete(db_permission)
        db.commit()
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting permission: {e}")
        raise HTTPException(status_code=500, detail="Error deleting permission")


# =====================================================
# AUDIT LOG ENDPOINTS
# =====================================================

@router.get("/audit-logs", response_model=schemas.AuditLogList)
@router.get("/audit-logs/", response_model=schemas.AuditLogList)
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    module: Optional[str] = None,
    entity_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        # #region agent log
        _debug_log("admin.py:get_audit_logs:entry", "Function entry with date filters", {"start_date": start_date, "end_date": end_date, "start_date_type": type(start_date).__name__, "end_date_type": type(end_date).__name__}, "C")
        # #endregion
        query = db.query(models.AuditLog)
        
        if user_id:
            query = query.filter(models.AuditLog.user_id == user_id)
        if action:
            query = query.filter(models.AuditLog.action == action)
        if module:
            query = query.filter(models.AuditLog.module == module)
        if entity_type:
            query = query.filter(models.AuditLog.entity_type == entity_type)
        if status:
            query = query.filter(models.AuditLog.status == status)
        if start_date:
            # #region agent log
            _debug_log("admin.py:get_audit_logs:date_filter", "Applying start_date filter (string vs datetime)", {"start_date_raw": start_date}, "C")
            # #endregion
            query = query.filter(models.AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(models.AuditLog.created_at <= end_date)
        
        total = query.count()
        logs = query.order_by(models.AuditLog.created_at.desc()).offset(skip).limit(limit).all()
        # #region agent log
        _debug_log("admin.py:get_audit_logs:result", "Query completed", {"total": total, "logs_returned": len(logs)}, "C")
        # #endregion
        return {"items": logs, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/audit-logs/{log_id}", response_model=schemas.AuditLog)
def get_audit_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(models.AuditLog).filter(models.AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return log


# =====================================================
# SYSTEM SETTINGS ENDPOINTS
# =====================================================

@router.get("/settings", response_model=schemas.SystemSettingList)
@router.get("/settings/", response_model=schemas.SystemSettingList)
def get_settings(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.SystemSetting)
        if category:
            query = query.filter(models.SystemSetting.category == category)
        
        settings = query.order_by(models.SystemSetting.category, models.SystemSetting.key).all()
        return {"items": settings, "total": len(settings)}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/settings/{key}", response_model=schemas.SystemSetting)
def get_setting(key: str, db: Session = Depends(get_db)):
    setting = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == key
    ).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting


@router.post("/settings", response_model=schemas.SystemSetting, status_code=201)
@router.post("/settings/", response_model=schemas.SystemSetting, status_code=201)
def create_setting(setting: schemas.SystemSettingCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == setting.key
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Setting key already exists")
        
        db_setting = models.SystemSetting(**setting.model_dump())
        db.add(db_setting)
        db.commit()
        db.refresh(db_setting)
        return db_setting
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating setting: {e}")
        raise HTTPException(status_code=500, detail="Error creating setting")


@router.put("/settings/{key}", response_model=schemas.SystemSetting)
def update_setting(key: str, setting: schemas.SystemSettingUpdate, db: Session = Depends(get_db)):
    try:
        db_setting = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == key
        ).first()
        if not db_setting:
            raise HTTPException(status_code=404, detail="Setting not found")
        
        for k, v in setting.model_dump(exclude_unset=True).items():
            setattr(db_setting, k, v)
        
        db.commit()
        db.refresh(db_setting)
        return db_setting
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating setting: {e}")
        raise HTTPException(status_code=500, detail="Error updating setting")


@router.delete("/settings/{key}", status_code=204)
def delete_setting(key: str, db: Session = Depends(get_db)):
    try:
        db_setting = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == key
        ).first()
        if not db_setting:
            raise HTTPException(status_code=404, detail="Setting not found")
        
        db.delete(db_setting)
        db.commit()
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting setting: {e}")
        raise HTTPException(status_code=500, detail="Error deleting setting")


# =====================================================
# UTILITY ENDPOINTS
# =====================================================

@router.post("/init-permissions")
def initialize_permissions(db: Session = Depends(get_db)):
    """Initialize default permissions for all modules"""
    try:
        # All modules in the system
        modules = [
            "products", "inventory", "sales_orders", "customers", "quotes",
            "invoicing", "payments", "suppliers", "purchasing", "work_orders",
            "expenses", "projects", "support_tickets", "leads", "warehousing",
            "manufacturing", "quality", "shipping", "returns", "time_attendance",
            "hr", "assets", "reporting", "admin", "accounting", "production",
            "documents", "payroll", "pos", "tooling", "portal", "settings",
            "notifications", "backup", "import"
        ]
        
        # Standard CRUD actions
        standard_actions = ["view", "create", "update", "delete", "export"]
        
        # Module-specific actions (beyond standard CRUD)
        special_permissions = [
            # Finance
            ("accounting", "post_entries", "Post journal entries"),
            ("accounting", "close_period", "Close fiscal periods"),
            ("invoicing", "send", "Send invoices to customers"),
            ("payments", "process", "Process payments"),
            ("payroll", "process", "Process payroll"),
            ("payroll", "approve", "Approve payslips"),
            # Operations
            ("inventory", "adjust", "Adjust inventory quantities"),
            ("work_orders", "start", "Start work orders"),
            ("work_orders", "complete", "Complete work orders"),
            ("production", "schedule", "Manage production schedules"),
            ("quality", "inspect", "Perform quality inspections"),
            ("shipping", "dispatch", "Dispatch shipments"),
            # POS
            ("pos", "open_session", "Open POS sessions"),
            ("pos", "close_session", "Close POS sessions"),
            ("pos", "void_transaction", "Void transactions"),
            # Admin - use distinct action names to avoid conflict with CRUD
            ("admin", "manage_users", "Manage user accounts"),
            ("admin", "manage_roles", "Manage roles and permissions"),
            ("admin", "view_audit", "View audit logs"),
            ("backup", "restore_db", "Restore database from backups"),
            ("settings", "manage", "Manage system settings"),
            ("import", "execute", "Execute data imports"),
        ]
        
        created = 0
        
        # Create standard CRUD permissions for all modules
        for module in modules:
            for action in standard_actions:
                code = f"{module}.{action}"
                existing = db.query(models.Permission).filter(
                    models.Permission.code == code
                ).first()
                if not existing:
                    permission = models.Permission(
                        name=f"{action.capitalize()} {module.replace('_', ' ').title()}",
                        code=code,
                        module=module,
                        description=f"Permission to {action} {module.replace('_', ' ')}"
                    )
                    db.add(permission)
                    created += 1
        
        # Create special permissions
        for module, action, description in special_permissions:
            code = f"{module}.{action}"
            existing = db.query(models.Permission).filter(
                models.Permission.code == code
            ).first()
            if not existing:
                permission = models.Permission(
                    name=f"{action.replace('_', ' ').title()} - {module.replace('_', ' ').title()}",
                    code=code,
                    module=module,
                    description=description
                )
                db.add(permission)
                created += 1
        
        db.commit()
        
        return {
            "message": f"Initialized {created} permissions",
            "permissions_created": created
        }
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error initializing permissions: {e}")
        raise HTTPException(status_code=500, detail=f"Error initializing permissions: {str(e)}")


@router.post("/init-roles")
def initialize_roles(db: Session = Depends(get_db)):
    """Initialize default roles with permissions"""
    try:
        # Create default roles if they don't exist
        default_roles = [
            {
                "name": "Administrator",
                "description": "Full system access - all permissions",
                "is_system": True,
                "all_permissions": True
            },
            {
                "name": "Manager",
                "description": "View all, manage most operations",
                "is_system": True,
                "modules": ["products", "inventory", "sales_orders", "customers", "quotes", 
                           "invoicing", "payments", "suppliers", "purchasing", "work_orders",
                           "projects", "reporting"]
            },
            {
                "name": "Sales",
                "description": "Sales and customer management",
                "is_system": True,
                "modules": ["customers", "quotes", "sales_orders", "invoicing", "leads"]
            },
            {
                "name": "Warehouse",
                "description": "Inventory and warehouse operations",
                "is_system": True,
                "modules": ["inventory", "warehousing", "shipping", "returns"]
            },
            {
                "name": "Production",
                "description": "Manufacturing and work orders",
                "is_system": True,
                "modules": ["work_orders", "manufacturing", "production", "quality", "tooling"]
            },
            {
                "name": "Accounting",
                "description": "Financial operations",
                "is_system": True,
                "modules": ["accounting", "invoicing", "payments", "expenses", "payroll"]
            },
            {
                "name": "HR",
                "description": "Human resources management",
                "is_system": True,
                "modules": ["hr", "time_attendance", "payroll"]
            },
            {
                "name": "Viewer",
                "description": "Read-only access to most modules",
                "is_system": True,
                "view_only": True
            }
        ]
        
        roles_created = 0
        for role_data in default_roles:
            existing_role = db.query(models.Role).filter(
                models.Role.name == role_data["name"]
            ).first()
            
            if not existing_role:
                role = models.Role(
                    name=role_data["name"],
                    description=role_data["description"],
                    is_system=role_data.get("is_system", False)
                )
                db.add(role)
                db.flush()
                
                # Assign permissions
                if role_data.get("all_permissions"):
                    role.permissions = db.query(models.Permission).all()
                elif role_data.get("view_only"):
                    role.permissions = db.query(models.Permission).filter(
                        models.Permission.code.like("%.view")
                    ).all()
                elif role_data.get("modules"):
                    role.permissions = db.query(models.Permission).filter(
                        models.Permission.module.in_(role_data["modules"])
                    ).all()
                
                roles_created += 1
        
        db.commit()
        
        return {
            "message": f"Initialized {roles_created} roles",
            "roles_created": roles_created
        }
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error initializing roles: {e}")
        raise HTTPException(status_code=500, detail=f"Error initializing roles: {str(e)}")


@router.post("/init-admin")
def initialize_admin_user(db: Session = Depends(get_db)):
    """Create default admin user if not exists"""
    try:
        existing = db.query(models.User).filter(models.User.username == "admin").first()
        if existing:
            return {"message": "Admin user already exists", "username": "admin"}
        
        # Create admin role if not exists
        admin_role = db.query(models.Role).filter(models.Role.name == "Administrator").first()
        if not admin_role:
            admin_role = models.Role(
                name="Administrator",
                description="Full system access",
                is_system=True
            )
            db.add(admin_role)
            db.flush()
            
            # Assign all permissions to admin role
            all_permissions = db.query(models.Permission).all()
            admin_role.permissions = all_permissions
        
        # Create admin user
        admin_user = models.User(
            username="admin",
            email="admin@localhost",
            password_hash=hash_password("admin123"),  # Default password
            first_name="System",
            last_name="Administrator",
            is_active=True,
            is_superuser=True,
            must_change_password=True
        )
        admin_user.roles = [admin_role]
        db.add(admin_user)
        db.commit()
        
        return {
            "message": "Admin user created successfully",
            "username": "admin",
            "default_password": "admin123",
            "note": "Please change the password immediately!"
        }
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating admin user: {e}")
        raise HTTPException(status_code=500, detail="Error creating admin user")
