from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Select, and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import models


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: str) -> models.User | None:
        return await self.session.get(models.User, user_id)

    async def get_by_email(self, email: str) -> models.User | None:
        result = await self.session.execute(
            select(models.User).where(models.User.email == email)
        )
        return result.scalar_one_or_none()

    async def add(self, user: models.User) -> models.User:
        self.session.add(user)
        await self.session.flush()
        return user


class SessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_token(self, token: str) -> models.Session | None:
        result = await self.session.execute(
            select(models.Session).where(models.Session.token == token)
        )
        return result.scalar_one_or_none()

    async def delete_by_token(self, token: str) -> None:
        row = await self.get_by_token(token)
        if row is not None:
            await self.session.delete(row)
            await self.session.flush()


class SubscriptionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_user_id(self, user_id: str) -> models.Subscription | None:
        result = await self.session.execute(
            select(models.Subscription).where(models.Subscription.user_id == user_id)
        )
        return result.scalar_one_or_none()


class SocialAccountRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_user(self, user_id: str) -> Sequence[models.SocialAccount]:
        result = await self.session.execute(
            select(models.SocialAccount)
            .where(models.SocialAccount.user_id == user_id)
            .order_by(desc(models.SocialAccount.created_at))
        )
        return result.scalars().all()

    async def get_owned(self, account_id: str, user_id: str) -> models.SocialAccount | None:
        result = await self.session.execute(
            select(models.SocialAccount).where(
                and_(
                    models.SocialAccount.id == account_id,
                    models.SocialAccount.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_owned_by_ids(
        self, user_id: str, account_ids: Sequence[str]
    ) -> Sequence[models.SocialAccount]:
        if not account_ids:
            return []
        result = await self.session.execute(
            select(models.SocialAccount).where(
                and_(
                    models.SocialAccount.user_id == user_id,
                    models.SocialAccount.id.in_(account_ids),
                )
            )
        )
        return result.scalars().all()

    async def count_by_platform(self, user_id: str, platform: str) -> int:
        result = await self.session.execute(
            select(models.SocialAccount).where(
                and_(
                    models.SocialAccount.user_id == user_id,
                    models.SocialAccount.platform == platform,
                )
            )
        )
        return len(result.scalars().all())


class PostRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_user(
        self, user_id: str, *, limit: int = 50
    ) -> Sequence[models.Post]:
        result = await self.session.execute(
            select(models.Post)
            .where(models.Post.user_id == user_id)
            .order_by(desc(models.Post.created_at))
            .limit(limit)
        )
        return result.scalars().all()

    async def add(self, post: models.Post) -> models.Post:
        self.session.add(post)
        await self.session.flush()
        return post

    async def get_targets(self, post_id: str) -> Sequence[models.PostTarget]:
        result = await self.session.execute(
            select(models.PostTarget).where(models.PostTarget.post_id == post_id)
        )
        return result.scalars().all()

    async def add_targets(self, targets: Sequence[models.PostTarget]) -> None:
        self.session.add_all(targets)
        await self.session.flush()

    async def update_status(self, post_id: str, status: str, updated_at: datetime) -> None:
        post = await self.session.get(models.Post, post_id)
        if post is not None:
            post.status = status
            post.updated_at = updated_at
            await self.session.flush()


def base_select(model: type[models.Base]) -> Select[tuple[models.Base]]:
    """Small helper used by tests and future repositories."""
    return select(model)
