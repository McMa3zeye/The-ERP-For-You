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

def generate_employee_number(db: Session) -> str:
    last = db.query(models.Employee).order_by(models.Employee.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"EMP{next_num:06d}"

@router.get("/", response_model=schemas.EmployeeList)
@router.get("", response_model=schemas.EmployeeList)
def get_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Employee)
        if status:
            query = query.filter(models.Employee.status == status)
        if department:
            query = query.filter(models.Employee.department == department)
        if search:
            query = query.filter(
                (models.Employee.first_name.ilike(f"%{search}%")) |
                (models.Employee.last_name.ilike(f"%{search}%")) |
                (models.Employee.employee_number.ilike(f"%{search}%"))
            )
        total = query.count()
        employees = query.order_by(models.Employee.last_name).offset(skip).limit(limit).all()
        return {"items": employees, "total": total, "skip": skip, "limit": limit}
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@router.get("/{employee_id}", response_model=schemas.Employee)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee

@router.post("/", response_model=schemas.Employee, status_code=201)
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    try:
        db_employee = models.Employee(
            employee_number=generate_employee_number(db),
            **employee.model_dump()
        )
        db.add(db_employee)
        db.commit()
        db.refresh(db_employee)
        return db_employee
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating employee: {e}")
        raise HTTPException(status_code=500, detail="Error creating employee")

@router.put("/{employee_id}", response_model=schemas.Employee)
def update_employee(employee_id: int, employee: schemas.EmployeeUpdate, db: Session = Depends(get_db)):
    try:
        db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
        if not db_employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        for key, value in employee.model_dump(exclude_unset=True).items():
            setattr(db_employee, key, value)
        db.commit()
        db.refresh(db_employee)
        return db_employee
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating employee: {e}")
        raise HTTPException(status_code=500, detail="Error updating employee")

@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    try:
        db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
        if not db_employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        db.delete(db_employee)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting employee: {e}")
        raise HTTPException(status_code=500, detail="Error deleting employee")
