from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, get_settings
from app.application.agent_readiness_service import AgentReadinessResult, AgentReadinessService
from app.application.auth_service import AuthenticatedUser
from app.application.billing_service import BillingService
from app.application.dashboard_service import DashboardService
from app.core.config import Settings

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


class SocialAccountResponse(BaseModel):
    id: str
    userId: str
    platform: str
    platformUserId: str
    platformUsername: str
    refreshToken: str | None = None
    tokenExpiresAt: str | None = None
    oauth1AccessToken: str | None = None
    accessTokenSecret: str | None = None
    profileImageUrl: str | None = None
    followerCount: int | None = None
    isActive: bool
    createdAt: str
    updatedAt: str


class SubscriptionStateResponse(BaseModel):
    plan: str
    limitPerPlatform: int | None
    status: str
    currentPeriodEnd: str | None
    cancelAtPeriodEnd: bool


class PostTargetResponse(BaseModel):
    id: str
    postId: str
    socialAccountId: str
    status: str
    platformPostId: str | None = None
    publishedAt: str | None = None
    errorMessage: str | None = None
    account: SocialAccountResponse | None = None


class PostResponse(BaseModel):
    id: str
    userId: str
    content: str
    mediaUrls: list[str] | None
    scheduledFor: str | None = None
    status: str
    createdAt: str
    updatedAt: str
    targets: list[PostTargetResponse] = Field(default_factory=list)


class DashboardSummaryResponse(BaseModel):
    user: dict[str, str | None]
    accounts: list[SocialAccountResponse]
    posts: list[PostResponse]
    stats: dict[str, int]


class AgentReadinessCheckResponse(BaseModel):
    id: str
    title: str
    ok: bool
    required: bool = True
    detail: str


class AgentReadinessResponse(BaseModel):
    readyToAutomate: bool
    summary: str
    hasPostableSocialAccount: bool
    postableSocialAccountCount: int
    hasAiConfiguration: bool
    aiConfigurationSource: str
    hasOperationalApiKey: bool
    operationalApiKeyCount: int
    canManageAiProvidersViaApi: bool
    providerApiCapableKeyCount: int
    checks: list[AgentReadinessCheckResponse]


def _iso(value: object) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else None


def _social_account(account: object) -> SocialAccountResponse:
    return SocialAccountResponse(
        id=account.id,
        userId=account.user_id,
        platform=account.platform,
        platformUserId=account.platform_user_id,
        platformUsername=account.platform_username,
        tokenExpiresAt=_iso(account.token_expires_at),
        oauth1AccessToken=None,
        accessTokenSecret=None,
        profileImageUrl=account.profile_image_url,
        followerCount=account.follower_count,
        isActive=account.is_active,
        createdAt=_iso(account.created_at) or "",
        updatedAt=_iso(account.updated_at) or "",
    )


def _post(post: object, targets: list[PostTargetResponse] | None = None) -> PostResponse:
    return PostResponse(
        id=post.id,
        userId=post.user_id,
        content=post.content,
        mediaUrls=post.media_urls,
        scheduledFor=_iso(post.scheduled_for),
        status=post.status,
        createdAt=_iso(post.created_at) or "",
        updatedAt=_iso(post.updated_at) or "",
        targets=targets or [],
    )


async def _service(db: AsyncSession) -> DashboardService:
    return DashboardService(db)


