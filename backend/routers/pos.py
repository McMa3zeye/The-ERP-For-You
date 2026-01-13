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


def generate_session_number(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    last = db.query(models.POSSession).filter(
        models.POSSession.session_number.like(f"SES{today}%")
    ).order_by(models.POSSession.id.desc()).first()
    
    if last:
        seq = int(last.session_number[-4:]) + 1
    else:
        seq = 1
    return f"SES{today}{seq:04d}"


def generate_transaction_number(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    last = db.query(models.POSTransaction).filter(
        models.POSTransaction.transaction_number.like(f"TXN{today}%")
    ).order_by(models.POSTransaction.id.desc()).first()
    
    if last:
        seq = int(last.transaction_number[-4:]) + 1
    else:
        seq = 1
    return f"TXN{today}{seq:04d}"


# =====================================================
# TERMINALS ENDPOINTS
# =====================================================

@router.get("/terminals", response_model=schemas.POSTerminalList)
@router.get("/terminals/", response_model=schemas.POSTerminalList)
def get_terminals(db: Session = Depends(get_db)):
    try:
        terminals = db.query(models.POSTerminal).order_by(models.POSTerminal.name).all()
        return {"items": terminals, "total": len(terminals)}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/terminals", response_model=schemas.POSTerminal, status_code=201)
@router.post("/terminals/", response_model=schemas.POSTerminal, status_code=201)
def create_terminal(terminal: schemas.POSTerminalCreate, db: Session = Depends(get_db)):
    try:
        db_terminal = models.POSTerminal(**terminal.model_dump())
        db.add(db_terminal)
        db.commit()
        db.refresh(db_terminal)
        return db_terminal
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating terminal: {e}")
        raise HTTPException(status_code=500, detail="Error creating terminal")


# =====================================================
# SESSIONS ENDPOINTS
# =====================================================

@router.get("/sessions", response_model=schemas.POSSessionList)
@router.get("/sessions/", response_model=schemas.POSSessionList)
def get_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    terminal_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.POSSession)
        
        if status:
            query = query.filter(models.POSSession.status == status)
        if terminal_id:
            query = query.filter(models.POSSession.terminal_id == terminal_id)
        
        total = query.count()
        sessions = query.order_by(models.POSSession.opened_at.desc()).offset(skip).limit(limit).all()
        return {"items": sessions, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/sessions/active")
def get_active_session(terminal_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get the current active session"""
    try:
        query = db.query(models.POSSession).filter(models.POSSession.status == "open")
        if terminal_id:
            query = query.filter(models.POSSession.terminal_id == terminal_id)
        
        session = query.first()
        if not session:
            return {"active_session": None}
        return {"active_session": session}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/sessions/{session_id}", response_model=schemas.POSSession)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(models.POSSession).filter(models.POSSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions", response_model=schemas.POSSession, status_code=201)
@router.post("/sessions/", response_model=schemas.POSSession, status_code=201)
def open_session(session: schemas.POSSessionCreate, db: Session = Depends(get_db)):
    """Open a new POS session"""
    try:
        # Check for existing open session
        existing = db.query(models.POSSession).filter(
            models.POSSession.status == "open",
            models.POSSession.terminal_id == session.terminal_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="An open session already exists for this terminal")
        
        db_session = models.POSSession(
            session_number=generate_session_number(db),
            **session.model_dump()
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        return db_session
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error opening session: {e}")
        raise HTTPException(status_code=500, detail="Error opening session")


@router.post("/sessions/{session_id}/close")
def close_session(session_id: int, close_data: schemas.POSSessionClose, db: Session = Depends(get_db)):
    """Close a POS session"""
    try:
        session = db.query(models.POSSession).filter(models.POSSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if session.status != "open":
            raise HTTPException(status_code=400, detail="Session is not open")
        
        # Calculate expected balance
        expected = session.opening_balance + session.total_cash - session.total_returns
        
        session.closing_balance = close_data.closing_balance
        session.expected_balance = expected
        session.cash_difference = close_data.closing_balance - expected
        session.closed_at = datetime.utcnow()
        session.status = "closed"
        session.notes = close_data.notes
        
        db.commit()
        
        return {
            "message": "Session closed",
            "expected_balance": expected,
            "actual_balance": close_data.closing_balance,
            "difference": close_data.closing_balance - expected
        }
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error closing session: {e}")
        raise HTTPException(status_code=500, detail="Error closing session")


# =====================================================
# TRANSACTIONS ENDPOINTS
# =====================================================

@router.get("/transactions", response_model=schemas.POSTransactionList)
@router.get("/transactions/", response_model=schemas.POSTransactionList)
def get_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session_id: Optional[int] = None,
    transaction_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(models.POSTransaction).options(
            joinedload(models.POSTransaction.items)
        )
        
        if session_id:
            query = query.filter(models.POSTransaction.session_id == session_id)
        if transaction_type:
            query = query.filter(models.POSTransaction.transaction_type == transaction_type)
        if status:
            query = query.filter(models.POSTransaction.status == status)
        if start_date:
            query = query.filter(models.POSTransaction.created_at >= start_date)
        if end_date:
            query = query.filter(models.POSTransaction.created_at <= end_date)
        
        total = query.count()
        transactions = query.order_by(models.POSTransaction.created_at.desc()).offset(skip).limit(limit).all()
        return {"items": transactions, "total": total, "skip": skip, "limit": limit}
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/transactions/{transaction_id}", response_model=schemas.POSTransaction)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(models.POSTransaction).options(
        joinedload(models.POSTransaction.items)
    ).filter(models.POSTransaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@router.post("/transactions", response_model=schemas.POSTransaction, status_code=201)
@router.post("/transactions/", response_model=schemas.POSTransaction, status_code=201)
def create_transaction(transaction: schemas.POSTransactionCreate, db: Session = Depends(get_db)):
    """Create a new POS transaction (sale)"""
    try:
        # Verify session is open
        session = db.query(models.POSSession).filter(
            models.POSSession.id == transaction.session_id
        ).first()
        if not session or session.status != "open":
            raise HTTPException(status_code=400, detail="No open session found")
        
        # Calculate totals
        subtotal = 0.0
        tax_amount = 0.0
        
        for item in transaction.items:
            line_subtotal = item.quantity * item.unit_price * (1 - item.discount_percent / 100)
            item_tax = line_subtotal * (item.tax_percent / 100)
            subtotal += line_subtotal
            tax_amount += item_tax
        
        total = subtotal + tax_amount
        change_given = max(0, transaction.amount_tendered - total)
        
        db_transaction = models.POSTransaction(
            transaction_number=generate_transaction_number(db),
            session_id=transaction.session_id,
            customer_id=transaction.customer_id,
            customer_name=transaction.customer_name,
            transaction_type=transaction.transaction_type,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=total,
            amount_tendered=transaction.amount_tendered,
            change_given=change_given,
            payment_method=transaction.payment_method,
            status="completed",
            notes=transaction.notes
        )
        db.add(db_transaction)
        db.flush()
        
        # Create items
        for item in transaction.items:
            line_total = item.quantity * item.unit_price * (1 - item.discount_percent / 100)
            line_total += line_total * (item.tax_percent / 100)
            
            db_item = models.POSTransactionItem(
                transaction_id=db_transaction.id,
                product_id=item.product_id,
                product_name=item.product_name,
                sku=item.sku,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount_percent=item.discount_percent,
                tax_percent=item.tax_percent,
                line_total=line_total
            )
            db.add(db_item)
            
            # Update inventory if product exists
            if item.product_id:
                inventory = db.query(models.InventoryItem).filter(
                    models.InventoryItem.product_id == item.product_id
                ).first()
                if inventory:
                    inventory.quantity_on_hand -= item.quantity
        
        # Update session totals
        session.transaction_count += 1
        if transaction.transaction_type == "sale":
            session.total_sales += total
            if transaction.payment_method == "cash":
                session.total_cash += total
            else:
                session.total_card += total
        elif transaction.transaction_type == "return":
            session.total_returns += total
        
        db.commit()
        db.refresh(db_transaction)
        return db_transaction
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error creating transaction: {e}")
        raise HTTPException(status_code=500, detail="Error creating transaction")


@router.post("/transactions/{transaction_id}/void")
def void_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Void a transaction"""
    try:
        transaction = db.query(models.POSTransaction).filter(
            models.POSTransaction.id == transaction_id
        ).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        if transaction.status == "voided":
            raise HTTPException(status_code=400, detail="Transaction already voided")
        
        # Update session totals
        session = db.query(models.POSSession).filter(
            models.POSSession.id == transaction.session_id
        ).first()
        if session:
            session.total_sales -= transaction.total
            if transaction.payment_method == "cash":
                session.total_cash -= transaction.total
            else:
                session.total_card -= transaction.total
        
        transaction.status = "voided"
        db.commit()
        
        return {"message": "Transaction voided"}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error voiding transaction: {e}")
        raise HTTPException(status_code=500, detail="Error voiding transaction")


# =====================================================
# QUICK SALE ENDPOINT
# =====================================================

@router.post("/quick-sale")
def quick_sale(
    product_id: int,
    quantity: float = 1.0,
    payment_method: str = "cash",
    amount_tendered: float = 0.0,
    db: Session = Depends(get_db)
):
    """Quick sale for a single product"""
    try:
        # Get active session
        session = db.query(models.POSSession).filter(
            models.POSSession.status == "open"
        ).first()
        if not session:
            raise HTTPException(status_code=400, detail="No open session. Please open a session first.")
        
        # Get product
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Create transaction
        total = quantity * product.price
        tax = total * 0.08  # 8% sales tax
        grand_total = total + tax
        change = max(0, amount_tendered - grand_total) if payment_method == "cash" else 0
        
        transaction = models.POSTransaction(
            transaction_number=generate_transaction_number(db),
            session_id=session.id,
            transaction_type="sale",
            subtotal=total,
            tax_amount=tax,
            total=grand_total,
            amount_tendered=amount_tendered if payment_method == "cash" else grand_total,
            change_given=change,
            payment_method=payment_method,
            status="completed"
        )
        db.add(transaction)
        db.flush()
        
        # Create item
        item = models.POSTransactionItem(
            transaction_id=transaction.id,
            product_id=product.id,
            product_name=product.name,
            sku=product.sku,
            quantity=quantity,
            unit_price=product.price,
            tax_percent=8.0,
            line_total=grand_total
        )
        db.add(item)
        
        # Update session
        session.transaction_count += 1
        session.total_sales += grand_total
        if payment_method == "cash":
            session.total_cash += grand_total
        else:
            session.total_card += grand_total
        
        db.commit()
        
        return {
            "transaction_number": transaction.transaction_number,
            "product": product.name,
            "quantity": quantity,
            "total": grand_total,
            "change": change,
            "message": "Sale completed"
        }
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Error processing quick sale: {e}")
        raise HTTPException(status_code=500, detail="Error processing sale")


# =====================================================
# REPORTS ENDPOINTS
# =====================================================

@router.get("/reports/daily")
def get_daily_report(date: Optional[str] = None, db: Session = Depends(get_db)):
    """Get daily sales report"""
    try:
        target_date = date or datetime.utcnow().strftime("%Y-%m-%d")
        
        transactions = db.query(models.POSTransaction).filter(
            func.date(models.POSTransaction.created_at) == target_date,
            models.POSTransaction.status == "completed"
        ).all()
        
        total_sales = sum(t.total for t in transactions if t.transaction_type == "sale")
        total_returns = sum(t.total for t in transactions if t.transaction_type == "return")
        total_cash = sum(t.total for t in transactions if t.payment_method == "cash" and t.transaction_type == "sale")
        total_card = sum(t.total for t in transactions if t.payment_method != "cash" and t.transaction_type == "sale")
        
        return {
            "date": target_date,
            "transaction_count": len(transactions),
            "total_sales": total_sales,
            "total_returns": total_returns,
            "net_sales": total_sales - total_returns,
            "total_cash": total_cash,
            "total_card": total_card
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")
