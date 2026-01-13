"""
Notifications Router
Manages system notifications, alerts, and email sending
"""
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta
from database import get_db
from dependencies import get_current_user, require_superuser
import models
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)
router = APIRouter()


# =====================================================
# NOTIFICATION MODEL (Add to models.py if not exists)
# =====================================================
# We'll use a simple in-app notification system

def get_setting(db: Session, key: str, default: str = "") -> str:
    """Get a system setting value"""
    setting = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == key
    ).first()
    return setting.value if setting else default


# =====================================================
# EMAIL SENDING
# =====================================================

def send_email(
    db: Session,
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None
) -> bool:
    """Send an email using SMTP settings from system configuration"""
    try:
        enabled = get_setting(db, "notifications.email_enabled", "false")
        if enabled.lower() != "true":
            logger.info("Email notifications disabled")
            return False
        
        smtp_host = get_setting(db, "notifications.smtp_host")
        smtp_port = int(get_setting(db, "notifications.smtp_port", "587"))
        smtp_user = get_setting(db, "notifications.smtp_user")
        smtp_password = get_setting(db, "notifications.smtp_password")
        from_email = get_setting(db, "notifications.from_email")
        
        if not smtp_host or not from_email:
            logger.warning("SMTP not configured")
            return False
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = to_email
        
        msg.attach(MIMEText(body, "plain"))
        if html_body:
            msg.attach(MIMEText(html_body, "html"))
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def send_email_async(
    background_tasks: BackgroundTasks,
    db: Session,
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None
):
    """Queue email to be sent in background"""
    background_tasks.add_task(send_email, db, to_email, subject, body, html_body)


# =====================================================
# NOTIFICATION TEMPLATES
# =====================================================

NOTIFICATION_TEMPLATES = {
    "low_stock": {
        "title": "Low Stock Alert",
        "body": "Product {product_name} (SKU: {sku}) is below reorder point. Current qty: {quantity}, Reorder at: {reorder_point}"
    },
    "invoice_due": {
        "title": "Invoice Due Reminder",
        "body": "Invoice {invoice_number} for {customer_name} is due on {due_date}. Amount: {amount}"
    },
    "invoice_overdue": {
        "title": "Invoice Overdue",
        "body": "Invoice {invoice_number} for {customer_name} is overdue. Due date: {due_date}, Amount: {amount}"
    },
    "order_shipped": {
        "title": "Order Shipped",
        "body": "Sales order {order_number} has been shipped. Tracking: {tracking_number}"
    },
    "payment_received": {
        "title": "Payment Received",
        "body": "Payment of {amount} received for invoice {invoice_number}"
    },
    "work_order_complete": {
        "title": "Work Order Completed",
        "body": "Work order {work_order_number} has been completed"
    },
    "quality_issue": {
        "title": "Quality Issue Detected",
        "body": "Quality inspection {inspection_number} failed. Product: {product_name}"
    },
    "maintenance_due": {
        "title": "Maintenance Due",
        "body": "Asset {asset_name} is due for maintenance"
    },
    "tool_worn": {
        "title": "Tool Replacement Needed",
        "body": "Tool {tool_name} has reached its lifespan limit and needs replacement"
    },
    "support_ticket": {
        "title": "New Support Ticket",
        "body": "New support ticket #{ticket_id}: {subject}"
    },
    "purchase_order_received": {
        "title": "Purchase Order Received",
        "body": "Purchase order {po_number} items have been received"
    },
    "payroll_ready": {
        "title": "Payroll Ready for Review",
        "body": "Payroll period {period_name} is ready for review and approval"
    }
}


# =====================================================
# ALERT GENERATION
# =====================================================

