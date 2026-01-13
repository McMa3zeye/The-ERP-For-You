from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from database import get_db
import models
import schemas
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def generate_location_code(db: Session) -> str:
    last = db.query(models.WarehouseLocation).order_by(models.WarehouseLocation.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"LOC{next_num:06d}"

@router.get("/", response_model=schemas.WarehouseLocationList)
@router.get("", response_model=schemas.WarehouseLocationList)
def get_locations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    location_type: Optional[str] = None,
    warehouse: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.WarehouseLocation)
        if location_type:
            query = query.filter(models.WarehouseLocation.location_type == location_type)
        if warehouse:
            query = query.filter(models.WarehouseLocation.warehouse == warehouse)
        if search:
            query = query.filter(
                (models.WarehouseLocation.name.ilike(f"%{search}%")) |
                (models.WarehouseLocation.location_code.ilike(f"%{search}%"))
            )
        total = query.count()
        locations = query.order_by(models.WarehouseLocation.location_code).offset(skip).limit(limit).all()
        return {"items": locations, "total": total, "skip": skip, "limit": limit}
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{location_id}", response_model=schemas.WarehouseLocation)
def get_location(location_id: int, db: Session = Depends(get_db)):
    location = db.query(models.WarehouseLocation).filter(models.WarehouseLocation.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location

@router.post("/", response_model=schemas.WarehouseLocation, status_code=201)
def create_location(location: schemas.WarehouseLocationCreate, db: Session = Depends(get_db)):
    try:
        db_location = models.WarehouseLocation(
            location_code=generate_location_code(db),
            **location.model_dump()
        )
        db.add(db_location)
        db.commit()
        db.refresh(db_location)
        return db_location
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating location: {e}")
        raise HTTPException(status_code=500, detail="Error creating location")

@router.put("/{location_id}", response_model=schemas.WarehouseLocation)
def update_location(location_id: int, location: schemas.WarehouseLocationUpdate, db: Session = Depends(get_db)):
    try:
        db_location = db.query(models.WarehouseLocation).filter(models.WarehouseLocation.id == location_id).first()
        if not db_location:
            raise HTTPException(status_code=404, detail="Location not found")
        for key, value in location.model_dump(exclude_unset=True).items():
            setattr(db_location, key, value)
        db.commit()
        db.refresh(db_location)
        return db_location
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating location: {e}")
        raise HTTPException(status_code=500, detail="Error updating location")

@router.delete("/{location_id}", status_code=204)
def delete_location(location_id: int, db: Session = Depends(get_db)):
    try:
        db_location = db.query(models.WarehouseLocation).filter(models.WarehouseLocation.id == location_id).first()
        if not db_location:
            raise HTTPException(status_code=404, detail="Location not found")
        db.delete(db_location)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting location: {e}")
        raise HTTPException(status_code=500, detail="Error deleting location")
