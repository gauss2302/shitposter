from __future__ import annotations

import hashlib
import hmac
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


API_KEY_PREFIX_BYTES: Final[int] = 6
API_KEY_SECRET_BYTES: Final[int] = 32
API_KEY_PREFIX: Final[str] = "sp_live"


def create_api_key() -> tuple[str, str]:
    """Create a raw agent API key and return `(raw_key, lookup_prefix)`.

    The lookup prefix is intentionally non-secret and is stored separately so
    verification can avoid scanning every key. The raw key must be shown only
    once to the user and never stored in plaintext.
    """

    lookup_prefix = secrets.token_hex(API_KEY_PREFIX_BYTES)
    secret = secrets.token_hex(API_KEY_SECRET_BYTES)
    return f"{API_KEY_PREFIX}_{lookup_prefix}_{secret}", lookup_prefix


def api_key_lookup_prefix(raw_key: str) -> str | None:
    parts = raw_key.split("_", 3)
    if len(parts) != 4 or f"{parts[0]}_{parts[1]}" != API_KEY_PREFIX:
        return None
    return parts[2] or None


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def verify_api_key(raw_key: str, key_hash: str) -> bool:
    return hmac.compare_digest(hash_api_key(raw_key), key_hash)
