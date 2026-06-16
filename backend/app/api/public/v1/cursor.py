"""Opaque base64url cursor encoding for ``GET /posts`` pagination.

Encodes ``(created_at, id)`` as a single string the client can echo back
without depending on its internal shape. Decode raises ``ValueError`` on
malformed input so the route can return a clean 400.
"""

from __future__ import annotations

import base64
from datetime import datetime


def encode_cursor(created_at: datetime, post_id: str) -> str:
    payload = f"{created_at.isoformat()}|{post_id}".encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    padded = cursor + "=" * (-len(cursor) % 4)
    try:
        decoded = base64.urlsafe_b64decode(padded.encode()).decode()
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError("Malformed cursor") from exc
    if "|" not in decoded:
        raise ValueError("Malformed cursor")
    created_raw, post_id = decoded.split("|", 1)
    try:
        created_at = datetime.fromisoformat(created_raw)
    except ValueError as exc:
        raise ValueError("Malformed cursor") from exc
    if not post_id:
        raise ValueError("Malformed cursor")
    return created_at, post_id
