from __future__ import annotations

import hashlib
from passlib.context import CryptContext

# Single source of truth for password hashing across the whole backend.
# - New passwords: bcrypt
# - Legacy support: salted sha256 stored as "salt$hash" (temporary migration)

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def is_bcrypt_hash(stored_hash: str | None) -> bool:
    return bool(stored_hash) and stored_hash.startswith("$2")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash:
        return False

    # Legacy salted sha256 format: "salt$<hex>"
    if not is_bcrypt_hash(stored_hash):
        try:
            salt, hash_value = stored_hash.split("$", 1)
            new_hash = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
            return new_hash == hash_value
        except Exception:
            return False

    # bcrypt
    try:
        return _pwd_context.verify(password, stored_hash)
    except Exception:
        return False


def should_rehash_to_bcrypt(stored_hash: str | None) -> bool:
    # If legacy format, upgrade on next successful login.
    return bool(stored_hash) and not is_bcrypt_hash(stored_hash)
