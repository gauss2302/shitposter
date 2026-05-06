from __future__ import annotations

import base64
import hmac
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.infrastructure.db import models
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
        accounts_url = f"{self.settings.frontend_public_url}/dashboard/accounts"
        return await PolarClient(self.settings).create_checkout(
            user_id=user_id,
            email=email,
            name=name,
            product_id=product_id,
            success_url=f"{accounts_url}?success=subscribed",
            return_url=accounts_url,
        )

    async def create_portal(self, *, user_id: str) -> dict[str, str]:
        if self.settings is None:
            raise PolarNotConfiguredError("Polar is not configured")
        return await PolarClient(self.settings).create_portal(
            user_id=user_id,
            return_url=f"{self.settings.frontend_public_url}/dashboard/accounts",
        )

    async def handle_polar_webhook(
        self,
        raw_body: bytes,
        signature: str | None,
        *,
        webhook_id: str | None,
        webhook_timestamp: str | None,
    ) -> None:
        if self.settings is None or not self.settings.polar_webhook_secret:
            raise PolarNotConfiguredError("Webhook not configured")
        if not self._verify_standard_webhook_signature(
            raw_body,
            signature,
            webhook_id=webhook_id,
            webhook_timestamp=webhook_timestamp,
        ):
            raise PermissionError("Invalid signature")
        import json

        event = json.loads(raw_body.decode("utf-8") or "{}")
        event_type = event.get("type")
        data = event.get("data") or {}
        if event_type not in {
            "subscription.created",
            "subscription.updated",
            "subscription.canceled",
            "subscription.revoked",
            "customer.state_changed",
        }:
            return
        if event_type == "customer.state_changed":
            await self._sync_customer_state(data)
        else:
            if event_type in {"subscription.canceled", "subscription.revoked"}:
                data["status"] = "canceled"
            await self._sync_subscription_payload(data)

    async def _sync_subscription_payload(self, data: dict[str, Any]) -> None:
        customer = data.get("customer") or {}
        user_id = customer.get("externalId") or data.get("externalCustomerId")
        product_id = data.get("productId")
        if not user_id or not product_id or self.settings is None:
            return
        plan = self._plan_from_product_id(str(product_id))
        if plan is None:
            return
        await self.subscriptions.upsert(
            models.Subscription(
                id=str(data.get("id") or f"polar-{user_id}"),
                user_id=str(user_id),
                polar_customer_id=customer.get("id"),
                polar_subscription_id=data.get("id"),
                plan=plan,
                status=str(data.get("status") or "active"),
                current_period_start=self._parse_date(data.get("currentPeriodStart")),
                current_period_end=self._parse_date(data.get("currentPeriodEnd")),
                cancel_at_period_end=bool(data.get("cancelAtPeriodEnd") or False),
                canceled_at=self._parse_date(data.get("canceledAt")),
                metadata=str({"productId": product_id}),
            )
        )

    async def _sync_customer_state(self, data: dict[str, Any]) -> None:
        user_id = data.get("externalId")
        subscriptions = data.get("activeSubscriptions") or []
        if not user_id:
            return
        if subscriptions:
            sub = dict(subscriptions[0])
            sub["customer"] = {"id": data.get("id"), "externalId": user_id}
            await self._sync_subscription_payload(sub)
            return
        await self.subscriptions.upsert(
            models.Subscription(
                id=f"polar-{user_id}",
                user_id=str(user_id),
                polar_customer_id=data.get("id"),
                polar_subscription_id=None,
                plan="basic",
                status="canceled",
                cancel_at_period_end=False,
                canceled_at=datetime.utcnow(),
                metadata=str({"source": "customer.state_changed", "empty": True}),
            )
        )

    def _plan_from_product_id(self, product_id: str) -> str | None:
        if self.settings is None:
            return None
        mapping = {
            self.settings.polar_product_id_basic: "basic",
            self.settings.polar_product_id_business: "business",
            self.settings.polar_product_id_enterprise: "enterprise",
        }
        return mapping.get(product_id)

    def _verify_standard_webhook_signature(
        self,
        raw_body: bytes,
        signature_header: str | None,
        *,
        webhook_id: str | None,
        webhook_timestamp: str | None,
    ) -> bool:
        """Verify Polar's Standard Webhooks HMAC signature.

        Polar signs `webhook-id.webhook-timestamp.body` with the base64 portion
        of `POLAR_WEBHOOK_SECRET` (`whsec_...`) and sends one or more `v1,...`
        signatures. Older proxy setups may pass only the signature value; fail
        closed unless a configured signature matches.
        """

        if self.settings is None or not signature_header:
            return False
        if not webhook_id or not webhook_timestamp:
            return False
        # Some deployments concatenate standard webhook headers into the
        # signature header; support the common "v1,<sig>" shape first.
        signatures = [
            part[3:] if part.startswith("v1,") else part
            for part in signature_header.split()
            if part
        ]
        if not signatures:
            return False
        secret = self.settings.polar_webhook_secret
        if secret.startswith("whsec_"):
            secret = secret.removeprefix("whsec_")
        try:
            key = base64.b64decode(secret)
        except Exception:
            key = self.settings.polar_webhook_secret.encode()
        signed = b".".join([webhook_id.encode(), webhook_timestamp.encode(), raw_body])
        digest = base64.b64encode(hmac.new(key, signed, sha256).digest()).decode()
        return any(hmac.compare_digest(digest, candidate) for candidate in signatures)

    @staticmethod
    def _parse_date(value: object) -> datetime | None:
        if not isinstance(value, str) or not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
