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

def generate_lead_number(db: Session) -> str:
    last = db.query(models.Lead).order_by(models.Lead.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"LEAD{next_num:06d}"

@router.get("/", response_model=schemas.LeadList)
@router.get("", response_model=schemas.LeadList)
def get_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    stage: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Lead)
        if status:
            query = query.filter(models.Lead.status == status)
        if stage:
            query = query.filter(models.Lead.stage == stage)
        if search:
            query = query.filter(
                (models.Lead.company_name.ilike(f"%{search}%")) |
                (models.Lead.contact_name.ilike(f"%{search}%")) |
                (models.Lead.lead_number.ilike(f"%{search}%"))
            )
        total = query.count()
        leads = query.order_by(models.Lead.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": leads, "total": total, "skip": skip, "limit": limit}
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{lead_id}", response_model=schemas.Lead)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@router.post("/", response_model=schemas.Lead, status_code=201)
def create_lead(lead: schemas.LeadCreate, db: Session = Depends(get_db)):
    try:
        db_lead = models.Lead(
            lead_number=generate_lead_number(db),
            **lead.model_dump()
        )
        db.add(db_lead)
        db.commit()
        db.refresh(db_lead)
        return db_lead
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating lead: {e}")
        raise HTTPException(status_code=500, detail="Error creating lead")

@router.put("/{lead_id}", response_model=schemas.Lead)
def update_lead(lead_id: int, lead: schemas.LeadUpdate, db: Session = Depends(get_db)):
    try:
        db_lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
        if not db_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        for key, value in lead.model_dump(exclude_unset=True).items():
            setattr(db_lead, key, value)
        db.commit()
        db.refresh(db_lead)
        return db_lead
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating lead: {e}")
        raise HTTPException(status_code=500, detail="Error updating lead")

@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    try:
        db_lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
        if not db_lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        db.delete(db_lead)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting lead: {e}")
        raise HTTPException(status_code=500, detail="Error deleting lead")
