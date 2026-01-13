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

@router.post("/", response_model=schemas.Project, status_code=201)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    """Create project"""
    try:
        db_project = models.Project(**project.model_dump())
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        return db_project
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error creating project: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="Project code already exists")
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating project: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while creating project")

@router.get("/", response_model=schemas.ProjectList)
@router.get("", response_model=schemas.ProjectList)  # Support both with and without trailing slash
def get_projects(skip: int = Query(0), limit: int = Query(20), status: Optional[str] = None, search: Optional[str] = None, db: Session = Depends(get_db)):
    """Get projects"""
    try:
        query = db.query(models.Project)
        if status:
            query = query.filter(models.Project.status == status)
        if search:
            query = query.filter(models.Project.name.ilike(f"%{search}%"))
        total = query.count()
        projects = query.options(joinedload(models.Project.customer), joinedload(models.Project.tasks)).order_by(models.Project.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": projects, "total": total, "skip": skip, "limit": limit}
    except Exception as e:
        logger.error(f"Error getting projects: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.get("/{project_id}", response_model=schemas.Project)
def get_project(project_id: int, db: Session = Depends(get_db)):
    try:
        project = db.query(models.Project).options(joinedload(models.Project.tasks), joinedload(models.Project.customer)).filter(models.Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.put("/{project_id}", response_model=schemas.Project)
def update_project(project_id: int, project_update: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    try:
        db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not db_project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        update_data = project_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_project, field, value)
        
        db.commit()
        db.refresh(db_project)
        return db_project
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating project: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    try:
        db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not db_project:
            raise HTTPException(status_code=404, detail="Project not found")
        db.delete(db_project)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting project: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.post("/{project_id}/tasks", response_model=schemas.ProjectTask, status_code=201)
def create_project_task(project_id: int, task: schemas.ProjectTaskCreate, db: Session = Depends(get_db)):
    """Create project task"""
    try:
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        db_task = models.ProjectTask(project_id=project_id, **task.model_dump())
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        return db_task
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.put("/tasks/{task_id}", response_model=schemas.ProjectTask)
def update_project_task(task_id: int, task_update: schemas.ProjectTaskBase, db: Session = Depends(get_db)):
    try:
        db_task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id).first()
        if not db_task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        update_data = task_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_task, field, value)
        
        db.commit()
        db.refresh(db_task)
        return db_task
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")

@router.delete("/tasks/{task_id}", status_code=204)
def delete_project_task(task_id: int, db: Session = Depends(get_db)):
    try:
        db_task = db.query(models.ProjectTask).filter(models.ProjectTask.id == task_id).first()
        if not db_task:
            raise HTTPException(status_code=404, detail="Task not found")
        db.delete(db_task)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred")
