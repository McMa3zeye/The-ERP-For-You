from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from typing import Optional
from datetime import datetime, timedelta, timezone
from database import get_db
import models
import schemas
import logging
import hashlib
import secrets
import json
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)
router = APIRouter()


# =========================================================
# Time helpers (avoid naive/aware datetime comparison errors)
# =========================================================
def utcnow() -> datetime:
    """Timezone-aware UTC 'now'."""
    return datetime.now(timezone.utc)


def ensure_aware_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Convert naive/aware datetime to aware UTC datetime (or None)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


# #region agent log
def _debug_log(location: str, message: str, data: dict, hypothesis_id: str = ""):
    import time

    log_path = r"c:\Users\Afrit\Desktop\Omar\Project Money\Project Wood\.cursor\debug.log"
    entry = {
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
        "sessionId": "debug-session",
        "hypothesisId": hypothesis_id,
    }
    try:
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        # Debug logging must never break production.
        pass


# #endregion


# Password hashing (using SHA-256 with salt - in production, use bcrypt)
def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    password_hash = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}${password_hash}", salt


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, hash_value = stored_hash.split("$", 1)
        new_hash = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
        return new_hash == hash_value
    except Exception:
        return False


def generate_session_token() -> str:
    return secrets.token_urlsafe(64)


def get_client_info(request: Request) -> dict:
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent", "")[:500],
    }


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _send_gmail_reset_email(to_email: str, reset_link: str):
    """Send reset email using Gmail SMTP.

    Requires env var: GMAIL_APP_PASSWORD
    Optional env var: GMAIL_USER
    """

    smtp_user = os.getenv("GMAIL_USER", "erpforyou.reset@gmail.com")
    smtp_pass = os.getenv("GMAIL_APP_PASSWORD", "")
    if not smtp_pass:
        raise RuntimeError("Missing GMAIL_APP_PASSWORD")

    msg = EmailMessage()
    msg["Subject"] = "Wood ERP - Reset your password"
    msg["From"] = smtp_user
    msg["To"] = to_email
    msg.set_content(
        "You requested a password reset.\n\n"
        f"Reset link: {reset_link}\n\n"
        "If you did not request this, you can ignore this email.\n"
    )

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)


