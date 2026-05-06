from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.infrastructure.db.repositories import SocialAccountRepository, SubscriptionRepository
from app.infrastructure.external.polar import PolarClient, PolarNotConfiguredError

PLAN_ACCOUNT_LIMITS: dict[str, int | None] = {
    "basic": 1,
    "business": 4,
    "enterprise": None,
}


def is_plan_active(status: str) -> bool:
    return status == "active"


@dataclass(frozen=True)
class SubscriptionState:
    plan: str
    limit_per_platform: int | None
    status: str
    current_period_end: datetime | None
    cancel_at_period_end: bool


class BillingService:
    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self.subscriptions = SubscriptionRepository(session)
        self.social_accounts = SocialAccountRepository(session)
        self.settings = settings

    async def get_subscription_state(self, user_id: str) -> SubscriptionState | None:
        row = await self.subscriptions.get_by_user_id(user_id)
        if row is None or not is_plan_active(row.status):
            return None
        if row.plan not in PLAN_ACCOUNT_LIMITS:
            return None
        return SubscriptionState(
            plan=row.plan,
            limit_per_platform=PLAN_ACCOUNT_LIMITS[row.plan],
            status=row.status,
            current_period_end=row.current_period_end,
            cancel_at_period_end=row.cancel_at_period_end,
        )

    async def can_connect_platform_account(self, user_id: str, platform: str) -> bool:
        state = await self.get_subscription_state(user_id)
        if state is None:
            return False
        if state.limit_per_platform is None:
            return True
        current = await self.social_accounts.count_by_platform(user_id, platform)
        return current < state.limit_per_platform

    async def create_checkout(
        self,
        *,
        user_id: str,
        email: str,
        name: str,
        plan: str,
    ) -> dict[str, str]:
        if self.settings is None:
            raise PolarNotConfiguredError("Polar is not configured")
        product_ids = {
            "basic": self.settings.polar_product_id_basic,
            "business": self.settings.polar_product_id_business,
            "enterprise": self.settings.polar_product_id_enterprise,
        }
        product_id = product_ids.get(plan)
        if not product_id:
            raise PolarNotConfiguredError("Plan is not configured")
        return await PolarClient(self.settings).create_checkout(
            user_id=user_id,
            email=email,
            name=name,
            product_id=product_id,
        )

    async def create_portal(self, *, user_id: str) -> dict[str, str]:
        if self.settings is None:
            raise PolarNotConfiguredError("Polar is not configured")
        return await PolarClient(self.settings).create_portal(user_id=user_id)
