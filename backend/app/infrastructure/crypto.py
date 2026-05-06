from __future__ import annotations

import hashlib
import os

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from app.core.config import get_settings

IV_LENGTH = 16
AUTH_TAG_LENGTH = 16


def _key() -> bytes:
    # Match the legacy TypeScript implementation:
    # crypto.createHash("sha256").update(TOKEN_ENCRYPTION_KEY).digest()
    return hashlib.sha256(get_settings().token_encryption_key.encode("utf-8")).digest()


def encrypt(value: str) -> str:
    """Encrypt a token using the legacy hex `iv + authTag + ciphertext` format."""

    iv = os.urandom(IV_LENGTH)
    encryptor = Cipher(algorithms.AES(_key()), modes.GCM(iv)).encryptor()
    ciphertext = encryptor.update(value.encode("utf-8")) + encryptor.finalize()
    return iv.hex() + encryptor.tag.hex() + ciphertext.hex()


def decrypt(value: str) -> str:
    """Decrypt a token stored by either the old TypeScript or new Python backend."""

    raw = bytes.fromhex(value)
    iv = raw[:IV_LENGTH]
    tag = raw[IV_LENGTH : IV_LENGTH + AUTH_TAG_LENGTH]
    ciphertext = raw[IV_LENGTH + AUTH_TAG_LENGTH :]
    decryptor = Cipher(algorithms.AES(_key()), modes.GCM(iv, tag)).decryptor()
    return (decryptor.update(ciphertext) + decryptor.finalize()).decode("utf-8")
