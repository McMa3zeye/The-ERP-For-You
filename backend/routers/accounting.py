from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func
from typing import Optional
from datetime import datetime
from database import get_db
import models
import schemas
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def generate_entry_number(db: Session) -> str:
    last = db.query(models.JournalEntry).order_by(models.JournalEntry.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"JE{next_num:06d}"


# =====================================================
# CHART OF ACCOUNTS ENDPOINTS
# =====================================================

@router.get("/accounts", response_model=schemas.ChartOfAccountList)
@router.get("/accounts/", response_model=schemas.ChartOfAccountList)
def get_accounts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    account_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.ChartOfAccount)
        
        if account_type:
            query = query.filter(models.ChartOfAccount.account_type == account_type)
        if is_active is not None:
            query = query.filter(models.ChartOfAccount.is_active == is_active)
        if search:
            query = query.filter(
                (models.ChartOfAccount.name.ilike(f"%{search}%")) |
                (models.ChartOfAccount.account_number.ilike(f"%{search}%"))
            )
        
        total = query.count()
        accounts = query.order_by(models.ChartOfAccount.account_number).offset(skip).limit(limit).all()
        return {"items": accounts, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/accounts/{account_id}", response_model=schemas.ChartOfAccount)
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(models.ChartOfAccount).filter(models.ChartOfAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.post("/accounts", response_model=schemas.ChartOfAccount, status_code=201)
@router.post("/accounts/", response_model=schemas.ChartOfAccount, status_code=201)
def create_account(account: schemas.ChartOfAccountCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(models.ChartOfAccount).filter(
            models.ChartOfAccount.account_number == account.account_number
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Account number already exists")
        
        db_account = models.ChartOfAccount(**account.model_dump())
        db.add(db_account)
        db.commit()
        db.refresh(db_account)
        return db_account
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating account: {e}")
        raise HTTPException(status_code=500, detail="Error creating account")


@router.put("/accounts/{account_id}", response_model=schemas.ChartOfAccount)
def update_account(account_id: int, account: schemas.ChartOfAccountUpdate, db: Session = Depends(get_db)):
    try:
        db_account = db.query(models.ChartOfAccount).filter(models.ChartOfAccount.id == account_id).first()
        if not db_account:
            raise HTTPException(status_code=404, detail="Account not found")
        if db_account.is_system:
            raise HTTPException(status_code=400, detail="Cannot modify system account")
        
        for key, value in account.model_dump(exclude_unset=True).items():
            setattr(db_account, key, value)
        
        db.commit()
        db.refresh(db_account)
        return db_account
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error updating account: {e}")
        raise HTTPException(status_code=500, detail="Error updating account")


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    try:
        db_account = db.query(models.ChartOfAccount).filter(models.ChartOfAccount.id == account_id).first()
        if not db_account:
            raise HTTPException(status_code=404, detail="Account not found")
        if db_account.is_system:
            raise HTTPException(status_code=400, detail="Cannot delete system account")
        if db_account.current_balance != 0:
            raise HTTPException(status_code=400, detail="Cannot delete account with non-zero balance")
        
        db.delete(db_account)
        db.commit()
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting account: {e}")
        raise HTTPException(status_code=500, detail="Error deleting account")


# =====================================================
# JOURNAL ENTRIES ENDPOINTS
# =====================================================

@router.get("/journal-entries", response_model=schemas.JournalEntryList)
@router.get("/journal-entries/", response_model=schemas.JournalEntryList)
def get_journal_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    entry_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.JournalEntry).options(
            joinedload(models.JournalEntry.lines).joinedload(models.JournalEntryLine.account)
        )
        
        if status:
            query = query.filter(models.JournalEntry.status == status)
        if entry_type:
            query = query.filter(models.JournalEntry.entry_type == entry_type)
        if start_date:
            query = query.filter(models.JournalEntry.entry_date >= start_date)
        if end_date:
            query = query.filter(models.JournalEntry.entry_date <= end_date)
        if search:
            query = query.filter(
                (models.JournalEntry.entry_number.ilike(f"%{search}%")) |
                (models.JournalEntry.description.ilike(f"%{search}%")) |
                (models.JournalEntry.reference.ilike(f"%{search}%"))
            )
        
        total = query.count()
        entries = query.order_by(models.JournalEntry.entry_date.desc()).offset(skip).limit(limit).all()
        return {"items": entries, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/journal-entries/{entry_id}", response_model=schemas.JournalEntry)
def get_journal_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(models.JournalEntry).options(
        joinedload(models.JournalEntry.lines).joinedload(models.JournalEntryLine.account)
    ).filter(models.JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.post("/journal-entries", response_model=schemas.JournalEntry, status_code=201)
@router.post("/journal-entries/", response_model=schemas.JournalEntry, status_code=201)
def create_journal_entry(entry: schemas.JournalEntryCreate, db: Session = Depends(get_db)):
    try:
        # Validate that debits equal credits
        total_debit = sum(line.debit for line in entry.lines)
        total_credit = sum(line.credit for line in entry.lines)
        
        if abs(total_debit - total_credit) > 0.01:
            raise HTTPException(status_code=400, detail="Debits must equal credits")
        
        if len(entry.lines) < 2:
            raise HTTPException(status_code=400, detail="Journal entry must have at least 2 lines")
        
        # Verify all accounts exist
        for line in entry.lines:
            account = db.query(models.ChartOfAccount).filter(
                models.ChartOfAccount.id == line.account_id
            ).first()
            if not account:
                raise HTTPException(status_code=400, detail=f"Account {line.account_id} not found")
        
        db_entry = models.JournalEntry(
            entry_number=generate_entry_number(db),
            entry_date=entry.entry_date,
            description=entry.description,
            reference=entry.reference,
            entry_type=entry.entry_type,
            notes=entry.notes,
            total_debit=total_debit,
            total_credit=total_credit
        )
        db.add(db_entry)
        db.flush()
        
        # Create lines
        for line in entry.lines:
            db_line = models.JournalEntryLine(
                journal_entry_id=db_entry.id,
                **line.model_dump()
            )
            db.add(db_line)
        
        db.commit()
        db.refresh(db_entry)
        return db_entry
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating journal entry: {e}")
        raise HTTPException(status_code=500, detail="Error creating journal entry")


@router.post("/journal-entries/{entry_id}/post")
def post_journal_entry(entry_id: int, db: Session = Depends(get_db)):
    """Post a journal entry and update account balances"""
    try:
        entry = db.query(models.JournalEntry).options(
            joinedload(models.JournalEntry.lines)
        ).filter(models.JournalEntry.id == entry_id).first()
        
        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")
        if entry.status == "posted":
            raise HTTPException(status_code=400, detail="Entry already posted")
        if entry.status == "reversed":
            raise HTTPException(status_code=400, detail="Cannot post reversed entry")
        
        # Update account balances
        for line in entry.lines:
            account = db.query(models.ChartOfAccount).filter(
                models.ChartOfAccount.id == line.account_id
            ).first()
            
            if account.normal_balance == "debit":
                account.current_balance += line.debit - line.credit
            else:
                account.current_balance += line.credit - line.debit
        
        entry.status = "posted"
        entry.posted_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Journal entry posted successfully"}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error posting journal entry: {e}")
        raise HTTPException(status_code=500, detail="Error posting journal entry")


@router.post("/journal-entries/{entry_id}/reverse")
def reverse_journal_entry(entry_id: int, db: Session = Depends(get_db)):
    """Reverse a posted journal entry"""
    try:
        entry = db.query(models.JournalEntry).options(
            joinedload(models.JournalEntry.lines)
        ).filter(models.JournalEntry.id == entry_id).first()
        
        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")
        if entry.status != "posted":
            raise HTTPException(status_code=400, detail="Can only reverse posted entries")
        
        # Reverse account balances
        for line in entry.lines:
            account = db.query(models.ChartOfAccount).filter(
                models.ChartOfAccount.id == line.account_id
            ).first()
            
            if account.normal_balance == "debit":
                account.current_balance -= line.debit - line.credit
            else:
                account.current_balance -= line.credit - line.debit
        
        entry.status = "reversed"
        entry.reversed_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Journal entry reversed successfully"}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error reversing journal entry: {e}")
        raise HTTPException(status_code=500, detail="Error reversing journal entry")


@router.delete("/journal-entries/{entry_id}", status_code=204)
def delete_journal_entry(entry_id: int, db: Session = Depends(get_db)):
    try:
        entry = db.query(models.JournalEntry).filter(models.JournalEntry.id == entry_id).first()
        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")
        if entry.status == "posted":
            raise HTTPException(status_code=400, detail="Cannot delete posted entry. Reverse it first.")
        
        db.delete(entry)
        db.commit()
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error deleting journal entry: {e}")
        raise HTTPException(status_code=500, detail="Error deleting journal entry")


# =====================================================
# FISCAL PERIODS ENDPOINTS
# =====================================================

@router.get("/fiscal-periods", response_model=schemas.FiscalPeriodList)
@router.get("/fiscal-periods/", response_model=schemas.FiscalPeriodList)
def get_fiscal_periods(db: Session = Depends(get_db)):
    try:
        periods = db.query(models.FiscalPeriod).order_by(models.FiscalPeriod.start_date.desc()).all()
        return {"items": periods, "total": len(periods)}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/fiscal-periods", response_model=schemas.FiscalPeriod, status_code=201)
@router.post("/fiscal-periods/", response_model=schemas.FiscalPeriod, status_code=201)
def create_fiscal_period(period: schemas.FiscalPeriodCreate, db: Session = Depends(get_db)):
    try:
        db_period = models.FiscalPeriod(**period.model_dump())
        db.add(db_period)
        db.commit()
        db.refresh(db_period)
        return db_period
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating fiscal period: {e}")
        raise HTTPException(status_code=500, detail="Error creating fiscal period")


@router.post("/fiscal-periods/{period_id}/close")
def close_fiscal_period(period_id: int, db: Session = Depends(get_db)):
    try:
        period = db.query(models.FiscalPeriod).filter(models.FiscalPeriod.id == period_id).first()
        if not period:
            raise HTTPException(status_code=404, detail="Fiscal period not found")
        if period.is_closed:
            raise HTTPException(status_code=400, detail="Period already closed")
        
        period.is_closed = True
        period.closed_at = datetime.utcnow()
        db.commit()
        
        return {"message": "Fiscal period closed successfully"}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error closing fiscal period: {e}")
        raise HTTPException(status_code=500, detail="Error closing fiscal period")


# =====================================================
# REPORTS ENDPOINTS
# =====================================================

@router.get("/trial-balance")
def get_trial_balance(as_of_date: Optional[str] = None, db: Session = Depends(get_db)):
    """Get trial balance report"""
    try:
        accounts = db.query(models.ChartOfAccount).filter(
            models.ChartOfAccount.is_active == True
        ).order_by(models.ChartOfAccount.account_number).all()
        
        total_debit = 0.0
        total_credit = 0.0
        data = []
        
        for account in accounts:
            if account.current_balance != 0:
                if account.normal_balance == "debit":
                    debit = account.current_balance if account.current_balance > 0 else 0
                    credit = abs(account.current_balance) if account.current_balance < 0 else 0
                else:
                    credit = account.current_balance if account.current_balance > 0 else 0
                    debit = abs(account.current_balance) if account.current_balance < 0 else 0
                
                total_debit += debit
                total_credit += credit
                
                data.append({
                    "account_number": account.account_number,
                    "account_name": account.name,
                    "account_type": account.account_type,
                    "debit": debit,
                    "credit": credit
                })
        
        return {
            "as_of_date": as_of_date or datetime.utcnow().isoformat(),
            "accounts": data,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "is_balanced": abs(total_debit - total_credit) < 0.01
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/balance-sheet")
def get_balance_sheet(db: Session = Depends(get_db)):
    """Get balance sheet report"""
    try:
        accounts = db.query(models.ChartOfAccount).filter(
            models.ChartOfAccount.is_active == True,
            models.ChartOfAccount.account_type.in_(["asset", "liability", "equity"])
        ).order_by(models.ChartOfAccount.account_type, models.ChartOfAccount.account_number).all()
        
        assets = []
        liabilities = []
        equity = []
        total_assets = 0.0
        total_liabilities = 0.0
        total_equity = 0.0
        
        for account in accounts:
            item = {
                "account_number": account.account_number,
                "account_name": account.name,
                "balance": abs(account.current_balance)
            }
            
            if account.account_type == "asset":
                assets.append(item)
                total_assets += account.current_balance
            elif account.account_type == "liability":
                liabilities.append(item)
                total_liabilities += account.current_balance
            else:
                equity.append(item)
                total_equity += account.current_balance
        
        return {
            "as_of_date": datetime.utcnow().isoformat(),
            "assets": assets,
            "total_assets": total_assets,
            "liabilities": liabilities,
            "total_liabilities": total_liabilities,
            "equity": equity,
            "total_equity": total_equity,
            "total_liabilities_equity": total_liabilities + total_equity
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/init-accounts")
def initialize_default_accounts(db: Session = Depends(get_db)):
    """Initialize default chart of accounts"""
    try:
        default_accounts = [
            # Assets
            {"account_number": "1000", "name": "Cash", "account_type": "asset", "normal_balance": "debit", "is_system": True},
            {"account_number": "1100", "name": "Accounts Receivable", "account_type": "asset", "normal_balance": "debit", "is_system": True},
            {"account_number": "1200", "name": "Inventory - Raw Materials", "account_type": "asset", "normal_balance": "debit", "is_system": True},
            {"account_number": "1210", "name": "Inventory - Finished Goods", "account_type": "asset", "normal_balance": "debit", "is_system": True},
            {"account_number": "1300", "name": "Prepaid Expenses", "account_type": "asset", "normal_balance": "debit"},
            {"account_number": "1500", "name": "Fixed Assets - Equipment", "account_type": "asset", "normal_balance": "debit"},
            {"account_number": "1510", "name": "Accumulated Depreciation", "account_type": "asset", "normal_balance": "credit"},
            # Liabilities
            {"account_number": "2000", "name": "Accounts Payable", "account_type": "liability", "normal_balance": "credit", "is_system": True},
            {"account_number": "2100", "name": "Accrued Expenses", "account_type": "liability", "normal_balance": "credit"},
            {"account_number": "2200", "name": "Payroll Liabilities", "account_type": "liability", "normal_balance": "credit"},
            {"account_number": "2300", "name": "Sales Tax Payable", "account_type": "liability", "normal_balance": "credit"},
            {"account_number": "2500", "name": "Notes Payable", "account_type": "liability", "normal_balance": "credit"},
            # Equity
            {"account_number": "3000", "name": "Owner's Equity", "account_type": "equity", "normal_balance": "credit", "is_system": True},
            {"account_number": "3100", "name": "Retained Earnings", "account_type": "equity", "normal_balance": "credit", "is_system": True},
            # Revenue
            {"account_number": "4000", "name": "Sales Revenue", "account_type": "revenue", "normal_balance": "credit", "is_system": True},
            {"account_number": "4100", "name": "Service Revenue", "account_type": "revenue", "normal_balance": "credit"},
            {"account_number": "4900", "name": "Other Income", "account_type": "revenue", "normal_balance": "credit"},
            # Expenses
            {"account_number": "5000", "name": "Cost of Goods Sold", "account_type": "expense", "normal_balance": "debit", "is_system": True},
            {"account_number": "5100", "name": "Raw Materials Expense", "account_type": "expense", "normal_balance": "debit"},
            {"account_number": "5200", "name": "Direct Labor", "account_type": "expense", "normal_balance": "debit"},
            {"account_number": "6000", "name": "Wages & Salaries", "account_type": "expense", "normal_balance": "debit"},
            {"account_number": "6100", "name": "Rent Expense", "account_type": "expense", "normal_balance": "debit"},
            {"account_number": "6200", "name": "Utilities Expense", "account_type": "expense", "normal_balance": "debit"},
            {"account_number": "6300", "name": "Insurance Expense", "account_type": "expense", "normal_balance": "debit"},
            {"account_number": "6400", "name": "Depreciation Expense", "account_type": "expense", "normal_balance": "debit"},
            {"account_number": "6500", "name": "Office Supplies Expense", "account_type": "expense", "normal_balance": "debit"},
            {"account_number": "6900", "name": "Miscellaneous Expense", "account_type": "expense", "normal_balance": "debit"},
        ]
        
        created = 0
        for acc in default_accounts:
            existing = db.query(models.ChartOfAccount).filter(
                models.ChartOfAccount.account_number == acc["account_number"]
            ).first()
            if not existing:
                account = models.ChartOfAccount(**acc)
                db.add(account)
                created += 1
        
        db.commit()
        return {"message": f"Initialized {created} accounts"}
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error initializing accounts: {e}")
        raise HTTPException(status_code=500, detail="Error initializing accounts")
