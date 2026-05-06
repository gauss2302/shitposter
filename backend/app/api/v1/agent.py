from __future__ import annotations

import base64
import binascii
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    ApiPrincipal,
    get_current_api_principal,
    get_db_session,
    get_settings,
    require_api_scope,
)
from app.application.ai_service import AiGenerationCandidate, AiService
from app.application.posts_service import (
    SUPPORTED_PUBLISHING_PLATFORMS,
    MediaInput,
    PostsService,
)
from app.core.config import Settings
from app.domain.exceptions import NotFoundError, ValidationError
from app.infrastructure.db import models
from app.infrastructure.db.repositories import PostRepository, SocialAccountRepository

router = APIRouter(prefix="/agent", tags=["agent"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
AccountsReadPrincipal = Annotated[ApiPrincipal, Depends(require_api_scope("accounts:read"))]
PostsReadPrincipal = Annotated[ApiPrincipal, Depends(require_api_scope("posts:read"))]
PostsWritePrincipal = Annotated[ApiPrincipal, Depends(require_api_scope("posts:write"))]
AiGeneratePrincipal = Annotated[ApiPrincipal, Depends(require_api_scope("ai:generate"))]

PLATFORM_LIMITS = {
    "twitter": 280,
    "threads": 500,
    "instagram": 2200,
    "tiktok": 2200,
    "linkedin": 3000,
    "facebook": 63206,
}


class AgentMeResponse(BaseModel):
    userId: str
    apiKeyId: str
    apiKeyName: str
    scopes: list[str]


class PlatformCapabilityResponse(BaseModel):
    platform: str
    publishSupported: bool
    textLimit: int | None = None
    mediaSupported: bool
    notes: str | None = None


class AgentSocialAccountResponse(BaseModel):
    id: str
    platform: str
    platformUserId: str
    platformUsername: str
    profileImageUrl: str | None = None
    followerCount: int | None = None
    isActive: bool
    capabilities: PlatformCapabilityResponse


class AgentPostTargetResponse(BaseModel):
    id: str
    socialAccountId: str
    platform: str | None = None
    platformUsername: str | None = None
    status: str
    platformPostId: str | None = None
    publishedAt: str | None = None
    errorMessage: str | None = None


class AgentPostResponse(BaseModel):
    id: str
    content: str
    mediaUrls: list[str] | None = None
    scheduledFor: str | None = None
    status: str
    createdAt: str
    updatedAt: str
    targets: list[AgentPostTargetResponse] = Field(default_factory=list)


class AgentMediaInput(BaseModel):
    data: str = Field(description="Base64 encoded media bytes.")
    mimeType: str = Field(default="application/octet-stream")


class AgentCreatePostRequest(BaseModel):
    content: str = ""
    socialAccountIds: list[str] = Field(default_factory=list)
    scheduledFor: str | None = None
    media: list[AgentMediaInput] = Field(default_factory=list)


class AgentCreatedPostResponse(BaseModel):
    success: bool
    post: AgentPostResponse
    targetCount: int
    mediaCount: int


class AgentAiGenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    providerCredentialId: str | None = None
    provider: str | None = None
    model: str | None = None
    platforms: list[str] = Field(default_factory=list)
    socialAccountIds: list[str] = Field(default_factory=list)
    language: str | None = None
    tone: str | None = None
    maxCandidates: int = Field(default=1, ge=1, le=5)
    context: dict[str, object] | None = None


class AgentAiCandidateResponse(BaseModel):
    content: str
    platformFit: dict[str, bool]
    charCount: int
    warnings: list[str]


class AgentAiGenerateResponse(BaseModel):
    provider: str
    model: str
    candidates: list[AgentAiCandidateResponse]


def _iso(value: object) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else None


def _capability(platform: str) -> PlatformCapabilityResponse:
    supported = platform in SUPPORTED_PUBLISHING_PLATFORMS
    return PlatformCapabilityResponse(
        platform=platform,
        publishSupported=supported,
        textLimit=PLATFORM_LIMITS.get(platform),
        mediaSupported=platform == "twitter",
        notes=None
        if supported
        else "Publishing adapter is not enabled for this platform yet.",
    )


def _account(account: models.SocialAccount) -> AgentSocialAccountResponse:
    return AgentSocialAccountResponse(
        id=account.id,
        platform=account.platform,
        platformUserId=account.platform_user_id,
        platformUsername=account.platform_username,
        profileImageUrl=account.profile_image_url,
        followerCount=account.follower_count,
        isActive=account.is_active,
        capabilities=_capability(account.platform),
    )


def _target(
    target: models.PostTarget,
    account: models.SocialAccount | None,
) -> AgentPostTargetResponse:
    return AgentPostTargetResponse(
        id=target.id,
        socialAccountId=target.social_account_id,
        platform=account.platform if account else None,
        platformUsername=account.platform_username if account else None,
        status=target.status,
        platformPostId=target.platform_post_id,
        publishedAt=_iso(target.published_at),
        errorMessage=target.error_message,
    )


def _post(
    post: models.Post,
    targets: list[tuple[models.PostTarget, models.SocialAccount | None]] | None = None,
) -> AgentPostResponse:
    return AgentPostResponse(
        id=post.id,
        content=post.content,
        mediaUrls=post.media_urls,
        scheduledFor=_iso(post.scheduled_for),
        status=post.status,
        createdAt=_iso(post.created_at) or "",
        updatedAt=_iso(post.updated_at) or "",
        targets=[_target(target, account) for target, account in targets or []],
    )


def _media_inputs(items: list[AgentMediaInput]) -> list[MediaInput]:
    media: list[MediaInput] = []
    for item in items:
        try:
            base64.b64decode(item.data, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise ValidationError("Invalid base64 media payload") from exc
        media.append(MediaInput(data=item.data, mime_type=item.mimeType))
    return media


def _ai_candidate(candidate: AiGenerationCandidate) -> AgentAiCandidateResponse:
    return AgentAiCandidateResponse(
        content=candidate.content,
        platformFit=candidate.platform_fit,
        charCount=candidate.char_count,
        warnings=candidate.warnings,
    )


@router.get("/me", response_model=AgentMeResponse)
async def me(
    principal: Annotated[ApiPrincipal, Depends(get_current_api_principal)],
) -> AgentMeResponse:
    return AgentMeResponse(
        userId=principal.user_id,
        apiKeyId=principal.api_key_id,
        apiKeyName=principal.api_key_name,
        scopes=sorted(principal.scopes),
    )


@router.get("/social/capabilities", response_model=list[PlatformCapabilityResponse])
async def social_capabilities(
    _principal: AccountsReadPrincipal,
) -> list[PlatformCapabilityResponse]:
    platforms = sorted({*PLATFORM_LIMITS.keys(), *SUPPORTED_PUBLISHING_PLATFORMS})
    return [_capability(platform) for platform in platforms]


@router.get("/social/accounts", response_model=list[AgentSocialAccountResponse])
async def social_accounts(
    principal: AccountsReadPrincipal,
    db: DbSessionDep,
) -> list[AgentSocialAccountResponse]:
    rows = await SocialAccountRepository(db).list_for_user(principal.user_id)
    return [_account(row) for row in rows if row.is_active]


@router.get("/posts", response_model=list[AgentPostResponse])
async def list_posts(
    principal: PostsReadPrincipal,
    db: DbSessionDep,
) -> list[AgentPostResponse]:
    rows = await PostsService(db).list_posts_with_targets(principal.user_id)
    return [_post(post, targets) for post, targets in rows]


@router.get("/posts/{post_id}", response_model=AgentPostResponse)
async def get_post(
    post_id: str,
    principal: PostsReadPrincipal,
    db: DbSessionDep,
) -> AgentPostResponse:
    repo = PostRepository(db)
    post = await repo.get_owned(post_id, principal.user_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    targets = await repo.get_targets(post.id)
    accounts = await repo.list_accounts_by_target_ids(
        [target.social_account_id for target in targets]
    )
    account_by_id = {account.id: account for account in accounts}
    return _post(
        post,
        [(target, account_by_id.get(target.social_account_id)) for target in targets],
    )


@router.post(
    "/posts",
    response_model=AgentCreatedPostResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_post(
    payload: AgentCreatePostRequest,
    principal: PostsWritePrincipal,
    db: DbSessionDep,
) -> AgentCreatedPostResponse:
    try:
        created = await PostsService(db).create_post(
            user_id=principal.user_id,
            content=payload.content,
            social_account_ids=payload.socialAccountIds,
            scheduled_for_raw=payload.scheduledFor,
            media=_media_inputs(payload.media),
        )
    except (NotFoundError, ValidationError) as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    targets = await PostRepository(db).get_targets(created.post.id)
    accounts = await PostRepository(db).list_accounts_by_target_ids(
        [target.social_account_id for target in targets]
    )
    account_by_id = {account.id: account for account in accounts}
    return AgentCreatedPostResponse(
        success=True,
        post=_post(
            created.post,
            [(target, account_by_id.get(target.social_account_id)) for target in targets],
        ),
        targetCount=created.target_count,
        mediaCount=created.media_count,
    )


@router.post("/ai/generate", response_model=AgentAiGenerateResponse)
async def generate_ai_content(
    payload: AgentAiGenerateRequest,
    principal: AiGeneratePrincipal,
    db: DbSessionDep,
    settings: SettingsDep,
) -> AgentAiGenerateResponse:
    try:
        result = await AiService(db, settings).generate(
            user_id=principal.user_id,
            prompt=payload.prompt,
            provider_credential_id=payload.providerCredentialId,
            provider=payload.provider,
            model=payload.model,
            platforms=payload.platforms,
            social_account_ids=payload.socialAccountIds,
            language=payload.language or "English",
            tone=payload.tone or "clear, useful, and engaging",
            max_candidates=payload.maxCandidates,
            context=str(payload.context) if payload.context else None,
        )
    except (NotFoundError, ValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AgentAiGenerateResponse(
        candidates=[_ai_candidate(candidate) for candidate in result.candidates],
        provider=result.provider,
        model=result.model,
    )
