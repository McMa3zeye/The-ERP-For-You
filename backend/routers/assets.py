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

def generate_asset_number(db: Session) -> str:
    last = db.query(models.Asset).order_by(models.Asset.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"ASSET{next_num:06d}"

@router.get("/", response_model=schemas.AssetList)
@router.get("", response_model=schemas.AssetList)
def get_assets(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Asset)
        if status:
            query = query.filter(models.Asset.status == status)
        if category:
            query = query.filter(models.Asset.category == category)
        if search:
            query = query.filter(
                (models.Asset.name.ilike(f"%{search}%")) |
                (models.Asset.asset_number.ilike(f"%{search}%")) |
                (models.Asset.serial_number.ilike(f"%{search}%"))
            )
        total = query.count()
        assets = query.order_by(models.Asset.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": assets, "total": total, "skip": skip, "limit": limit}
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{asset_id}", response_model=schemas.Asset)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset

@router.post("/", response_model=schemas.Asset, status_code=201)
def create_asset(asset: schemas.AssetCreate, db: Session = Depends(get_db)):
    try:
        db_asset = models.Asset(
            asset_number=generate_asset_number(db),
            **asset.model_dump()
        )
        db.add(db_asset)
        db.commit()
        db.refresh(db_asset)
        return db_asset
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating asset: {e}")
        raise HTTPException(status_code=500, detail="Error creating asset")

@router.put("/{asset_id}", response_model=schemas.Asset)
def update_asset(asset_id: int, asset: schemas.AssetUpdate, db: Session = Depends(get_db)):
    try:
        db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
        if not db_asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        for key, value in asset.model_dump(exclude_unset=True).items():
            setattr(db_asset, key, value)
        db.commit()
        db.refresh(db_asset)
        return db_asset
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating asset: {e}")
        raise HTTPException(status_code=500, detail="Error updating asset")

@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    try:
        db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
        if not db_asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        db.delete(db_asset)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting asset: {e}")
        raise HTTPException(status_code=500, detail="Error deleting asset")
