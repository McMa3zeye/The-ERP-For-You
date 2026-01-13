from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from database import get_db
import models
import schemas
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def generate_inspection_number(db: Session) -> str:
    last = db.query(models.QualityInspection).order_by(models.QualityInspection.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"QI{next_num:06d}"

@router.get("/", response_model=schemas.QualityInspectionList)
@router.get("", response_model=schemas.QualityInspectionList)
def get_inspections(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    inspection_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.QualityInspection).options(joinedload(models.QualityInspection.product))
        if status:
            query = query.filter(models.QualityInspection.status == status)
        if inspection_type:
            query = query.filter(models.QualityInspection.inspection_type == inspection_type)
        if search:
            query = query.filter(models.QualityInspection.inspection_number.ilike(f"%{search}%"))
        total = query.count()
        inspections = query.order_by(models.QualityInspection.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": inspections, "total": total, "skip": skip, "limit": limit}
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{inspection_id}", response_model=schemas.QualityInspection)
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.query(models.QualityInspection).options(
        joinedload(models.QualityInspection.product)
    ).filter(models.QualityInspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection

@router.post("/", response_model=schemas.QualityInspection, status_code=201)
def create_inspection(inspection: schemas.QualityInspectionCreate, db: Session = Depends(get_db)):
    try:
        db_inspection = models.QualityInspection(
            inspection_number=generate_inspection_number(db),
            **inspection.model_dump()
        )
        db.add(db_inspection)
        db.commit()
        db.refresh(db_inspection)
        return db_inspection
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating inspection: {e}")
        raise HTTPException(status_code=500, detail="Error creating inspection")

@router.put("/{inspection_id}", response_model=schemas.QualityInspection)
def update_inspection(inspection_id: int, inspection: schemas.QualityInspectionUpdate, db: Session = Depends(get_db)):
    try:
        db_inspection = db.query(models.QualityInspection).filter(models.QualityInspection.id == inspection_id).first()
        if not db_inspection:
            raise HTTPException(status_code=404, detail="Inspection not found")
        for key, value in inspection.model_dump(exclude_unset=True).items():
            setattr(db_inspection, key, value)
        db.commit()
        db.refresh(db_inspection)
        return db_inspection
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating inspection: {e}")
        raise HTTPException(status_code=500, detail="Error updating inspection")

@router.delete("/{inspection_id}", status_code=204)
def delete_inspection(inspection_id: int, db: Session = Depends(get_db)):
    try:
        db_inspection = db.query(models.QualityInspection).filter(models.QualityInspection.id == inspection_id).first()
        if not db_inspection:
            raise HTTPException(status_code=404, detail="Inspection not found")
        db.delete(db_inspection)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting inspection: {e}")
        raise HTTPException(status_code=500, detail="Error deleting inspection")
