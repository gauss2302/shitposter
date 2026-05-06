from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

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
