from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.billing_service import BillingService, SubscriptionState
from app.infrastructure.db import models
from app.infrastructure.db.repositories import PostRepository, SocialAccountRepository


@dataclass(frozen=True)
class DashboardSummary:
    accounts: Sequence[models.SocialAccount]
    posts: Sequence[models.Post]

    @property
    def connected_accounts(self) -> int:
        return len(self.accounts)

    @property
    def scheduled_posts(self) -> int:
        return sum(1 for post in self.posts if post.status == "scheduled")

    @property
    def published_posts(self) -> int:
        return sum(1 for post in self.posts if post.status == "published")


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.social_accounts = SocialAccountRepository(session)
        self.posts = PostRepository(session)

    async def get_summary(self, user_id: str) -> DashboardSummary:
        accounts = await self.social_accounts.list_for_user(user_id)
        posts = await self.posts.list_for_user(user_id, limit=50)
        return DashboardSummary(accounts=accounts, posts=posts)

    async def list_accounts(self, user_id: str) -> Sequence[models.SocialAccount]:
        return await self.social_accounts.list_for_user(user_id)

    async def list_posts(self, user_id: str) -> Sequence[models.Post]:
        return await self.posts.list_for_user(user_id, limit=50)

    async def get_subscription_state(self, user_id: str) -> SubscriptionState | None:
        return await BillingService(self.posts.session).get_subscription_state(user_id)

    async def list_posts_with_targets(
        self, user_id: str
    ) -> Sequence[tuple[models.Post, list[tuple[models.PostTarget, models.SocialAccount | None]]]]:
        posts = await self.posts.list_for_user(user_id, limit=50)
        enriched = []
        for post in posts:
            targets = await self.posts.get_targets(post.id)
            accounts = await self.posts.list_accounts_by_target_ids(
                [target.social_account_id for target in targets]
            )
            by_id = {account.id: account for account in accounts}
            enriched.append(
                (
                    post,
                    [(target, by_id.get(target.social_account_id)) for target in targets],
                )
            )
        return enriched
