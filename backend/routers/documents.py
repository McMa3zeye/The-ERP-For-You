from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional
from datetime import datetime
from database import get_db
import models
import schemas
import logging
import os

logger = logging.getLogger(__name__)
router = APIRouter()

# Configure upload directory
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def generate_document_number(db: Session) -> str:
    last = db.query(models.Document).order_by(models.Document.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"DOC{next_num:06d}"


# =====================================================
# DOCUMENTS ENDPOINTS
# =====================================================

@router.get("/", response_model=schemas.DocumentList)
@router.get("", response_model=schemas.DocumentList)
def get_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    linked_entity_type: Optional[str] = None,
    linked_entity_id: Optional[int] = None,
    is_archived: Optional[bool] = False,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Document).options(joinedload(models.Document.versions))
        
        if category:
            query = query.filter(models.Document.category == category)
        if linked_entity_type:
            query = query.filter(models.Document.linked_entity_type == linked_entity_type)
        if linked_entity_id:
            query = query.filter(models.Document.linked_entity_id == linked_entity_id)
        if is_archived is not None:
            query = query.filter(models.Document.is_archived == is_archived)
        if search:
            query = query.filter(
                (models.Document.name.ilike(f"%{search}%")) |
                (models.Document.document_number.ilike(f"%{search}%")) |
                (models.Document.description.ilike(f"%{search}%"))
            )
        
        total = query.count()
        documents = query.order_by(models.Document.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": documents, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/{document_id}", response_model=schemas.Document)
def get_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(models.Document).options(
        joinedload(models.Document.versions)
    ).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.post("/", response_model=schemas.Document, status_code=201)
@router.post("", response_model=schemas.Document, status_code=201)
def create_document(document: schemas.DocumentCreate, db: Session = Depends(get_db)):
    try:
        db_document = models.Document(
            document_number=generate_document_number(db),
            **document.model_dump()
        )
        db.add(db_document)
        db.flush()
        
        # Create initial version if file_path provided
        if document.file_path:
            version = models.DocumentVersion(
                document_id=db_document.id,
                version_number=1,
                file_path=document.file_path,
                file_size=document.file_size
            )
            db.add(version)
        
        db.commit()
        db.refresh(db_document)
        return db_document
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating document: {e}")
        raise HTTPException(status_code=500, detail="Error creating document")


@router.put("/{document_id}", response_model=schemas.Document)
def update_document(document_id: int, document: schemas.DocumentUpdate, db: Session = Depends(get_db)):
    try:
        db_document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not db_document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        for key, value in document.model_dump(exclude_unset=True).items():
            setattr(db_document, key, value)
        
        db.commit()
        db.refresh(db_document)
        return db_document
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating document: {e}")
        raise HTTPException(status_code=500, detail="Error updating document")


@router.post("/{document_id}/versions", response_model=schemas.DocumentVersion)
def add_document_version(
    document_id: int,
    file_path: str,
    change_notes: Optional[str] = None,
    file_size: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Add a new version to an existing document"""
    try:
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        new_version_number = document.current_version + 1
        
        version = models.DocumentVersion(
            document_id=document_id,
            version_number=new_version_number,
            file_path=file_path,
            file_size=file_size,
            change_notes=change_notes
        )
        db.add(version)
        
        document.current_version = new_version_number
        document.file_path = file_path
        if file_size:
            document.file_size = file_size
        
        db.commit()
        db.refresh(version)
        return version
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error adding version: {e}")
        raise HTTPException(status_code=500, detail="Error adding version")


@router.get("/{document_id}/versions")
def get_document_versions(document_id: int, db: Session = Depends(get_db)):
    """Get all versions of a document"""
    try:
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        versions = db.query(models.DocumentVersion).filter(
            models.DocumentVersion.document_id == document_id
        ).order_by(models.DocumentVersion.version_number.desc()).all()
        
        return {"document_id": document_id, "versions": versions}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/{document_id}/archive")
def archive_document(document_id: int, db: Session = Depends(get_db)):
    """Archive a document"""
    try:
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document.is_archived = True
        db.commit()
        
        return {"message": "Document archived"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error archiving document: {e}")
        raise HTTPException(status_code=500, detail="Error archiving document")


@router.post("/{document_id}/unarchive")
def unarchive_document(document_id: int, db: Session = Depends(get_db)):
    """Unarchive a document"""
    try:
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document.is_archived = False
        db.commit()
        
        return {"message": "Document unarchived"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error unarchiving document: {e}")
        raise HTTPException(status_code=500, detail="Error unarchiving document")


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    try:
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        db.delete(document)
        db.commit()
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail="Error deleting document")


# =====================================================
# LINKED DOCUMENTS ENDPOINTS
# =====================================================

@router.get("/linked/{entity_type}/{entity_id}")
def get_linked_documents(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db)
):
    """Get all documents linked to a specific entity"""
    try:
        documents = db.query(models.Document).filter(
            models.Document.linked_entity_type == entity_type,
            models.Document.linked_entity_id == entity_id,
            models.Document.is_archived == False
        ).order_by(models.Document.created_at.desc()).all()
        
        return {"entity_type": entity_type, "entity_id": entity_id, "documents": documents}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/{document_id}/link")
def link_document(
    document_id: int,
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db)
):
    """Link a document to an entity"""
    try:
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document.linked_entity_type = entity_type
        document.linked_entity_id = entity_id
        db.commit()
        
        return {"message": "Document linked successfully"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error linking document: {e}")
        raise HTTPException(status_code=500, detail="Error linking document")


@router.post("/{document_id}/unlink")
def unlink_document(document_id: int, db: Session = Depends(get_db)):
    """Unlink a document from its entity"""
    try:
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document.linked_entity_type = None
        document.linked_entity_id = None
        db.commit()
        
        return {"message": "Document unlinked successfully"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error unlinking document: {e}")
        raise HTTPException(status_code=500, detail="Error unlinking document")


# =====================================================
# UTILITY ENDPOINTS
# =====================================================

@router.get("/categories/list")
def get_document_categories():
    """Get list of document categories"""
    return {
        "categories": [
            {"code": "blueprint", "name": "Blueprint/Drawing"},
            {"code": "design", "name": "Design File"},
            {"code": "cad", "name": "CAD File"},
            {"code": "photo", "name": "Photo/Image"},
            {"code": "manual", "name": "Manual/Instructions"},
            {"code": "contract", "name": "Contract"},
            {"code": "invoice", "name": "Invoice/Receipt"},
            {"code": "certificate", "name": "Certificate"},
            {"code": "specification", "name": "Specification"},
            {"code": "other", "name": "Other"}
        ]
    }


@router.get("/entity-types/list")
def get_entity_types():
    """Get list of linkable entity types"""
    return {
        "entity_types": [
            {"code": "product", "name": "Product"},
            {"code": "work_order", "name": "Work Order"},
            {"code": "project", "name": "Project"},
            {"code": "sales_order", "name": "Sales Order"},
            {"code": "customer", "name": "Customer"},
            {"code": "supplier", "name": "Supplier"},
            {"code": "asset", "name": "Asset"},
            {"code": "employee", "name": "Employee"}
        ]
    }
