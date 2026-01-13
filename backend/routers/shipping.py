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

def generate_shipment_number(db: Session) -> str:
    last = db.query(models.Shipment).order_by(models.Shipment.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"SHIP{next_num:06d}"

@router.get("/", response_model=schemas.ShipmentList)
@router.get("", response_model=schemas.ShipmentList)
def get_shipments(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Shipment)
        if status:
            query = query.filter(models.Shipment.status == status)
        if search:
            query = query.filter(
                (models.Shipment.shipment_number.ilike(f"%{search}%")) |
                (models.Shipment.tracking_number.ilike(f"%{search}%"))
            )
        total = query.count()
        shipments = query.order_by(models.Shipment.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": shipments, "total": total, "skip": skip, "limit": limit}
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{shipment_id}", response_model=schemas.Shipment)
def get_shipment(shipment_id: int, db: Session = Depends(get_db)):
    shipment = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment

@router.post("/", response_model=schemas.Shipment, status_code=201)
def create_shipment(shipment: schemas.ShipmentCreate, db: Session = Depends(get_db)):
    try:
        db_shipment = models.Shipment(
            shipment_number=generate_shipment_number(db),
            **shipment.model_dump()
        )
        db.add(db_shipment)
        db.commit()
        db.refresh(db_shipment)
        return db_shipment
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating shipment: {e}")
        raise HTTPException(status_code=500, detail="Error creating shipment")

@router.put("/{shipment_id}", response_model=schemas.Shipment)
def update_shipment(shipment_id: int, shipment: schemas.ShipmentUpdate, db: Session = Depends(get_db)):
    try:
        db_shipment = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
        if not db_shipment:
            raise HTTPException(status_code=404, detail="Shipment not found")
        for key, value in shipment.model_dump(exclude_unset=True).items():
            setattr(db_shipment, key, value)
        db.commit()
        db.refresh(db_shipment)
        return db_shipment
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating shipment: {e}")
        raise HTTPException(status_code=500, detail="Error updating shipment")

@router.delete("/{shipment_id}", status_code=204)
def delete_shipment(shipment_id: int, db: Session = Depends(get_db)):
    try:
        db_shipment = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
        if not db_shipment:
            raise HTTPException(status_code=404, detail="Shipment not found")
        db.delete(db_shipment)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting shipment: {e}")
        raise HTTPException(status_code=500, detail="Error deleting shipment")