def _agent_readiness_payload(result: AgentReadinessResult) -> AgentReadinessResponse:
    """Map AgentReadinessResult to API response with human-readable checklist."""
    ready = result.ready_to_automate
    if ready:
        summary = (
            "Your setup supports the full agent path: an API key can call the model, "
            "generate copy, and publish to at least one supported channel."
        )
    else:
        missing: list[str] = []
        if not result.has_ai_configuration:
            missing.append("a configured language model")
        if not result.has_operational_api_key:
            missing.append("an API key with accounts:read, posts:write, and ai:generate")
        if not result.has_postable_social_account:
            missing.append("a connected X or LinkedIn account for publishing")
        summary = "Complete these items to let agents generate and post automatically: " + (
            "; ".join(missing)
        )

    checks: list[AgentReadinessCheckResponse] = [
        AgentReadinessCheckResponse(
            id="language_model",
            title="Language model available",
            ok=result.has_ai_configuration,
            required=True,
            detail=(
                "Save a provider under AI settings, rely on workspace defaults, "
                "or register models through the Agent API."
                if result.has_ai_configuration
                else "Add an OpenAI, Anthropic, or OpenAI-compatible key in AI settings, "
                "or ask your host to enable server-side model keys."
            ),
        ),
        AgentReadinessCheckResponse(
            id="agent_api_key",
            title="Agent API key with posting + AI scopes",
            ok=result.has_operational_api_key,
            required=True,
            detail=(
                f"{result.operational_api_key_count} active key(s) can call "
                "/agent/social/accounts, /agent/ai/generate, and /agent/posts."
                if result.has_operational_api_key
                else "Create a Developer API key that includes accounts:read, posts:write, "
                "and ai:generate (included by default when you select all scopes)."
            ),
        ),
        AgentReadinessCheckResponse(
            id="publishing_channels",
            title="Publishing channels (X or LinkedIn)",
            ok=result.has_postable_social_account,
            required=True,
            detail=(
                f"{result.postable_social_account_count} account(s) can receive agent posts."
                if result.has_postable_social_account
                else "Connect X (Twitter) or LinkedIn under Accounts. "
                "Other networks are visible but not supported for agent publishing yet."
            ),
        ),
        AgentReadinessCheckResponse(
            id="provider_http_api",
            title="Optional: manage AI providers via Agent API",
            ok=result.can_manage_ai_providers_via_api,
            required=False,
            detail=(
                f"{result.provider_api_capable_key_count} key(s) include ai:providers:read "
                "and ai:providers:write for non-browser automation."
                if result.can_manage_ai_providers_via_api
                else "Add ai:providers:read and ai:providers:write to a key if your agent "
                "should register or rotate model keys without using the dashboard."
            ),
        ),
    ]

    return AgentReadinessResponse(
        readyToAutomate=ready,
        summary=summary,
        hasPostableSocialAccount=result.has_postable_social_account,
        postableSocialAccountCount=result.postable_social_account_count,
        hasAiConfiguration=result.has_ai_configuration,
        aiConfigurationSource=result.ai_configuration_source,
        hasOperationalApiKey=result.has_operational_api_key,
        operationalApiKeyCount=result.operational_api_key_count,
        canManageAiProvidersViaApi=result.can_manage_ai_providers_via_api,
        providerApiCapableKeyCount=result.provider_api_capable_key_count,
        checks=checks,
    )


@router.get("/agent-readiness", response_model=AgentReadinessResponse)
async def agent_readiness(
    current: CurrentUserDep,
    db: DbSessionDep,
    settings: SettingsDep,
) -> AgentReadinessResponse:
    result = await AgentReadinessService(db, settings).evaluate(current.id)
    return _agent_readiness_payload(result)


@router.get("/accounts", response_model=list[SocialAccountResponse])
async def accounts(current: CurrentUserDep, db: DbSessionDep) -> list[SocialAccountResponse]:
    rows = await (await _service(db)).list_accounts(current.id)
    return [_social_account(row) for row in rows]


@router.get("/subscription", response_model=SubscriptionStateResponse | None)
async def subscription(
    current: CurrentUserDep,
    db: DbSessionDep,
) -> SubscriptionStateResponse | None:
    state = await BillingService(db).get_subscription_state(current.id)
    if state is None:
        return None
    return SubscriptionStateResponse(
        plan=state.plan,
        limitPerPlatform=state.limit_per_platform,
        status=state.status,
        currentPeriodEnd=_iso(state.current_period_end),
        cancelAtPeriodEnd=state.cancel_at_period_end,
    )


@router.get("/posts", response_model=list[PostResponse])
async def posts(current: CurrentUserDep, db: DbSessionDep) -> list[PostResponse]:
    rows = await (await _service(db)).list_posts_with_targets(current.id)
    result: list[PostResponse] = []
    for post, targets in rows:
        serialized_targets = [
            PostTargetResponse(
                id=target.id,
                postId=target.post_id,
                socialAccountId=target.social_account_id,
                status=target.status,
                platformPostId=target.platform_post_id,
                publishedAt=_iso(target.published_at),
                errorMessage=target.error_message,
                account=_social_account(account) if account is not None else None,
            )
            for target, account in targets
        ]
        result.append(_post(post, serialized_targets))
    return result


@router.get("/summary", response_model=DashboardSummaryResponse)
async def summary(current: CurrentUserDep, db: DbSessionDep) -> DashboardSummaryResponse:
    svc = await _service(db)
    accounts_rows = await svc.list_accounts(current.id)
    post_rows = await svc.list_posts(current.id)
    accounts_data = [_social_account(row) for row in accounts_rows]
    posts_data = [_post(row) for row in post_rows]
    return DashboardSummaryResponse(
        user={
            "id": current.id,
            "name": current.name,
            "email": current.email,
            "image": current.image,
        },
        accounts=accounts_data,
        posts=posts_data,
        stats={
            "connectedAccounts": len(accounts_data),
            "scheduledPosts": len([post for post in posts_data if post.status == "scheduled"]),
            "publishedPosts": len([post for post in posts_data if post.status == "published"]),
        },
    )
