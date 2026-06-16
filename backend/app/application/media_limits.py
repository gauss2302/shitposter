"""Shared upload-validation constants and helpers.

Used by both the dashboard ``/api/v1/media/upload`` route and the public
``/api/public/v1/posts`` multipart handler so we don't drift apart on
size caps or allowed MIME types.
"""

from __future__ import annotations

import secrets

# 4GB matches TikTok's hard ceiling and Instagram's Reels max.
MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024
ALLOWED_MIME_PREFIXES: tuple[str, ...] = ("video/", "image/")


_EXTENSION_BY_MIME_FRAGMENT: tuple[tuple[str, str], ...] = (
    ("mp4", ".mp4"),
    ("quicktime", ".mov"),
    ("mov", ".mov"),
    ("webm", ".webm"),
    ("jpeg", ".jpg"),
    ("jpg", ".jpg"),
    ("png", ".png"),
    ("gif", ".gif"),
)


def extension_for_mime(mime_type: str) -> str:
    for fragment, ext in _EXTENSION_BY_MIME_FRAGMENT:
        if fragment in mime_type:
            return ext
    return ".bin"


def build_storage_key(*, user_id: str, mime_type: str) -> str:
    return f"uploads/{user_id}/{secrets.token_urlsafe(12)}{extension_for_mime(mime_type)}"