@router.post("/forgot-password", response_model=schemas.ForgotPasswordResponse)
def forgot_password(payload: schemas.ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Request password reset by email.

    Always returns a generic success message to avoid user enumeration.
    """

    try:
        email = (payload.email or "").strip().lower()

        _debug_log(
            "auth.py:forgot_password:entry",
            "Forgot password requested",
            {"email_domain": email.split("@")[ -1] if "@" in email else ""},
            "FP1",
        )

        user = db.query(models.User).filter(models.User.email == email).first()
        generic = {"message": "If that email exists, a reset link has been sent."}

        if not user or not user.is_active:
            _debug_log(
                "auth.py:forgot_password:user",
                "User not found or inactive (generic response)",
                {"found": bool(user)},
                "FP1",
            )
            return generic

        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_token(raw_token)
        expires_at = utcnow() + timedelta(minutes=60)

        client_ip = request.client.host if request.client else None
        db.add(
            models.PasswordResetToken(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
                request_ip=client_ip,
            )
        )
        db.commit()

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        reset_link = f"{frontend_url.rstrip('/')}/reset-password?token={raw_token}"

        try:
            _send_gmail_reset_email(email, reset_link)
            _debug_log("auth.py:forgot_password:email", "Reset email sent", {"user_id": user.id}, "FP1")
        except Exception as e:
            # Still return generic response; log for debugging.
            _debug_log(
                "auth.py:forgot_password:email_error",
                "Reset email send failed",
                {"user_id": user.id, "error": str(e)[:180]},
                "FP1",
            )

        return generic

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error in forgot_password: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/reset-password", response_model=schemas.ResetPasswordResponse)
def reset_password(payload: schemas.ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    """Reset password using a token emailed to the user."""

    token = (payload.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Invalid token")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    try:
        token_hash = _hash_token(token)
        prt = (
            db.query(models.PasswordResetToken)
            .filter(models.PasswordResetToken.token_hash == token_hash)
            .first()
        )

        now_utc = utcnow()
        prt_expires = ensure_aware_utc(prt.expires_at) if prt else None
        prt_used_at = ensure_aware_utc(prt.used_at) if prt and prt.used_at else None

        if (not prt) or (prt_used_at is not None) or (prt_expires and prt_expires <= now_utc):
            _debug_log(
                "auth.py:reset_password:invalid",
                "Reset token invalid/used/expired",
                {"found": bool(prt)},
                "FP2",
            )
            raise HTTPException(status_code=400, detail="Token is invalid or expired")

        user = db.query(models.User).filter(models.User.id == prt.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=400, detail="User not found or disabled")

        user.password_hash, _ = hash_password(payload.new_password)
        user.must_change_password = False
        user.password_changed_at = now_utc
        prt.used_at = now_utc
        db.commit()

        _debug_log("auth.py:reset_password:success", "Password reset success", {"user_id": user.id}, "FP2")
        return {"message": "Password reset successfully"}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error in reset_password: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/login", response_model=schemas.LoginResponse)
def login(login_data: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate user and create session."""

    try:
        # Debug: log DB file only when SQLite
        db_file = None
        try:
            bind = db.get_bind()
            if getattr(bind.dialect, "name", "") == "sqlite":
                rows = db.execute(text("PRAGMA database_list")).fetchall()
                if rows:
                    db_file = rows[0][2]
        except Exception:
            db_file = None

        _debug_log(
            "auth.py:login:entry",
            "Login attempt",
            {"username": login_data.username, "db_file": db_file},
            "A,B,C,D",
        )

        # Find user by username or email
        user = (
            db.query(models.User)
            .options(joinedload(models.User.roles).joinedload(models.Role.permissions))
            .filter(
                (models.User.username == login_data.username)
                | (models.User.email == login_data.username)
            )
            .first()
        )

        if not user:
            _debug_log(
                "auth.py:login:user_lookup",
                "User not found",
                {"username": login_data.username},
                "A,C",
            )
            log_audit(
                db,
                None,
                "login",
                "auth",
                status="failed",
                error_message="User not found",
                request=request,
            )
            # Persist audit log for unauthenticated attempts
            try:
                db.commit()
            except Exception:
                db.rollback()
            raise HTTPException(status_code=401, detail="Invalid credentials")

        now_utc = utcnow()

        # Check if account is locked
        locked_until = ensure_aware_utc(user.locked_until)
        if locked_until and locked_until > now_utc:
            raise HTTPException(status_code=403, detail="Account is temporarily locked")

        # Check if account is active
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is disabled")

        # Verify password
        password_ok = verify_password(login_data.password, user.password_hash)

        _debug_log(
            "auth.py:login:password_check",
            "Password verification result",
            {
                "user_id": user.id,
                "is_active": user.is_active,
                "locked_until_set": bool(user.locked_until),
                "failed_login_attempts": int(user.failed_login_attempts or 0),
                "must_change_password": bool(user.must_change_password),
                "password_ok": bool(password_ok),
            },
            "B,D",
        )

        if not password_ok:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= 5:
                user.locked_until = now_utc + timedelta(minutes=15)

            log_audit(
                db,
                user.id,
                "login",
                "auth",
                status="failed",
                error_message="Invalid password",
                request=request,
            )
            db.commit()
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Reset failed attempts
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login = now_utc

        # Create session
        client_info = get_client_info(request)
        expires_at = now_utc + timedelta(days=7 if login_data.remember_me else 1)
        session_token = generate_session_token()

        session = models.UserSession(
            user_id=user.id,
            session_token=session_token,
            ip_address=client_info["ip_address"],
            user_agent=client_info["user_agent"],
            expires_at=expires_at,
        )
        db.add(session)

        log_audit(db, user.id, "login", "auth", status="success", request=request)
        db.commit()

        _debug_log(
            "auth.py:login:success",
            "Login success, session created",
            {"user_id": user.id, "expires_at": expires_at.isoformat()},
            "B",
        )

        return {
            "access_token": session_token,
            "token_type": "bearer",
            "expires_at": expires_at,
            "user": user,
        }

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during login: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    """Invalidate current session."""

    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            raise HTTPException(status_code=401, detail="No token provided")

        session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.session_token == token,
                models.UserSession.is_active == True,
            )
            .first()
        )

        if session:
            session.is_active = False
            log_audit(db, session.user_id, "logout", "auth", status="success", request=request)
            db.commit()

        return {"message": "Logged out successfully"}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during logout: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/logout-all")
def logout_all_sessions(request: Request, db: Session = Depends(get_db)):
    """Invalidate all sessions for current user."""

    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.session_token == token,
                models.UserSession.is_active == True,
            )
            .first()
        )

        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")

        db.query(models.UserSession).filter(models.UserSession.user_id == session.user_id).update(
            {"is_active": False}
        )

        log_audit(db, session.user_id, "logout_all", "auth", status="success", request=request)
        db.commit()

        return {"message": "All sessions invalidated"}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/me", response_model=schemas.AuthMeResponse)
