"""Single source of truth for per-platform metadata used by APIs and AI prompts.

Kept here (and imported by both ``ai_service`` and the public-API router)
so the limits stay in sync when we add a platform.
"""

from __future__ import annotations

from app.application.posts_service import SUPPORTED_PUBLISHING_PLATFORMS

PLATFORM_TEXT_LIMITS: dict[str, int] = {
    "twitter": 280,
    "threads": 500,
    "instagram": 2200,
    "tiktok": 2200,
    "linkedin": 3000,
    "facebook": 63206,
}

MEDIA_SUPPORTED: dict[str, bool] = {
    "twitter": True,
    "threads": False,
    "instagram": True,
    "tiktok": True,
    "linkedin": False,
    "facebook": False,
}

PLATFORM_NOTES: dict[str, str | None] = {
    platform: None if platform in SUPPORTED_PUBLISHING_PLATFORMS
    else "Publishing adapter is not enabled for this platform yet."
    for platform in PLATFORM_TEXT_LIMITS
}


def all_known_platforms() -> list[str]:
    return sorted({*PLATFORM_TEXT_LIMITS.keys(), *SUPPORTED_PUBLISHING_PLATFORMS})
