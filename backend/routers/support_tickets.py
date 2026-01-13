from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import Optional
import sys
import os
import logging

logger = logging.getLogger(__name__)

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
from database import get_db
import models
import schemas

router = APIRouter()

def generate_ticket_number(db: Session) -> str:
    """Generate Ticket number: TKT000000"""
    last = db.query(models.SupportTicket).filter(models.SupportTicket.ticket_number.like("TKT%")).order_by(models.SupportTicket.id.desc()).first()
    num = int(last.ticket_number[3:]) + 1 if last and last.ticket_number else 1
    return f"TKT{num:06d}"

@router.post("/", response_model=schemas.SupportTicket, status_code=201)
def create_ticket(ticket: schemas.SupportTicketCreate, db: Session = Depends(get_db)):
    """Create support ticket"""
    try:
        db_ticket = models.SupportTicket(
            ticket_number=generate_ticket_number(db),
            **ticket.model_dump()
        )
        db.add(db_ticket)
        db.commit()
        db.refresh(db_ticket)
        if db_ticket.customer_id:
            db_ticket.customer = db.query(models.Customer).filter(models.Customer.id == db_ticket.customer_id).first()
        return db_ticket
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error creating ticket: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Ticket number already exists")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while creating ticket")

@router.get("/", response_model=schemas.SupportTicketList)
def get_tickets(skip: int = Query(0), limit: int = Query(20), status: Optional[str] = None, priority: Optional[str] = None, category: Optional[str] = None, db: Session = Depends(get_db)):
    """Get support tickets"""
    try:
        query = db.query(models.SupportTicket)
        if status:
            query = query.filter(models.SupportTicket.status == status)
        if priority:
            query = query.filter(models.SupportTicket.priority == priority)
        if category:
            query = query.filter(models.SupportTicket.category == category)
        total = query.count()
        tickets = query.options(joinedload(models.SupportTicket.customer)).order_by(models.SupportTicket.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": tickets, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error getting tickets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/{ticket_id}", response_model=schemas.SupportTicket)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    try:
        ticket = db.query(models.SupportTicket).options(joinedload(models.SupportTicket.customer)).filter(models.SupportTicket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return ticket
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.put("/{ticket_id}", response_model=schemas.SupportTicket)
def update_ticket(ticket_id: int, ticket_update: schemas.SupportTicketUpdate, db: Session = Depends(get_db)):
    try:
        db_ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
        if not db_ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        update_data = ticket_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_ticket, field, value)
        
        db.commit()
        db.refresh(db_ticket)
        return db_ticket
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    try:
        db_ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
        if not db_ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        db.delete(db_ticket)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting ticket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")
