from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from datetime import datetime
from database import get_db
import models
import schemas
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def generate_tool_number(db: Session) -> str:
    last = db.query(models.Tool).order_by(models.Tool.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"TL{next_num:05d}"


def generate_consumable_number(db: Session) -> str:
    last = db.query(models.Consumable).order_by(models.Consumable.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"CON{next_num:05d}"


# =====================================================
# TOOLS ENDPOINTS
# =====================================================

@router.get("/tools", response_model=schemas.ToolList)
@router.get("/tools/", response_model=schemas.ToolList)
def get_tools(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    category: Optional[str] = None,
    status: Optional[str] = None,
    condition: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Tool).options(joinedload(models.Tool.maintenance_logs))
        
        if category:
            query = query.filter(models.Tool.category == category)
        if status:
            query = query.filter(models.Tool.status == status)
        if condition:
            query = query.filter(models.Tool.condition == condition)
        if search:
            query = query.filter(
                (models.Tool.name.ilike(f"%{search}%")) |
                (models.Tool.tool_number.ilike(f"%{search}%")) |
                (models.Tool.brand.ilike(f"%{search}%"))
            )
        
        total = query.count()
        tools = query.order_by(models.Tool.name).offset(skip).limit(limit).all()
        return {"items": tools, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/tools/maintenance-due")
def get_tools_maintenance_due(db: Session = Depends(get_db)):
    """Get tools that are due for maintenance"""
    try:
        now = datetime.utcnow()
        tools = db.query(models.Tool).filter(
            models.Tool.status != "retired",
            (models.Tool.next_maintenance_date <= now) |
            (models.Tool.lifespan_hours != None) & (models.Tool.hours_used >= models.Tool.lifespan_hours * 0.9)
        ).all()
        
        return {"tools_due": tools, "count": len(tools)}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/tools/{tool_id}", response_model=schemas.Tool)
def get_tool(tool_id: int, db: Session = Depends(get_db)):
    tool = db.query(models.Tool).options(
        joinedload(models.Tool.maintenance_logs)
    ).filter(models.Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.post("/tools", response_model=schemas.Tool, status_code=201)
@router.post("/tools/", response_model=schemas.Tool, status_code=201)
def create_tool(tool: schemas.ToolCreate, db: Session = Depends(get_db)):
    try:
        tool_number = tool.tool_number if tool.tool_number else generate_tool_number(db)
        
        db_tool = models.Tool(
            tool_number=tool_number,
            **tool.model_dump(exclude={'tool_number'})
        )
        db.add(db_tool)
        db.commit()
        db.refresh(db_tool)
        return db_tool
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating tool: {e}")
        raise HTTPException(status_code=500, detail="Error creating tool")


@router.put("/tools/{tool_id}", response_model=schemas.Tool)
def update_tool(tool_id: int, tool: schemas.ToolUpdate, db: Session = Depends(get_db)):
    try:
        db_tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
        if not db_tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        
        for key, value in tool.model_dump(exclude_unset=True).items():
            setattr(db_tool, key, value)
        
        db.commit()
        db.refresh(db_tool)
        return db_tool
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating tool: {e}")
        raise HTTPException(status_code=500, detail="Error updating tool")


@router.post("/tools/{tool_id}/log-usage")
def log_tool_usage(
    tool_id: int,
    hours: float = 0,
    units: float = 0,
    db: Session = Depends(get_db)
):
    """Log usage hours/units for a tool"""
    try:
        tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        
        tool.hours_used += hours
        tool.units_produced += units
        
        # Check if maintenance is due
        if tool.lifespan_hours and tool.hours_used >= tool.lifespan_hours:
            tool.condition = "worn"
        elif tool.lifespan_hours and tool.hours_used >= tool.lifespan_hours * 0.8:
            tool.condition = "fair"
        
        db.commit()
        
        return {
            "message": "Usage logged",
            "total_hours": tool.hours_used,
            "total_units": tool.units_produced,
            "condition": tool.condition
        }
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error logging usage: {e}")
        raise HTTPException(status_code=500, detail="Error logging usage")


@router.post("/tools/{tool_id}/maintenance", response_model=schemas.ToolMaintenanceLog)
def log_tool_maintenance(tool_id: int, log: schemas.ToolMaintenanceLogCreate, db: Session = Depends(get_db)):
    """Log maintenance for a tool"""
    try:
        tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        
        db_log = models.ToolMaintenanceLog(
            tool_id=tool_id,
            maintenance_type=log.maintenance_type,
            performed_by=log.performed_by,
            cost=log.cost,
            hours_at_maintenance=tool.hours_used,
            condition_before=tool.condition,
            condition_after=log.condition_after or "good",
            notes=log.notes,
            next_maintenance_date=log.next_maintenance_date
        )
        db.add(db_log)
        
        # Update tool
        tool.last_maintenance_date = datetime.utcnow()
        if log.next_maintenance_date:
            tool.next_maintenance_date = log.next_maintenance_date
        if log.condition_after:
            tool.condition = log.condition_after
        if log.maintenance_type == "replacement":
            tool.hours_used = 0
            tool.units_produced = 0
        
        db.commit()
        db.refresh(db_log)
        return db_log
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error logging maintenance: {e}")
        raise HTTPException(status_code=500, detail="Error logging maintenance")


@router.delete("/tools/{tool_id}", status_code=204)
def delete_tool(tool_id: int, db: Session = Depends(get_db)):
    try:
        tool = db.query(models.Tool).filter(models.Tool.id == tool_id).first()
        if not tool:
            raise HTTPException(status_code=404, detail="Tool not found")
        
        db.delete(tool)
        db.commit()
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting tool: {e}")
        raise HTTPException(status_code=500, detail="Error deleting tool")


# =====================================================
# CONSUMABLES ENDPOINTS
# =====================================================

@router.get("/consumables", response_model=schemas.ConsumableList)
@router.get("/consumables/", response_model=schemas.ConsumableList)
def get_consumables(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    low_stock: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Consumable)
        
        if category:
            query = query.filter(models.Consumable.category == category)
        if is_active is not None:
            query = query.filter(models.Consumable.is_active == is_active)
        if low_stock:
            query = query.filter(models.Consumable.quantity_on_hand <= models.Consumable.reorder_point)
        if search:
            query = query.filter(
                (models.Consumable.name.ilike(f"%{search}%")) |
                (models.Consumable.consumable_number.ilike(f"%{search}%"))
            )
        
        total = query.count()
        consumables = query.order_by(models.Consumable.name).offset(skip).limit(limit).all()
        return {"items": consumables, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/consumables/low-stock")
def get_low_stock_consumables(db: Session = Depends(get_db)):
    """Get consumables below reorder point"""
    try:
        consumables = db.query(models.Consumable).filter(
            models.Consumable.is_active == True,
            models.Consumable.quantity_on_hand <= models.Consumable.reorder_point
        ).all()
        
        return {"items": consumables, "count": len(consumables)}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/consumables/{consumable_id}", response_model=schemas.Consumable)
def get_consumable(consumable_id: int, db: Session = Depends(get_db)):
    consumable = db.query(models.Consumable).filter(
        models.Consumable.id == consumable_id
    ).first()
    if not consumable:
        raise HTTPException(status_code=404, detail="Consumable not found")
    return consumable


@router.post("/consumables", response_model=schemas.Consumable, status_code=201)
@router.post("/consumables/", response_model=schemas.Consumable, status_code=201)
def create_consumable(consumable: schemas.ConsumableCreate, db: Session = Depends(get_db)):
    try:
        consumable_number = consumable.consumable_number if consumable.consumable_number else generate_consumable_number(db)
        
        db_consumable = models.Consumable(
            consumable_number=consumable_number,
            **consumable.model_dump(exclude={'consumable_number'})
        )
        db.add(db_consumable)
        db.commit()
        db.refresh(db_consumable)
        return db_consumable
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating consumable: {e}")
        raise HTTPException(status_code=500, detail="Error creating consumable")


@router.put("/consumables/{consumable_id}", response_model=schemas.Consumable)
def update_consumable(consumable_id: int, consumable: schemas.ConsumableUpdate, db: Session = Depends(get_db)):
    try:
        db_consumable = db.query(models.Consumable).filter(
            models.Consumable.id == consumable_id
        ).first()
        if not db_consumable:
            raise HTTPException(status_code=404, detail="Consumable not found")
        
        for key, value in consumable.model_dump(exclude_unset=True).items():
            setattr(db_consumable, key, value)
        
        db.commit()
        db.refresh(db_consumable)
        return db_consumable
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating consumable: {e}")
        raise HTTPException(status_code=500, detail="Error updating consumable")


@router.post("/consumables/{consumable_id}/use", response_model=schemas.ConsumableUsage)
def use_consumable(consumable_id: int, usage: schemas.ConsumableUsageCreate, db: Session = Depends(get_db)):
    """Log usage of a consumable"""
    try:
        consumable = db.query(models.Consumable).filter(
            models.Consumable.id == consumable_id
        ).first()
        if not consumable:
            raise HTTPException(status_code=404, detail="Consumable not found")
        
        if consumable.quantity_on_hand < usage.quantity_used:
            raise HTTPException(status_code=400, detail="Insufficient quantity on hand")
        
        # Create usage record
        db_usage = models.ConsumableUsage(
            consumable_id=consumable_id,
            **usage.model_dump(exclude={'consumable_id'})
        )
        db.add(db_usage)
        
        # Update quantity
        consumable.quantity_on_hand -= usage.quantity_used
        
        db.commit()
        db.refresh(db_usage)
        return db_usage
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error logging consumable usage: {e}")
        raise HTTPException(status_code=500, detail="Error logging usage")


@router.post("/consumables/{consumable_id}/restock")
def restock_consumable(
    consumable_id: int,
    quantity: float,
    unit_cost: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """Restock a consumable"""
    try:
        consumable = db.query(models.Consumable).filter(
            models.Consumable.id == consumable_id
        ).first()
        if not consumable:
            raise HTTPException(status_code=404, detail="Consumable not found")
        
        consumable.quantity_on_hand += quantity
        if unit_cost is not None:
            consumable.unit_cost = unit_cost
        
        db.commit()
        
        return {
            "message": "Restocked successfully",
            "new_quantity": consumable.quantity_on_hand
        }
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error restocking consumable: {e}")
        raise HTTPException(status_code=500, detail="Error restocking")


@router.delete("/consumables/{consumable_id}", status_code=204)
def delete_consumable(consumable_id: int, db: Session = Depends(get_db)):
    try:
        consumable = db.query(models.Consumable).filter(
            models.Consumable.id == consumable_id
        ).first()
        if not consumable:
            raise HTTPException(status_code=404, detail="Consumable not found")
        
        db.delete(consumable)
        db.commit()
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting consumable: {e}")
        raise HTTPException(status_code=500, detail="Error deleting consumable")


# =====================================================
# UTILITY ENDPOINTS
# =====================================================

@router.get("/categories/tools")
def get_tool_categories():
    return {
        "categories": [
            {"code": "saw_blade", "name": "Saw Blades"},
            {"code": "router_bit", "name": "Router Bits"},
            {"code": "drill_bit", "name": "Drill Bits"},
            {"code": "sanding_disc", "name": "Sanding Discs"},
            {"code": "chisel", "name": "Chisels"},
            {"code": "plane_blade", "name": "Plane Blades"},
            {"code": "measuring", "name": "Measuring Tools"},
            {"code": "clamp", "name": "Clamps"},
            {"code": "hand_tool", "name": "Hand Tools"},
            {"code": "other", "name": "Other"}
        ]
    }


@router.get("/categories/consumables")
def get_consumable_categories():
    return {
        "categories": [
            {"code": "sandpaper", "name": "Sandpaper"},
            {"code": "glue", "name": "Glue & Adhesives"},
            {"code": "finish", "name": "Finishes & Stains"},
            {"code": "screws", "name": "Screws"},
            {"code": "nails", "name": "Nails & Brads"},
            {"code": "hardware", "name": "Hardware"},
            {"code": "tape", "name": "Tape & Masking"},
            {"code": "cleaning", "name": "Cleaning Supplies"},
            {"code": "safety", "name": "Safety Equipment"},
            {"code": "other", "name": "Other"}
        ]
    }
