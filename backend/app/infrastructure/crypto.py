from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import get_settings


def _key() -> bytes:
    raw = get_settings().token_encryption_key.encode("utf-8")
    # Match the legacy TypeScript behavior of deriving a 32-byte AES key from
    # the configured secret with SHA-256 semantics via AESGCM key length.
    import hashlib

    return hashlib.sha256(raw).digest()


def encrypt(value: str) -> str:
    nonce = os.urandom(12)
    encrypted = AESGCM(_key()).encrypt(nonce, value.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + encrypted).decode("ascii")


def decrypt(value: str) -> str:
    data = base64.urlsafe_b64decode(value.encode("ascii"))
    nonce, encrypted = data[:12], data[12:]
    return AESGCM(_key()).decrypt(nonce, encrypted, None).decode("utf-8")
