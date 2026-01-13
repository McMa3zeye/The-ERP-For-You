from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
import models
import schemas
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def generate_payslip_number(db: Session) -> str:
    last = db.query(models.Payslip).order_by(models.Payslip.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"PAY{next_num:06d}"


# =====================================================
# PAYROLL PERIODS ENDPOINTS
# =====================================================

@router.get("/periods", response_model=schemas.PayrollPeriodList)
@router.get("/periods/", response_model=schemas.PayrollPeriodList)
def get_periods(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.PayrollPeriod)
        
        if status:
            query = query.filter(models.PayrollPeriod.status == status)
        
        total = query.count()
        periods = query.order_by(models.PayrollPeriod.start_date.desc()).offset(skip).limit(limit).all()
        return {"items": periods, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/periods/{period_id}", response_model=schemas.PayrollPeriod)
def get_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(models.PayrollPeriod).filter(models.PayrollPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Payroll period not found")
    return period


@router.post("/periods", response_model=schemas.PayrollPeriod, status_code=201)
@router.post("/periods/", response_model=schemas.PayrollPeriod, status_code=201)
def create_period(period: schemas.PayrollPeriodCreate, db: Session = Depends(get_db)):
    try:
        db_period = models.PayrollPeriod(**period.model_dump())
        db.add(db_period)
        db.commit()
        db.refresh(db_period)
        return db_period
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating payroll period: {e}")
        raise HTTPException(status_code=500, detail="Error creating payroll period")


@router.put("/periods/{period_id}", response_model=schemas.PayrollPeriod)
def update_period(period_id: int, period: schemas.PayrollPeriodUpdate, db: Session = Depends(get_db)):
    try:
        db_period = db.query(models.PayrollPeriod).filter(models.PayrollPeriod.id == period_id).first()
        if not db_period:
            raise HTTPException(status_code=404, detail="Payroll period not found")
        if db_period.status == "closed":
            raise HTTPException(status_code=400, detail="Cannot modify closed period")
        
        for key, value in period.model_dump(exclude_unset=True).items():
            setattr(db_period, key, value)
        
        db.commit()
        db.refresh(db_period)
        return db_period
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating payroll period: {e}")
        raise HTTPException(status_code=500, detail="Error updating payroll period")


@router.post("/periods/{period_id}/process")
def process_period(period_id: int, db: Session = Depends(get_db)):
    """Process payroll for a period - generate payslips for all active employees"""
    try:
        period = db.query(models.PayrollPeriod).filter(models.PayrollPeriod.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Payroll period not found")
        if period.status not in ["open", "processing"]:
            raise HTTPException(status_code=400, detail="Period is not open for processing")
        
        period.status = "processing"
        
        # Get all active employees
        employees = db.query(models.Employee).filter(models.Employee.status == "Active").all()
        
        payslips_created = 0
        total_gross = 0.0
        total_deductions = 0.0
        total_net = 0.0
        
        for employee in employees:
            # Check if payslip already exists
            existing = db.query(models.Payslip).filter(
                models.Payslip.period_id == period_id,
                models.Payslip.employee_id == employee.id
            ).first()
            
            if existing:
                continue
            
            # Get time entries for the period
            time_entries = db.query(models.TimeEntry).filter(
                models.TimeEntry.employee_name == f"{employee.first_name} {employee.last_name}",
                models.TimeEntry.date >= period.start_date,
                models.TimeEntry.date <= period.end_date
            ).all()
            
            regular_hours = 0.0
            overtime_hours = 0.0
            
            for entry in time_entries:
                hours = entry.hours_worked or 0
                if hours > 8:
                    regular_hours += 8
                    overtime_hours += hours - 8
                else:
                    regular_hours += hours
            
            hourly_rate = employee.salary / 2080 if employee.salary else 0  # Assuming annual salary / work hours
            regular_pay = regular_hours * hourly_rate
            overtime_pay = overtime_hours * hourly_rate * 1.5
            gross_pay = regular_pay + overtime_pay
            
            # Calculate deductions (simplified)
            tax_rate = 0.22  # 22% federal tax estimate
            tax_deduction = gross_pay * tax_rate
            insurance_deduction = 200 if gross_pay > 500 else 0  # Simplified
            retirement_deduction = gross_pay * 0.06  # 6% 401k
            
            total_deductions_emp = tax_deduction + insurance_deduction + retirement_deduction
            net_pay = gross_pay - total_deductions_emp
            
            payslip = models.Payslip(
                payslip_number=generate_payslip_number(db),
                period_id=period_id,
                employee_id=employee.id,
                regular_hours=regular_hours,
                overtime_hours=overtime_hours,
                hourly_rate=hourly_rate,
                regular_pay=regular_pay,
                overtime_pay=overtime_pay,
                gross_pay=gross_pay,
                tax_deduction=tax_deduction,
                insurance_deduction=insurance_deduction,
                retirement_deduction=retirement_deduction,
                total_deductions=total_deductions_emp,
                net_pay=net_pay
            )
            db.add(payslip)
            db.flush()
            
            # Add payslip lines for detail
            lines = [
                {"line_type": "earning", "code": "REG", "description": "Regular Pay", 
                 "hours": regular_hours, "rate": hourly_rate, "amount": regular_pay},
                {"line_type": "earning", "code": "OT", "description": "Overtime Pay", 
                 "hours": overtime_hours, "rate": hourly_rate * 1.5, "amount": overtime_pay},
                {"line_type": "tax", "code": "FED", "description": "Federal Tax", 
                 "amount": -tax_deduction, "is_taxable": False},
                {"line_type": "deduction", "code": "INS", "description": "Health Insurance", 
                 "amount": -insurance_deduction, "is_taxable": False},
                {"line_type": "deduction", "code": "401K", "description": "401(k) Contribution", 
                 "amount": -retirement_deduction, "is_taxable": False},
            ]
            
            for line_data in lines:
                if line_data.get("amount", 0) != 0:
                    line = models.PayslipLine(payslip_id=payslip.id, **line_data)
                    db.add(line)
            
            payslips_created += 1
            total_gross += gross_pay
            total_deductions += total_deductions_emp
            total_net += net_pay
        
        # Update period totals
        period.total_gross = total_gross
        period.total_deductions = total_deductions
        period.total_net = total_net
        period.processed_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "message": f"Processed {payslips_created} payslips",
            "payslips_created": payslips_created,
            "total_gross": total_gross,
            "total_deductions": total_deductions,
            "total_net": total_net
        }
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error processing payroll: {e}")
        raise HTTPException(status_code=500, detail="Error processing payroll")


@router.post("/periods/{period_id}/close")
def close_period(period_id: int, db: Session = Depends(get_db)):
    """Close a payroll period"""
    try:
        period = db.query(models.PayrollPeriod).filter(models.PayrollPeriod.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Payroll period not found")
        
        # Mark all payslips as approved
        db.query(models.Payslip).filter(
            models.Payslip.period_id == period_id,
            models.Payslip.status == "draft"
        ).update({"status": "approved"})
        
        period.status = "closed"
        db.commit()
        
        return {"message": "Payroll period closed"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error closing period: {e}")
        raise HTTPException(status_code=500, detail="Error closing period")


@router.delete("/periods/{period_id}", status_code=204)
def delete_period(period_id: int, db: Session = Depends(get_db)):
    try:
        period = db.query(models.PayrollPeriod).filter(models.PayrollPeriod.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Payroll period not found")
        if period.status == "closed":
            raise HTTPException(status_code=400, detail="Cannot delete closed period")
        
        db.delete(period)
        db.commit()
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting period: {e}")
        raise HTTPException(status_code=500, detail="Error deleting period")


# =====================================================
# PAYSLIPS ENDPOINTS
# =====================================================

@router.get("/payslips", response_model=schemas.PayslipList)
@router.get("/payslips/", response_model=schemas.PayslipList)
def get_payslips(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    period_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.Payslip).options(joinedload(models.Payslip.lines))
        
        if period_id:
            query = query.filter(models.Payslip.period_id == period_id)
        if employee_id:
            query = query.filter(models.Payslip.employee_id == employee_id)
        if status:
            query = query.filter(models.Payslip.status == status)
        
        total = query.count()
        payslips = query.order_by(models.Payslip.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": payslips, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/payslips/{payslip_id}", response_model=schemas.Payslip)
def get_payslip(payslip_id: int, db: Session = Depends(get_db)):
    payslip = db.query(models.Payslip).options(
        joinedload(models.Payslip.lines),
        joinedload(models.Payslip.employee)
    ).filter(models.Payslip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    return payslip


@router.post("/payslips", response_model=schemas.Payslip, status_code=201)
@router.post("/payslips/", response_model=schemas.Payslip, status_code=201)
def create_payslip(payslip: schemas.PayslipCreate, db: Session = Depends(get_db)):
    try:
        # Get employee to get hourly rate
        employee = db.query(models.Employee).filter(models.Employee.id == payslip.employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        hourly_rate = employee.salary / 2080 if employee.salary else 0
        regular_pay = payslip.regular_hours * hourly_rate
        overtime_pay = payslip.overtime_hours * hourly_rate * 1.5
        gross_pay = regular_pay + overtime_pay + payslip.bonus + payslip.commission
        
        # Calculate deductions
        tax_deduction = gross_pay * 0.22
        total_deductions = tax_deduction
        net_pay = gross_pay - total_deductions
        
        db_payslip = models.Payslip(
            payslip_number=generate_payslip_number(db),
            period_id=payslip.period_id,
            employee_id=payslip.employee_id,
            regular_hours=payslip.regular_hours,
            overtime_hours=payslip.overtime_hours,
            hourly_rate=hourly_rate,
            regular_pay=regular_pay,
            overtime_pay=overtime_pay,
            bonus=payslip.bonus,
            commission=payslip.commission,
            gross_pay=gross_pay,
            tax_deduction=tax_deduction,
            total_deductions=total_deductions,
            net_pay=net_pay,
            notes=payslip.notes
        )
        db.add(db_payslip)
        db.commit()
        db.refresh(db_payslip)
        return db_payslip
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating payslip: {e}")
        raise HTTPException(status_code=500, detail="Error creating payslip")


@router.put("/payslips/{payslip_id}", response_model=schemas.Payslip)
def update_payslip(payslip_id: int, payslip: schemas.PayslipUpdate, db: Session = Depends(get_db)):
    try:
        db_payslip = db.query(models.Payslip).filter(models.Payslip.id == payslip_id).first()
        if not db_payslip:
            raise HTTPException(status_code=404, detail="Payslip not found")
        if db_payslip.status in ["approved", "paid"]:
            raise HTTPException(status_code=400, detail="Cannot modify approved/paid payslip")
        
        for key, value in payslip.model_dump(exclude_unset=True).items():
            setattr(db_payslip, key, value)
        
        # Recalculate totals if hours changed
        if payslip.regular_hours is not None or payslip.overtime_hours is not None:
            db_payslip.regular_pay = db_payslip.regular_hours * db_payslip.hourly_rate
            db_payslip.overtime_pay = db_payslip.overtime_hours * db_payslip.hourly_rate * 1.5
            db_payslip.gross_pay = db_payslip.regular_pay + db_payslip.overtime_pay + db_payslip.bonus + db_payslip.commission
            db_payslip.tax_deduction = db_payslip.gross_pay * 0.22
            db_payslip.total_deductions = db_payslip.tax_deduction + db_payslip.insurance_deduction + db_payslip.retirement_deduction + db_payslip.other_deductions
            db_payslip.net_pay = db_payslip.gross_pay - db_payslip.total_deductions
        
        db.commit()
        db.refresh(db_payslip)
        return db_payslip
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating payslip: {e}")
        raise HTTPException(status_code=500, detail="Error updating payslip")


@router.post("/payslips/{payslip_id}/approve")
def approve_payslip(payslip_id: int, db: Session = Depends(get_db)):
    """Approve a payslip"""
    try:
        payslip = db.query(models.Payslip).filter(models.Payslip.id == payslip_id).first()
        if not payslip:
            raise HTTPException(status_code=404, detail="Payslip not found")
        
        payslip.status = "approved"
        db.commit()
        
        return {"message": "Payslip approved"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error approving payslip: {e}")
        raise HTTPException(status_code=500, detail="Error approving payslip")


@router.post("/payslips/{payslip_id}/pay")
def mark_payslip_paid(
    payslip_id: int,
    payment_method: str = "direct_deposit",
    payment_reference: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Mark payslip as paid"""
    try:
        payslip = db.query(models.Payslip).filter(models.Payslip.id == payslip_id).first()
        if not payslip:
            raise HTTPException(status_code=404, detail="Payslip not found")
        if payslip.status != "approved":
            raise HTTPException(status_code=400, detail="Payslip must be approved first")
        
        payslip.status = "paid"
        payslip.payment_method = payment_method
        payslip.payment_reference = payment_reference
        db.commit()
        
        return {"message": "Payslip marked as paid"}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error marking payslip paid: {e}")
        raise HTTPException(status_code=500, detail="Error marking payslip paid")


@router.delete("/payslips/{payslip_id}", status_code=204)
def delete_payslip(payslip_id: int, db: Session = Depends(get_db)):
    try:
        payslip = db.query(models.Payslip).filter(models.Payslip.id == payslip_id).first()
        if not payslip:
            raise HTTPException(status_code=404, detail="Payslip not found")
        if payslip.status in ["approved", "paid"]:
            raise HTTPException(status_code=400, detail="Cannot delete approved/paid payslip")
        
        db.delete(payslip)
        db.commit()
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting payslip: {e}")
        raise HTTPException(status_code=500, detail="Error deleting payslip")


# =====================================================
# REPORTS ENDPOINTS
# =====================================================

@router.get("/reports/summary")
def get_payroll_summary(
    period_id: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get payroll summary report"""
    try:
        query = db.query(
            func.count(models.Payslip.id).label("payslip_count"),
            func.sum(models.Payslip.gross_pay).label("total_gross"),
            func.sum(models.Payslip.total_deductions).label("total_deductions"),
            func.sum(models.Payslip.net_pay).label("total_net")
        )
        
        if period_id:
            query = query.filter(models.Payslip.period_id == period_id)
        if year:
            query = query.join(models.PayrollPeriod).filter(
                func.extract('year', models.PayrollPeriod.start_date) == year
            )
        
        result = query.first()
        
        return {
            "payslip_count": result[0] or 0,
            "total_gross": float(result[1] or 0),
            "total_deductions": float(result[2] or 0),
            "total_net": float(result[3] or 0)
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")
