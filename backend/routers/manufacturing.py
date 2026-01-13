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

def generate_bom_number(db: Session) -> str:
    last = db.query(models.BillOfMaterials).order_by(models.BillOfMaterials.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"BOM{next_num:06d}"

@router.get("/", response_model=schemas.BillOfMaterialsList)
@router.get("", response_model=schemas.BillOfMaterialsList)
def get_boms(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.BillOfMaterials).options(
            joinedload(models.BillOfMaterials.product),
            joinedload(models.BillOfMaterials.components).joinedload(models.BOMComponent.component)
        )
        if status:
            query = query.filter(models.BillOfMaterials.status == status)
        if search:
            query = query.filter(models.BillOfMaterials.bom_number.ilike(f"%{search}%"))
        total = db.query(models.BillOfMaterials).count()
        boms = query.order_by(models.BillOfMaterials.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": boms, "total": total, "skip": skip, "limit": limit}
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{bom_id}", response_model=schemas.BillOfMaterials)
def get_bom(bom_id: int, db: Session = Depends(get_db)):
    bom = db.query(models.BillOfMaterials).options(
        joinedload(models.BillOfMaterials.product),
        joinedload(models.BillOfMaterials.components).joinedload(models.BOMComponent.component)
    ).filter(models.BillOfMaterials.id == bom_id).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")
    return bom

@router.post("/", response_model=schemas.BillOfMaterials, status_code=201)
def create_bom(bom: schemas.BillOfMaterialsCreate, db: Session = Depends(get_db)):
    try:
        db_bom = models.BillOfMaterials(
            bom_number=generate_bom_number(db),
            product_id=bom.product_id,
            version=bom.version,
            status=bom.status,
            effective_date=bom.effective_date,
            quantity=bom.quantity,
            labor_hours=bom.labor_hours,
            labor_cost=bom.labor_cost,
            overhead_cost=bom.overhead_cost,
            notes=bom.notes
        )
        db.add(db_bom)
        db.flush()
        
        for comp in bom.components:
            db_comp = models.BOMComponent(
                bom_id=db_bom.id,
                component_id=comp.component_id,
                quantity=comp.quantity,
                unit_of_measure=comp.unit_of_measure,
                scrap_rate=comp.scrap_rate,
                notes=comp.notes
            )
            db.add(db_comp)
        
        db.commit()
        db.refresh(db_bom)
        return db_bom
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating BOM: {e}")
        raise HTTPException(status_code=500, detail="Error creating BOM")

@router.put("/{bom_id}", response_model=schemas.BillOfMaterials)
def update_bom(bom_id: int, bom: schemas.BillOfMaterialsUpdate, db: Session = Depends(get_db)):
    try:
        db_bom = db.query(models.BillOfMaterials).filter(models.BillOfMaterials.id == bom_id).first()
        if not db_bom:
            raise HTTPException(status_code=404, detail="BOM not found")
        for key, value in bom.model_dump(exclude_unset=True).items():
            setattr(db_bom, key, value)
        db.commit()
        db.refresh(db_bom)
        return db_bom
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating BOM: {e}")
        raise HTTPException(status_code=500, detail="Error updating BOM")

@router.delete("/{bom_id}", status_code=204)
def delete_bom(bom_id: int, db: Session = Depends(get_db)):
    try:
        db_bom = db.query(models.BillOfMaterials).filter(models.BillOfMaterials.id == bom_id).first()
        if not db_bom:
            raise HTTPException(status_code=404, detail="BOM not found")
        db.delete(db_bom)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting BOM: {e}")
        raise HTTPException(status_code=500, detail="Error deleting BOM")

@router.post("/{bom_id}/components", response_model=schemas.BOMComponent, status_code=201)
def add_component(bom_id: int, component: schemas.BOMComponentCreate, db: Session = Depends(get_db)):
    try:
        db_bom = db.query(models.BillOfMaterials).filter(models.BillOfMaterials.id == bom_id).first()
        if not db_bom:
            raise HTTPException(status_code=404, detail="BOM not found")
        db_comp = models.BOMComponent(bom_id=bom_id, **component.model_dump())
        db.add(db_comp)
        db.commit()
        db.refresh(db_comp)
        return db_comp
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error adding component: {e}")
        raise HTTPException(status_code=500, detail="Error adding component")

@router.delete("/{bom_id}/components/{component_id}", status_code=204)
def remove_component(bom_id: int, component_id: int, db: Session = Depends(get_db)):
    try:
        db_comp = db.query(models.BOMComponent).filter(
            models.BOMComponent.bom_id == bom_id,
            models.BOMComponent.id == component_id
        ).first()
        if not db_comp:
            raise HTTPException(status_code=404, detail="Component not found")
        db.delete(db_comp)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error removing component: {e}")
        raise HTTPException(status_code=500, detail="Error removing component")
