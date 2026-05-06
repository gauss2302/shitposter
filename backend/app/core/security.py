from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import Final

from passlib.context import CryptContext

SESSION_TOKEN_BYTES: Final[int] = 32

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    if password_hash.startswith("$2"):
        return password_context.verify(password, password_hash)
    # Better Auth hashes are intentionally not guessed here. Unknown hashes
    # should fail closed and be migrated with an explicit password reset flow.
    return False


def create_session_token() -> str:
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def new_session_token() -> str:
    """Backward-compatible alias for test/readability call sites."""
    return create_session_token()


def session_expiry(days: int) -> datetime:
    return datetime.now(UTC).replace(tzinfo=None) + timedelta(days=days)
