from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
import models
import schemas
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def generate_schedule_number(db: Session) -> str:
    last = db.query(models.ProductionSchedule).order_by(models.ProductionSchedule.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"PS{next_num:06d}"


def generate_resource_code(db: Session) -> str:
    last = db.query(models.ProductionResource).order_by(models.ProductionResource.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"RES{next_num:04d}"


# =====================================================
# PRODUCTION RESOURCES ENDPOINTS
# =====================================================

@router.get("/resources", response_model=schemas.ProductionResourceList)
@router.get("/resources/", response_model=schemas.ProductionResourceList)
def get_resources(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    resource_type: Optional[str] = None,
    is_available: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.ProductionResource)
        
        if resource_type:
            query = query.filter(models.ProductionResource.resource_type == resource_type)
        if is_available is not None:
            query = query.filter(models.ProductionResource.is_available == is_available)
        if search:
            query = query.filter(
                (models.ProductionResource.name.ilike(f"%{search}%")) |
                (models.ProductionResource.resource_code.ilike(f"%{search}%"))
            )
        
        total = query.count()
        resources = query.order_by(models.ProductionResource.name).offset(skip).limit(limit).all()
        return {"items": resources, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/resources/{resource_id}", response_model=schemas.ProductionResource)
def get_resource(resource_id: int, db: Session = Depends(get_db)):
    resource = db.query(models.ProductionResource).filter(
        models.ProductionResource.id == resource_id
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


@router.post("/resources", response_model=schemas.ProductionResource, status_code=201)
@router.post("/resources/", response_model=schemas.ProductionResource, status_code=201)
def create_resource(resource: schemas.ProductionResourceCreate, db: Session = Depends(get_db)):
    try:
        # Auto-generate code if not unique
        code = resource.resource_code
        existing = db.query(models.ProductionResource).filter(
            models.ProductionResource.resource_code == code
        ).first()
        if existing:
            code = generate_resource_code(db)
        
        db_resource = models.ProductionResource(**resource.model_dump(exclude={'resource_code'}), resource_code=code)
        db.add(db_resource)
        db.commit()
        db.refresh(db_resource)
        return db_resource
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating resource: {e}")
        raise HTTPException(status_code=500, detail="Error creating resource")


@router.put("/resources/{resource_id}", response_model=schemas.ProductionResource)
def update_resource(resource_id: int, resource: schemas.ProductionResourceUpdate, db: Session = Depends(get_db)):
    try:
        db_resource = db.query(models.ProductionResource).filter(
            models.ProductionResource.id == resource_id
        ).first()
        if not db_resource:
            raise HTTPException(status_code=404, detail="Resource not found")
        
        for key, value in resource.model_dump(exclude_unset=True).items():
            setattr(db_resource, key, value)
        
        db.commit()
        db.refresh(db_resource)
        return db_resource
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating resource: {e}")
        raise HTTPException(status_code=500, detail="Error updating resource")


@router.delete("/resources/{resource_id}", status_code=204)
def delete_resource(resource_id: int, db: Session = Depends(get_db)):
    try:
        db_resource = db.query(models.ProductionResource).filter(
            models.ProductionResource.id == resource_id
        ).first()
        if not db_resource:
            raise HTTPException(status_code=404, detail="Resource not found")
        
        db.delete(db_resource)
        db.commit()
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting resource: {e}")
        raise HTTPException(status_code=500, detail="Error deleting resource")


# =====================================================
# PRODUCTION SCHEDULES ENDPOINTS
# =====================================================

@router.get("/schedules", response_model=schemas.ProductionScheduleList)
@router.get("/schedules/", response_model=schemas.ProductionScheduleList)
def get_schedules(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    resource_id: Optional[int] = None,
    work_order_id: Optional[int] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.ProductionSchedule).options(
            joinedload(models.ProductionSchedule.resource)
        )
        
        if resource_id:
            query = query.filter(models.ProductionSchedule.resource_id == resource_id)
        if work_order_id:
            query = query.filter(models.ProductionSchedule.work_order_id == work_order_id)
        if status:
            query = query.filter(models.ProductionSchedule.status == status)
        if start_date:
            query = query.filter(models.ProductionSchedule.scheduled_start >= start_date)
        if end_date:
            query = query.filter(models.ProductionSchedule.scheduled_end <= end_date)
        
        total = query.count()
        schedules = query.order_by(models.ProductionSchedule.scheduled_start).offset(skip).limit(limit).all()
        return {"items": schedules, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/schedules/calendar")
def get_calendar_events(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
    resource_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get schedules formatted for calendar display"""
    try:
        query = db.query(models.ProductionSchedule).options(
            joinedload(models.ProductionSchedule.resource)
        ).filter(
            models.ProductionSchedule.scheduled_start <= end,
            models.ProductionSchedule.scheduled_end >= start
        )
        
        if resource_id:
            query = query.filter(models.ProductionSchedule.resource_id == resource_id)
        
        schedules = query.all()
        
        events = []
        for s in schedules:
            events.append({
                "id": s.id,
                "title": s.title,
                "start": s.scheduled_start.isoformat() if s.scheduled_start else None,
                "end": s.scheduled_end.isoformat() if s.scheduled_end else None,
                "color": s.color or get_status_color(s.status),
                "status": s.status,
                "resource_id": s.resource_id,
                "resource_name": s.resource.name if s.resource else None,
                "work_order_id": s.work_order_id,
                "priority": s.priority,
                "quantity_planned": s.quantity_planned,
                "quantity_completed": s.quantity_completed
            })
        
        return {"events": events}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


def get_status_color(status: str) -> str:
    colors = {
        "scheduled": "#3498db",
        "in_progress": "#f39c12",
        "completed": "#27ae60",
        "cancelled": "#95a5a6",
        "delayed": "#e74c3c"
    }
    return colors.get(status, "#3498db")


@router.get("/schedules/{schedule_id}", response_model=schemas.ProductionSchedule)
def get_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(models.ProductionSchedule).options(
        joinedload(models.ProductionSchedule.resource)
    ).filter(models.ProductionSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.post("/schedules", response_model=schemas.ProductionSchedule, status_code=201)
@router.post("/schedules/", response_model=schemas.ProductionSchedule, status_code=201)
def create_schedule(schedule: schemas.ProductionScheduleCreate, db: Session = Depends(get_db)):
    try:
        # Check for resource conflicts
        if schedule.resource_id:
            conflicts = db.query(models.ProductionSchedule).filter(
                models.ProductionSchedule.resource_id == schedule.resource_id,
                models.ProductionSchedule.status.notin_(["completed", "cancelled"]),
                models.ProductionSchedule.scheduled_start < schedule.scheduled_end,
                models.ProductionSchedule.scheduled_end > schedule.scheduled_start
            ).count()
            
            if conflicts > 0:
                logger.warning(f"Resource {schedule.resource_id} has {conflicts} potential scheduling conflicts")
        
        db_schedule = models.ProductionSchedule(
            schedule_number=generate_schedule_number(db),
            **schedule.model_dump()
        )
        db.add(db_schedule)
        db.commit()
        db.refresh(db_schedule)
        return db_schedule
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating schedule: {e}")
        raise HTTPException(status_code=500, detail="Error creating schedule")


@router.put("/schedules/{schedule_id}", response_model=schemas.ProductionSchedule)
def update_schedule(schedule_id: int, schedule: schemas.ProductionScheduleUpdate, db: Session = Depends(get_db)):
    try:
        db_schedule = db.query(models.ProductionSchedule).filter(
            models.ProductionSchedule.id == schedule_id
        ).first()
        if not db_schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        for key, value in schedule.model_dump(exclude_unset=True).items():
            setattr(db_schedule, key, value)
        
        db.commit()
        db.refresh(db_schedule)
        return db_schedule
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating schedule: {e}")
        raise HTTPException(status_code=500, detail="Error updating schedule")


@router.post("/schedules/{schedule_id}/start")
def start_schedule(schedule_id: int, db: Session = Depends(get_db)):
    """Mark schedule as in progress"""
    try:
        schedule = db.query(models.ProductionSchedule).filter(
            models.ProductionSchedule.id == schedule_id
        ).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        schedule.status = "in_progress"
        schedule.actual_start = datetime.utcnow()
        db.commit()
        
        return {"message": "Schedule started", "status": "in_progress"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error starting schedule: {e}")
        raise HTTPException(status_code=500, detail="Error starting schedule")


@router.post("/schedules/{schedule_id}/complete")
def complete_schedule(schedule_id: int, quantity_completed: float = None, db: Session = Depends(get_db)):
    """Mark schedule as completed"""
    try:
        schedule = db.query(models.ProductionSchedule).filter(
            models.ProductionSchedule.id == schedule_id
        ).first()
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        schedule.status = "completed"
        schedule.actual_end = datetime.utcnow()
        if quantity_completed is not None:
            schedule.quantity_completed = quantity_completed
        else:
            schedule.quantity_completed = schedule.quantity_planned
        
        db.commit()
        
        return {"message": "Schedule completed", "status": "completed"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error completing schedule: {e}")
        raise HTTPException(status_code=500, detail="Error completing schedule")


@router.delete("/schedules/{schedule_id}", status_code=204)
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    try:
        db_schedule = db.query(models.ProductionSchedule).filter(
            models.ProductionSchedule.id == schedule_id
        ).first()
        if not db_schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        db.delete(db_schedule)
        db.commit()
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting schedule: {e}")
        raise HTTPException(status_code=500, detail="Error deleting schedule")


# =====================================================
# UTILITY ENDPOINTS
# =====================================================

@router.get("/resource-types")
def get_resource_types():
    """Get list of resource types"""
    return {
        "types": [
            {"code": "machine", "name": "Machine/Equipment"},
            {"code": "workstation", "name": "Workstation"},
            {"code": "labor", "name": "Labor/Personnel"},
            {"code": "tool", "name": "Specialized Tool"},
            {"code": "area", "name": "Work Area/Bay"}
        ]
    }


@router.get("/resource-utilization")
def get_resource_utilization(
    start_date: str = Query(...),
    end_date: str = Query(...),
    db: Session = Depends(get_db)
):
    """Get resource utilization report"""
    try:
        resources = db.query(models.ProductionResource).filter(
            models.ProductionResource.is_available == True
        ).all()
        
        utilization = []
        for resource in resources:
            schedules = db.query(models.ProductionSchedule).filter(
                models.ProductionSchedule.resource_id == resource.id,
                models.ProductionSchedule.scheduled_start >= start_date,
                models.ProductionSchedule.scheduled_end <= end_date,
                models.ProductionSchedule.status.notin_(["cancelled"])
            ).all()
            
            total_hours = 0
            for s in schedules:
                if s.scheduled_start and s.scheduled_end:
                    duration = (s.scheduled_end - s.scheduled_start).total_seconds() / 3600
                    total_hours += duration
            
            utilization.append({
                "resource_id": resource.id,
                "resource_code": resource.resource_code,
                "resource_name": resource.name,
                "resource_type": resource.resource_type,
                "scheduled_hours": round(total_hours, 2),
                "schedule_count": len(schedules)
            })
        
        return {"utilization": utilization, "start_date": start_date, "end_date": end_date}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")
