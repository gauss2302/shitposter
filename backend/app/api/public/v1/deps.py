"""Public-API specific dependencies: subscription gate + rate limiting.

Layered on top of the existing ``get_current_api_principal`` /
``require_api_scope`` so the auth surface stays identical between the
internal dashboard and the public API.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Response, status

from app.api.deps import ApiPrincipal, DbSessionDep, SettingsDep, get_current_api_principal
from app.application.billing_service import BillingService, SubscriptionState
from app.application.rate_limit import RateLimiter
from app.core.config import Settings
from app.infrastructure.redis import get_redis


async def require_active_subscription(
    principal: Annotated[ApiPrincipal, Depends(get_current_api_principal)],
    db: DbSessionDep,
) -> SubscriptionState:
    state = await BillingService(db).get_subscription_state(principal.user_id)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                "Public API requires an active subscription. "
                "Subscribe at /dashboard/accounts to enable API access."
            ),
        )
    return state


SubscriptionStateDep = Annotated[SubscriptionState, Depends(require_active_subscription)]


def _read_limit_for_plan(settings: Settings, plan: str) -> int:
    return {
        "basic": settings.public_api_read_limit_basic,
        "business": settings.public_api_read_limit_business,
        "enterprise": settings.public_api_read_limit_enterprise,
    }.get(plan, 0)


def _write_limit_for_plan(settings: Settings, plan: str) -> int:
    return {
        "basic": settings.public_api_write_limit_basic,
        "business": settings.public_api_write_limit_business,
        "enterprise": settings.public_api_write_limit_enterprise,
    }.get(plan, 0)


async def _enforce(
    response: Response,
    principal: ApiPrincipal,
    state: SubscriptionState,
    settings: Settings,
    *,
    bucket: str,
    limit: int,
) -> None:
    window = settings.public_api_rate_window_seconds
    decision = await RateLimiter(get_redis()).acquire(
        bucket=bucket,
        key=principal.api_key_id,
        limit=limit,
        window_seconds=window,
    )
    response.headers["X-RateLimit-Limit"] = str(decision.limit)
    response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
    response.headers["X-RateLimit-Reset"] = str(decision.reset_at_epoch)
    if not decision.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for plan '{state.plan}'",
            headers={
                "Retry-After": str(decision.retry_after_seconds),
                "X-RateLimit-Limit": str(decision.limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(decision.reset_at_epoch),
            },
        )


async def enforce_read_rate_limit(
    response: Response,
    principal: Annotated[ApiPrincipal, Depends(get_current_api_principal)],
    state: SubscriptionStateDep,
    settings: SettingsDep,
) -> None:
    await _enforce(
        response,
        principal,
        state,
        settings,
        bucket="read",
        limit=_read_limit_for_plan(settings, state.plan),
    )


async def enforce_write_rate_limit(
    response: Response,
    principal: Annotated[ApiPrincipal, Depends(get_current_api_principal)],
    state: SubscriptionStateDep,
    settings: SettingsDep,
) -> None:
    await _enforce(
        response,
        principal,
        state,
        settings,
        bucket="write",
        limit=_write_limit_for_plan(settings, state.plan),
    )
