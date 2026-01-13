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

def generate_entry_number(db: Session) -> str:
    last = db.query(models.TimeEntry).order_by(models.TimeEntry.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"TIME{next_num:06d}"

@router.get("/", response_model=schemas.TimeEntryList)
@router.get("", response_model=schemas.TimeEntryList)
def get_time_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    entry_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.TimeEntry)
        if status:
            query = query.filter(models.TimeEntry.status == status)
        if entry_type:
            query = query.filter(models.TimeEntry.entry_type == entry_type)
        if search:
            query = query.filter(
                (models.TimeEntry.employee_name.ilike(f"%{search}%")) |
                (models.TimeEntry.entry_number.ilike(f"%{search}%"))
            )
        total = query.count()
        entries = query.order_by(models.TimeEntry.date.desc()).offset(skip).limit(limit).all()
        return {"items": entries, "total": total, "skip": skip, "limit": limit}
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{entry_id}", response_model=schemas.TimeEntry)
def get_time_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.TimeEntry).filter(models.TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    return entry

@router.post("/", response_model=schemas.TimeEntry, status_code=201)
def create_time_entry(entry: schemas.TimeEntryCreate, db: Session = Depends(get_db)):
    try:
        db_entry = models.TimeEntry(
            entry_number=generate_entry_number(db),
            **entry.model_dump()
        )
        db.add(db_entry)
        db.commit()
        db.refresh(db_entry)
        return db_entry
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating time entry: {e}")
        raise HTTPException(status_code=500, detail="Error creating time entry")

@router.put("/{entry_id}", response_model=schemas.TimeEntry)
def update_time_entry(entry_id: int, entry: schemas.TimeEntryUpdate, db: Session = Depends(get_db)):
    try:
        db_entry = db.query(models.TimeEntry).filter(models.TimeEntry.id == entry_id).first()
        if not db_entry:
            raise HTTPException(status_code=404, detail="Time entry not found")
        for key, value in entry.model_dump(exclude_unset=True).items():
            setattr(db_entry, key, value)
        db.commit()
        db.refresh(db_entry)
        return db_entry
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating time entry: {e}")
        raise HTTPException(status_code=500, detail="Error updating time entry")

@router.delete("/{entry_id}", status_code=204)
def delete_time_entry(entry_id: int, db: Session = Depends(get_db)):
    try:
        db_entry = db.query(models.TimeEntry).filter(models.TimeEntry.id == entry_id).first()
        if not db_entry:
            raise HTTPException(status_code=404, detail="Time entry not found")
        db.delete(db_entry)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting time entry: {e}")
        raise HTTPException(status_code=500, detail="Error deleting time entry")
