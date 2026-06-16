"""Shared Pydantic response models for the public API.

Mirrors are intentional copies (not re-exports) of dashboard schemas so
the public contract stays stable when the dashboard surface evolves.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.application.platforms import (
    MEDIA_SUPPORTED,
    PLATFORM_NOTES,
    PLATFORM_TEXT_LIMITS,
    all_known_platforms,
)
from app.application.posts_service import SUPPORTED_PUBLISHING_PLATFORMS
from app.infrastructure.db import models


class MeResponse(BaseModel):
    userId: str
    apiKeyId: str
    apiKeyName: str
    scopes: list[str]
    plan: str


class PlatformCapabilityResponse(BaseModel):
    platform: str
    publishSupported: bool
    textLimit: int | None = None
    mediaSupported: bool
    notes: str | None = None


class PublicSocialAccountResponse(BaseModel):
    id: str
    platform: str
    platformUserId: str
    platformUsername: str
    profileImageUrl: str | None = None
    followerCount: int | None = None
    isActive: bool
    capabilities: PlatformCapabilityResponse


class PublicPostTargetResponse(BaseModel):
    id: str
    socialAccountId: str
    platform: str | None = None
    platformUsername: str | None = None
    status: str
    platformPostId: str | None = None
    publishedAt: str | None = None
    errorMessage: str | None = None


class PublicPostResponse(BaseModel):
    id: str
    content: str
    mediaUrls: list[str] | None = None
    scheduledFor: str | None = None
    status: str
    createdAt: str
    updatedAt: str
    targets: list[PublicPostTargetResponse] = Field(default_factory=list)


class PublicCreatedPostResponse(BaseModel):
    success: bool
    post: PublicPostResponse
    targetCount: int
    mediaCount: int


class PublicPostsPageResponse(BaseModel):
    items: list[PublicPostResponse]
    nextCursor: str | None = None


class UpdatePostRequest(BaseModel):
    content: str | None = None
    scheduledFor: str | None = None


# ---- AI ----


class PublicAiProviderCredentialRequest(BaseModel):
    provider: str
    displayName: str
    apiKey: str
    defaultModel: str
    baseUrl: str | None = None


class PublicAiProviderCredentialUpdateRequest(BaseModel):
    displayName: str | None = None
    apiKey: str | None = None
    defaultModel: str | None = None
    baseUrl: str | None = None
    isActive: bool | None = None


class PublicAiProviderCredentialResponse(BaseModel):
    id: str
    provider: str
    displayName: str
    baseUrl: str | None = None
    defaultModel: str
    isActive: bool
    createdAt: str
    updatedAt: str


class PublicAiGenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    providerCredentialId: str | None = None
    provider: str | None = None
    model: str | None = None
    platforms: list[str] = Field(default_factory=list)
    socialAccountIds: list[str] = Field(default_factory=list)
    language: str | None = None
    tone: str | None = None
    maxCandidates: int = Field(default=1, ge=1, le=5)
    context: dict[str, Any] | None = None


class PublicAiCandidateResponse(BaseModel):
    content: str
    platformFit: dict[str, bool]
    charCount: int
    warnings: list[str]


class PublicAiGenerateResponse(BaseModel):
    provider: str
    model: str
    candidates: list[PublicAiCandidateResponse]


# ---- helpers ----


def iso(value: object) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else None


def capability(platform: str) -> PlatformCapabilityResponse:
    return PlatformCapabilityResponse(
        platform=platform,
        publishSupported=platform in SUPPORTED_PUBLISHING_PLATFORMS,
        textLimit=PLATFORM_TEXT_LIMITS.get(platform),
        mediaSupported=MEDIA_SUPPORTED.get(platform, False),
        notes=PLATFORM_NOTES.get(platform),
    )


def all_capabilities() -> list[PlatformCapabilityResponse]:
    return [capability(p) for p in all_known_platforms()]


def social_account(account: models.SocialAccount) -> PublicSocialAccountResponse:
    return PublicSocialAccountResponse(
        id=account.id,
        platform=account.platform,
        platformUserId=account.platform_user_id,
        platformUsername=account.platform_username,
        profileImageUrl=account.profile_image_url,
        followerCount=account.follower_count,
        isActive=account.is_active,
        capabilities=capability(account.platform),
    )


def post_target(
    target: models.PostTarget,
    account: models.SocialAccount | None,
) -> PublicPostTargetResponse:
    return PublicPostTargetResponse(
        id=target.id,
        socialAccountId=target.social_account_id,
        platform=account.platform if account else None,
        platformUsername=account.platform_username if account else None,
        status=target.status,
        platformPostId=target.platform_post_id,
        publishedAt=iso(target.published_at),
        errorMessage=target.error_message,
    )


def post(
    row: models.Post,
    targets: list[tuple[models.PostTarget, models.SocialAccount | None]] | None = None,
) -> PublicPostResponse:
    return PublicPostResponse(
        id=row.id,
        content=row.content,
        mediaUrls=row.media_urls,
        scheduledFor=iso(row.scheduled_for),
        status=row.status,
        createdAt=iso(row.created_at) or "",
        updatedAt=iso(row.updated_at) or "",
        targets=[post_target(t, a) for t, a in targets or []],
    )
