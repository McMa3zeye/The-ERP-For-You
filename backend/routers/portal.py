from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
import models
import schemas
import logging
import hashlib
import secrets

logger = logging.getLogger(__name__)
router = APIRouter()



def generate_session_token() -> str:
    return secrets.token_urlsafe(64)


# =====================================================
# PORTAL USER MANAGEMENT (Admin endpoints)
# =====================================================

@router.get("/users", response_model=schemas.PortalUserList)
@router.get("/users/", response_model=schemas.PortalUserList)
def get_portal_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.PortalUser)
        
        if user_type:
            query = query.filter(models.PortalUser.user_type == user_type)
        if is_active is not None:
            query = query.filter(models.PortalUser.is_active == is_active)
        if search:
            query = query.filter(
                (models.PortalUser.email.ilike(f"%{search}%")) |
                (models.PortalUser.first_name.ilike(f"%{search}%")) |
                (models.PortalUser.last_name.ilike(f"%{search}%"))
            )
        
        total = query.count()
        users = query.order_by(models.PortalUser.email).offset(skip).limit(limit).all()
        return {"items": users, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/users/{user_id}", response_model=schemas.PortalUser)
def get_portal_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.PortalUser).filter(models.PortalUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Portal user not found")
    return user


@router.post("/users", response_model=schemas.PortalUser, status_code=201)
@router.post("/users/", response_model=schemas.PortalUser, status_code=201)
def create_portal_user(user: schemas.PortalUserCreate, db: Session = Depends(get_db)):
    try:
        # Check if email exists
        existing = db.query(models.PortalUser).filter(
            models.PortalUser.email == user.email
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Validate linked entity
        if user.user_type == "customer" and user.linked_customer_id:
            customer = db.query(models.Customer).filter(
                models.Customer.id == user.linked_customer_id
            ).first()
            if not customer:
                raise HTTPException(status_code=400, detail="Customer not found")
        elif user.user_type == "supplier" and user.linked_supplier_id:
            supplier = db.query(models.Supplier).filter(
                models.Supplier.id == user.linked_supplier_id
            ).first()
            if not supplier:
                raise HTTPException(status_code=400, detail="Supplier not found")
        
        db_user = models.PortalUser(
            email=user.email,
            password_hash=hash_password(user.password),
            user_type=user.user_type,
            linked_customer_id=user.linked_customer_id,
            linked_supplier_id=user.linked_supplier_id,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            verification_token=secrets.token_urlsafe(32)
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating portal user: {e}")
        raise HTTPException(status_code=500, detail="Error creating portal user")


@router.put("/users/{user_id}", response_model=schemas.PortalUser)
def update_portal_user(user_id: int, user: schemas.PortalUserUpdate, db: Session = Depends(get_db)):
    try:
        db_user = db.query(models.PortalUser).filter(models.PortalUser.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="Portal user not found")
        
        for key, value in user.model_dump(exclude_unset=True).items():
            setattr(db_user, key, value)
        
        db.commit()
        db.refresh(db_user)
        return db_user
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating portal user: {e}")
        raise HTTPException(status_code=500, detail="Error updating portal user")


@router.delete("/users/{user_id}", status_code=204)
def delete_portal_user(user_id: int, db: Session = Depends(get_db)):
    try:
        db_user = db.query(models.PortalUser).filter(models.PortalUser.id == user_id).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="Portal user not found")
        
        db.delete(db_user)
        db.commit()
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting portal user: {e}")
        raise HTTPException(status_code=500, detail="Error deleting portal user")


# =====================================================
# PORTAL AUTHENTICATION
# =====================================================

@router.post("/login", response_model=schemas.PortalLoginResponse)
def portal_login(login_data: schemas.PortalLoginRequest, request: Request, db: Session = Depends(get_db)):
    try:
        user = db.query(models.PortalUser).filter(
            models.PortalUser.email == login_data.email
        ).first()
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is disabled")
        
        if not verify_password(login_data.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Create session
        expires_at = datetime.utcnow() + timedelta(days=7)
        session_token = generate_session_token()
        
        session = models.PortalSession(
            portal_user_id=user.id,
            session_token=session_token,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent", "")[:500],
            expires_at=expires_at
        )
        db.add(session)
        
        user.last_login = datetime.utcnow()
        db.commit()
        
        return {
            "access_token": session_token,
            "token_type": "bearer",
            "expires_at": expires_at,
            "user": user
        }
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error during portal login: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/logout")
def portal_logout(request: Request, db: Session = Depends(get_db)):
    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            raise HTTPException(status_code=401, detail="No token provided")
        
        session = db.query(models.PortalSession).filter(
            models.PortalSession.session_token == token,
            models.PortalSession.is_active == True
        ).first()
        
        if session:
            session.is_active = False
            db.commit()
        
        return {"message": "Logged out successfully"}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error during portal logout: {e}")
        raise HTTPException(status_code=500, detail="Database error")


# =====================================================
# PORTAL DATA ACCESS (Customer/Supplier views)
# =====================================================

@router.get("/my-orders")
def get_my_orders(request: Request, db: Session = Depends(get_db)):
    """Get orders for the logged-in customer"""
    try:
        user = get_current_portal_user(request, db)
        if user.user_type != "customer" or not user.linked_customer_id:
            raise HTTPException(status_code=403, detail="Not a customer account")
        
        customer = db.query(models.Customer).filter(
            models.Customer.id == user.linked_customer_id
        ).first()
        
        orders = db.query(models.SalesOrder).filter(
            models.SalesOrder.customer_id == user.linked_customer_id
        ).order_by(models.SalesOrder.order_date.desc()).limit(50).all()
        
        return {"orders": orders, "customer": customer.company_name if customer else None}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/my-invoices")
def get_my_invoices(request: Request, db: Session = Depends(get_db)):
    """Get invoices for the logged-in customer"""
    try:
        user = get_current_portal_user(request, db)
        if user.user_type != "customer" or not user.linked_customer_id:
            raise HTTPException(status_code=403, detail="Not a customer account")
        
        invoices = db.query(models.Invoice).filter(
            models.Invoice.customer_id == user.linked_customer_id
        ).order_by(models.Invoice.invoice_date.desc()).limit(50).all()
        
        return {"invoices": invoices}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/my-purchase-orders")
def get_my_purchase_orders(request: Request, db: Session = Depends(get_db)):
    """Get purchase orders for the logged-in supplier"""
    try:
        user = get_current_portal_user(request, db)
        if user.user_type != "supplier" or not user.linked_supplier_id:
            raise HTTPException(status_code=403, detail="Not a supplier account")
        
        orders = db.query(models.PurchaseOrder).filter(
            models.PurchaseOrder.supplier_id == user.linked_supplier_id
        ).order_by(models.PurchaseOrder.order_date.desc()).limit(50).all()
        
        return {"purchase_orders": orders}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


def get_current_portal_user(request: Request, db: Session) -> models.PortalUser:
    """Helper to get current portal user from token"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = db.query(models.PortalSession).filter(
        models.PortalSession.session_token == token,
        models.PortalSession.is_active == True,
        models.PortalSession.expires_at > datetime.utcnow()
    ).first()
    
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    user = db.query(models.PortalUser).filter(
        models.PortalUser.id == session.portal_user_id
    ).first()
    
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    
    return user


# =====================================================
# MESSAGES
# =====================================================

@router.get("/messages", response_model=schemas.PortalMessageList)
@router.get("/messages/", response_model=schemas.PortalMessageList)
def get_messages(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    portal_user_id: Optional[int] = None,
    direction: Optional[str] = None,
    is_read: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.PortalMessage)
        
        if portal_user_id:
            query = query.filter(models.PortalMessage.portal_user_id == portal_user_id)
        if direction:
            query = query.filter(models.PortalMessage.direction == direction)
        if is_read is not None:
            query = query.filter(models.PortalMessage.is_read == is_read)
        
        total = query.count()
        messages = query.order_by(models.PortalMessage.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": messages, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/messages", response_model=schemas.PortalMessage, status_code=201)
@router.post("/messages/", response_model=schemas.PortalMessage, status_code=201)
def send_message(message: schemas.PortalMessageCreate, db: Session = Depends(get_db)):
    """Send a message to a portal user (outbound) or receive (inbound)"""
    try:
        # Verify portal user exists
        user = db.query(models.PortalUser).filter(
            models.PortalUser.id == message.portal_user_id
        ).first()
        if not user:
            raise HTTPException(status_code=404, detail="Portal user not found")
        
        db_message = models.PortalMessage(**message.model_dump())
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        return db_message
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail="Error sending message")


@router.post("/messages/{message_id}/read")
def mark_message_read(message_id: int, db: Session = Depends(get_db)):
    """Mark a message as read"""
    try:
        message = db.query(models.PortalMessage).filter(
            models.PortalMessage.id == message_id
        ).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        message.is_read = True
        message.read_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Marked as read"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error marking message read: {e}")
        raise HTTPException(status_code=500, detail="Database error")


# =====================================================
# NOTIFICATIONS
# =====================================================

@router.get("/notifications", response_model=schemas.PortalNotificationList)
@router.get("/notifications/", response_model=schemas.PortalNotificationList)
def get_notifications(
    portal_user_id: int,
    is_read: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.PortalNotification).filter(
            models.PortalNotification.portal_user_id == portal_user_id
        )
        
        if is_read is not None:
            query = query.filter(models.PortalNotification.is_read == is_read)
        
        notifications = query.order_by(models.PortalNotification.created_at.desc()).limit(50).all()
        return {"items": notifications, "total": len(notifications)}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/notifications", response_model=schemas.PortalNotification, status_code=201)
@router.post("/notifications/", response_model=schemas.PortalNotification, status_code=201)
def create_notification(notification: schemas.PortalNotificationCreate, db: Session = Depends(get_db)):
    """Create a notification for a portal user"""
    try:
        db_notification = models.PortalNotification(**notification.model_dump())
        db.add(db_notification)
        db.commit()
        db.refresh(db_notification)
        return db_notification
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating notification: {e}")
        raise HTTPException(status_code=500, detail="Error creating notification")


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    """Mark a notification as read"""
    try:
        notification = db.query(models.PortalNotification).filter(
            models.PortalNotification.id == notification_id
        ).first()
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Marked as read"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error marking notification read: {e}")
        raise HTTPException(status_code=500, detail="Database error")


# =====================================================
# UTILITY ENDPOINTS
# =====================================================

@router.get("/stats/{portal_user_id}")
def get_portal_user_stats(portal_user_id: int, db: Session = Depends(get_db)):
    """Get statistics for a portal user"""
    try:
        user = db.query(models.PortalUser).filter(
            models.PortalUser.id == portal_user_id
        ).first()
        if not user:
            raise HTTPException(status_code=404, detail="Portal user not found")
        
        stats = {
            "user_type": user.user_type,
            "unread_messages": 0,
            "unread_notifications": 0
        }
        
        stats["unread_messages"] = db.query(models.PortalMessage).filter(
            models.PortalMessage.portal_user_id == portal_user_id,
            models.PortalMessage.direction == "outbound",
            models.PortalMessage.is_read == False
        ).count()
        
        stats["unread_notifications"] = db.query(models.PortalNotification).filter(
            models.PortalNotification.portal_user_id == portal_user_id,
            models.PortalNotification.is_read == False
        ).count()
        
        if user.user_type == "customer" and user.linked_customer_id:
            stats["total_orders"] = db.query(models.SalesOrder).filter(
                models.SalesOrder.customer_id == user.linked_customer_id
            ).count()
            stats["pending_invoices"] = db.query(models.Invoice).filter(
                models.Invoice.customer_id == user.linked_customer_id,
                models.Invoice.status != "paid"
            ).count()
        elif user.user_type == "supplier" and user.linked_supplier_id:
            stats["total_purchase_orders"] = db.query(models.PurchaseOrder).filter(
                models.PurchaseOrder.supplier_id == user.linked_supplier_id
            ).count()
        
        return stats
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")