@router.post("/check-alerts")
def check_and_generate_alerts(
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """
    Run alert checks and generate notifications.
    Should be called periodically (e.g., by a cron job or scheduler)
    """
    alerts_generated = []
    
    try:
        # 1. Low Stock Alerts
        low_stock_items = db.query(models.InventoryItem).join(models.Product).filter(
            models.InventoryItem.quantity_on_hand <= models.InventoryItem.reorder_point
        ).all()
        
        for item in low_stock_items:
            alerts_generated.append({
                "type": "low_stock",
                "product": item.product.name if item.product else f"Product #{item.product_id}",
                "quantity": item.quantity_on_hand
            })
        
        # 2. Overdue Invoices
        today = datetime.utcnow().date()
        overdue_invoices = db.query(models.Invoice).filter(
            models.Invoice.due_date < today,
            models.Invoice.status.notin_(["paid", "cancelled"])
        ).all()
        
        for inv in overdue_invoices:
            alerts_generated.append({
                "type": "invoice_overdue",
                "invoice": inv.invoice_number,
                "due_date": str(inv.due_date),
                "amount": inv.total_amount
            })
        
        # 3. Invoices Due Soon (within 3 days)
        due_soon = today + timedelta(days=3)
        upcoming_invoices = db.query(models.Invoice).filter(
            models.Invoice.due_date <= due_soon,
            models.Invoice.due_date >= today,
            models.Invoice.status.notin_(["paid", "cancelled"])
        ).all()
        
        for inv in upcoming_invoices:
            alerts_generated.append({
                "type": "invoice_due_soon",
                "invoice": inv.invoice_number,
                "due_date": str(inv.due_date)
            })
        
        # 4. Tools needing maintenance
        tools_due = db.query(models.Tool).filter(
            models.Tool.status != "retired",
            (
                (models.Tool.next_maintenance_date <= datetime.utcnow()) |
                (models.Tool.hours_used >= models.Tool.lifespan_hours * 0.9)
            )
        ).all()
        
        for tool in tools_due:
            alerts_generated.append({
                "type": "tool_maintenance",
                "tool": tool.name,
                "hours_used": tool.hours_used
            })
        
        # 5. Low stock consumables
        low_consumables = db.query(models.Consumable).filter(
            models.Consumable.is_active == True,
            models.Consumable.quantity_on_hand <= models.Consumable.reorder_point
        ).all()
        
        for cons in low_consumables:
            alerts_generated.append({
                "type": "low_consumable",
                "item": cons.name,
                "quantity": cons.quantity_on_hand
            })
        
        # 6. Assets needing maintenance
        assets_due = db.query(models.Asset).filter(
            models.Asset.status != "Disposed",
            models.Asset.next_maintenance_date <= datetime.utcnow()
        ).all()
        
        for asset in assets_due:
            alerts_generated.append({
                "type": "asset_maintenance",
                "asset": asset.name,
                "last_maintenance": str(asset.last_maintenance_date) if asset.last_maintenance_date else "Never"
            })
        
        return {
            "alerts_count": len(alerts_generated),
            "alerts": alerts_generated
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Error checking alerts: {e}")
        raise HTTPException(status_code=500, detail="Error checking alerts")


@router.get("/summary")
def get_notification_summary(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get summary counts of various alerts for dashboard"""
    try:
        today = datetime.utcnow().date()
        
        # Count various alerts
        low_stock_count = db.query(models.InventoryItem).filter(
            models.InventoryItem.quantity_on_hand <= models.InventoryItem.reorder_point
        ).count()
        
        overdue_invoices = db.query(models.Invoice).filter(
            models.Invoice.due_date < today,
            models.Invoice.status.notin_(["paid", "cancelled"])
        ).count()
        
        pending_orders = db.query(models.SalesOrder).filter(
            models.SalesOrder.status == "Pending"
        ).count()
        
        open_tickets = db.query(models.SupportTicket).filter(
            models.SupportTicket.status.in_(["Open", "In Progress"])
        ).count()
        
        pending_shipments = db.query(models.Shipment).filter(
            models.Shipment.status.in_(["pending", "processing"])
        ).count()
        
        return {
            "low_stock": low_stock_count,
            "overdue_invoices": overdue_invoices,
            "pending_orders": pending_orders,
            "open_tickets": open_tickets,
            "pending_shipments": pending_shipments,
            "total_alerts": low_stock_count + overdue_invoices + open_tickets
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Error getting notification summary: {e}")
        raise HTTPException(status_code=500, detail="Database error")


# =====================================================
# MANUAL NOTIFICATION SENDING
# =====================================================

@router.post("/send-email")
def send_email_manual(
    to_email: str,
    subject: str,
    body: str,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """Send a manual email (admin only)"""
    send_email_async(background_tasks, db, to_email, subject, body)
    return {"message": f"Email queued for delivery to {to_email}"}


@router.post("/test-email")
def test_email_config(
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """Test email configuration by sending a test email"""
    test_email = current_user.email
    if not test_email:
        raise HTTPException(status_code=400, detail="User has no email configured")
    
    success = send_email(
        db,
        test_email,
        "Wood ERP - Test Email",
        "This is a test email from your Wood ERP system. If you received this, email notifications are working correctly."
    )
    
    if success:
        return {"message": f"Test email sent to {test_email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send test email. Check SMTP configuration.")
