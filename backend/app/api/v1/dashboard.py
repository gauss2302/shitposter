from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session
from app.application.auth_service import AuthenticatedUser
from app.application.billing_service import BillingService
from app.application.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]


class SocialAccountResponse(BaseModel):
    id: str
    userId: str
    platform: str
    platformUserId: str
    platformUsername: str
    accessToken: str = ""
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
    targets: list[PostTargetResponse] = []


class DashboardSummaryResponse(BaseModel):
    user: dict[str, str | None]
    accounts: list[SocialAccountResponse]
    posts: list[PostResponse]
    stats: dict[str, int]


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