def get_current_user(request: Request, db: Session = Depends(get_db)):
    """Get current authenticated user."""

    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")

        now_utc = utcnow()

        session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.session_token == token,
                models.UserSession.is_active == True,
                models.UserSession.expires_at > now_utc,
            )
            .first()
        )

        if not session:
            raise HTTPException(status_code=401, detail="Session expired or invalid")

        # Update last activity
        session.last_activity = now_utc
        db.commit()

        user = (
            db.query(models.User)
            .options(joinedload(models.User.roles).joinedload(models.Role.permissions))
            .filter(models.User.id == session.user_id)
            .first()
        )

        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or disabled")

        # Flatten permissions for the frontend
        permissions: list[str] = []
        try:
            if user.roles:
                perm_set = set()
                for r in user.roles:
                    if not r or not r.permissions:
                        continue
                    for p in r.permissions:
                        if p and p.code:
                            perm_set.add(p.code)
                permissions = sorted(list(perm_set))
        except Exception:
            permissions = []

        return {"user": user, "permissions": permissions}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/change-password")
def change_password(
    password_data: schemas.UserPasswordChange,
    request: Request,
    db: Session = Depends(get_db),
):
    """Change password for current user."""

    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.session_token == token,
                models.UserSession.is_active == True,
            )
            .first()
        )

        if not session:
            raise HTTPException(status_code=401, detail="Not authenticated")

        user = db.query(models.User).filter(models.User.id == session.user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        if not verify_password(password_data.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        if len(password_data.new_password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        now_utc = utcnow()
        user.password_hash, _ = hash_password(password_data.new_password)
        user.password_changed_at = now_utc
        user.must_change_password = False

        log_audit(db, user.id, "change_password", "auth", status="success", request=request)
        db.commit()

        return {"message": "Password changed successfully"}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/sessions", response_model=schemas.UserSessionList)
def get_my_sessions(request: Request, db: Session = Depends(get_db)):
    """Get all active sessions for current user."""

    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.session_token == token,
                models.UserSession.is_active == True,
            )
            .first()
        )

        if not session:
            raise HTTPException(status_code=401, detail="Not authenticated")

        now_utc = utcnow()
        sessions = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.user_id == session.user_id,
                models.UserSession.is_active == True,
                models.UserSession.expires_at > now_utc,
            )
            .order_by(models.UserSession.last_activity.desc())
            .all()
        )

        return {"items": sessions, "total": len(sessions)}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: int, request: Request, db: Session = Depends(get_db)):
    """Revoke a specific session."""

    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        current_session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.session_token == token,
                models.UserSession.is_active == True,
            )
            .first()
        )

        if not current_session:
            raise HTTPException(status_code=401, detail="Not authenticated")

        target_session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.id == session_id,
                models.UserSession.user_id == current_session.user_id,
            )
            .first()
        )

        if not target_session:
            raise HTTPException(status_code=404, detail="Session not found")

        target_session.is_active = False
        db.commit()

        return {"message": "Session revoked"}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")


@router.post("/verify")
def verify_token(request: Request, db: Session = Depends(get_db)):
    """Verify if current token is valid."""

    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return {"valid": False, "message": "No token provided"}

        now_utc = utcnow()
        session = (
            db.query(models.UserSession)
            .filter(
                models.UserSession.session_token == token,
                models.UserSession.is_active == True,
                models.UserSession.expires_at > now_utc,
            )
            .first()
        )

        if session:
            return {"valid": True, "expires_at": session.expires_at}
        return {"valid": False, "message": "Token expired or invalid"}

    except SQLAlchemyError as e:
        logger.error(f"Database error: {e}")
        return {"valid": False, "message": "Error verifying token"}


def log_audit(
    db: Session,
    user_id: Optional[int],
    action: str,
    module: str,
    entity_type: str = None,
    entity_id: int = None,
    old_values: dict = None,
    new_values: dict = None,
    status: str = "success",
    error_message: str = None,
    request: Request = None,
):
    """Helper function to create audit log entries."""

    try:
        client_info = get_client_info(request) if request else {}

        audit = models.AuditLog(
            user_id=user_id,
            action=action,
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=json.dumps(old_values) if old_values else None,
            new_values=json.dumps(new_values) if new_values else None,
            ip_address=client_info.get("ip_address"),
            user_agent=client_info.get("user_agent"),
            status=status,
            error_message=error_message,
        )
        db.add(audit)
        # Caller is responsible for commit.
    except Exception as e:
        logger.error(f"Error creating audit log: {e}")
