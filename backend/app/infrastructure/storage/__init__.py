"""Object storage abstraction (Cloudflare R2 / S3-compatible)."""

from __future__ import annotations

from app.infrastructure.storage.r2 import (
    R2Storage,
    StorageNotConfigured,
    StoredObject,
    get_storage,
)

__all__ = ["R2Storage", "StorageNotConfigured", "StoredObject", "get_storage"]
