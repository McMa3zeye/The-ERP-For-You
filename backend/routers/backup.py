"""
Backup & Restore Router
Database backup, restore, and data export utilities
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from datetime import datetime, timezone
import os
import shutil
import json
import logging

from database import get_db, engine
from dependencies import require_superuser
import models

logger = logging.getLogger(__name__)
router = APIRouter()

# Backup directory
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "wood_erp.db")


# =====================================================
# DATABASE BACKUP
# =====================================================

@router.post("/create")
def create_backup(
    description: Optional[str] = None,
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """Create a database backup (SQLite copy)"""
    try:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_filename = f"backup_{timestamp}.db"
        backup_path = os.path.join(BACKUP_DIR, backup_filename)
        
        # Close all connections and copy
        db.close()
        
        # For SQLite, we can simply copy the file
        shutil.copy2(DB_PATH, backup_path)
        
        # Get file size
        file_size = os.path.getsize(backup_path)
        
        # Create metadata file
        metadata = {
            "timestamp": timestamp,
            "created_by": current_user.username,
            "description": description or "Manual backup",
            "file_size": file_size,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        metadata_path = backup_path.replace(".db", ".json")
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Backup created: {backup_filename} by {current_user.username}")
        
        return {
            "message": "Backup created successfully",
            "filename": backup_filename,
            "size_bytes": file_size,
            "path": backup_path
        }
        
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")


@router.get("/list")
def list_backups(
    current_user: models.User = Depends(require_superuser)
):
    """List all available backups"""
    try:
        backups = []
        
        for filename in os.listdir(BACKUP_DIR):
            if filename.endswith(".db"):
                file_path = os.path.join(BACKUP_DIR, filename)
                metadata_path = file_path.replace(".db", ".json")
                
                backup_info = {
                    "filename": filename,
                    "size_bytes": os.path.getsize(file_path),
                    "created": datetime.fromtimestamp(os.path.getctime(file_path)).isoformat()
                }
                
                # Load metadata if exists
                if os.path.exists(metadata_path):
                    with open(metadata_path, "r") as f:
                        metadata = json.load(f)
                        backup_info.update(metadata)
                
                backups.append(backup_info)
        
        # Sort by creation date descending
        backups.sort(key=lambda x: x.get("created", ""), reverse=True)
        
        return {"backups": backups, "count": len(backups)}
        
    except Exception as e:
        logger.error(f"Error listing backups: {e}")
        raise HTTPException(status_code=500, detail="Error listing backups")


@router.get("/download/{filename}")
def download_backup(
    filename: str,
    current_user: models.User = Depends(require_superuser)
):
    """Download a backup file"""
    # Security: prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    file_path = os.path.join(BACKUP_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Backup not found")
    
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=filename
    )


@router.delete("/{filename}")
def delete_backup(
    filename: str,
    current_user: models.User = Depends(require_superuser)
):
    """Delete a backup file"""
    # Security: prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    file_path = os.path.join(BACKUP_DIR, filename)
    metadata_path = file_path.replace(".db", ".json")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Backup not found")
    
    try:
        os.remove(file_path)
        if os.path.exists(metadata_path):
            os.remove(metadata_path)
        
        logger.info(f"Backup deleted: {filename} by {current_user.username}")
        return {"message": "Backup deleted"}
        
    except Exception as e:
        logger.error(f"Error deleting backup: {e}")
        raise HTTPException(status_code=500, detail="Error deleting backup")


@router.post("/restore/{filename}")
def restore_backup(
    filename: str,
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """
    Restore from a backup file.
    WARNING: This will replace the current database!
    """
    # Security: prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    backup_path = os.path.join(BACKUP_DIR, filename)
    
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup not found")
    
    try:
        # First, create a backup of current state
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        pre_restore_backup = os.path.join(BACKUP_DIR, f"pre_restore_{timestamp}.db")
        
        db.close()
        shutil.copy2(DB_PATH, pre_restore_backup)
        
        # Restore the backup
        shutil.copy2(backup_path, DB_PATH)
        
        logger.info(f"Database restored from {filename} by {current_user.username}")
        
        return {
            "message": "Database restored successfully",
            "restored_from": filename,
            "pre_restore_backup": f"pre_restore_{timestamp}.db",
            "note": "Please restart the application for changes to take effect"
        }
        
    except Exception as e:
        logger.error(f"Restore failed: {e}")
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")


# =====================================================
# CLEANUP OLD BACKUPS
# =====================================================

@router.post("/cleanup")
def cleanup_old_backups(
    retention_days: int = 30,
    current_user: models.User = Depends(require_superuser)
):
    """Delete backups older than retention period"""
    try:
        cutoff = datetime.now(timezone.utc).timestamp() - (retention_days * 24 * 60 * 60)
        deleted = []
        
        for filename in os.listdir(BACKUP_DIR):
            if filename.endswith(".db"):
                file_path = os.path.join(BACKUP_DIR, filename)
                if os.path.getctime(file_path) < cutoff:
                    os.remove(file_path)
                    metadata_path = file_path.replace(".db", ".json")
                    if os.path.exists(metadata_path):
                        os.remove(metadata_path)
                    deleted.append(filename)
        
        logger.info(f"Cleanup: deleted {len(deleted)} old backups")
        return {"deleted_count": len(deleted), "deleted_files": deleted}
        
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        raise HTTPException(status_code=500, detail="Cleanup failed")


# =====================================================
# DATA EXPORT (JSON)
# =====================================================

@router.get("/export/{table_name}")
def export_table(
    table_name: str,
    current_user: models.User = Depends(require_superuser),
    db: Session = Depends(get_db)
):
    """Export a table as JSON"""
    # Whitelist of exportable tables
    ALLOWED_TABLES = [
        "products", "customers", "suppliers", "inventory_items",
        "sales_orders", "invoices", "purchase_orders", "employees",
        "chart_of_accounts", "tools", "consumables"
    ]
    
    if table_name not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"Table not exportable. Allowed: {ALLOWED_TABLES}")
    
    try:
        # Map table names to models
        TABLE_MAP = {
            "products": models.Product,
            "customers": models.Customer,
            "suppliers": models.Supplier,
            "inventory_items": models.InventoryItem,
            "sales_orders": models.SalesOrder,
            "invoices": models.Invoice,
            "purchase_orders": models.PurchaseOrder,
            "employees": models.Employee,
            "chart_of_accounts": models.ChartOfAccount,
            "tools": models.Tool,
            "consumables": models.Consumable
        }
        
        model = TABLE_MAP.get(table_name)
        if not model:
            raise HTTPException(status_code=400, detail="Invalid table")
        
        records = db.query(model).all()
        
        # Convert to dicts (simplified)
        data = []
        for record in records:
            record_dict = {}
            for column in record.__table__.columns:
                value = getattr(record, column.name)
                if isinstance(value, datetime):
                    value = value.isoformat()
                record_dict[column.name] = value
            data.append(record_dict)
        
        return Response(
            content=json.dumps({"table": table_name, "count": len(data), "data": data}, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={table_name}_export.json"}
        )
        
    except Exception as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
