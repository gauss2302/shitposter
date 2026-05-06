from __future__ import annotations

import base64
import json
import secrets
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import NotFoundError, ValidationError
from app.infrastructure.db import models
from app.infrastructure.db.repositories import PostRepository, SocialAccountRepository
from app.infrastructure.queue import enqueue_publish_job

SUPPORTED_PUBLISHING_PLATFORMS = {"twitter", "linkedin"}


@dataclass(frozen=True)
class MediaInput:
    data: str
    mime_type: str


@dataclass(frozen=True)
class CreatedPost:
    post: models.Post
    target_count: int
    media_count: int


def new_id() -> str:
    return secrets.token_urlsafe(16)


class PostsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.posts = PostRepository(session)
        self.social_accounts = SocialAccountRepository(session)

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
            account_by_id = {account.id: account for account in accounts}
            enriched.append(
                (
                    post,
                    [
                        (target, account_by_id.get(target.social_account_id))
                        for target in targets
                    ],
                )
            )
        return enriched

    async def create_post(
        self,
        *,
        user_id: str,
        content: str,
        social_account_ids: Sequence[str],
        scheduled_for_raw: str | None,
        media: Sequence[MediaInput],
    ) -> CreatedPost:
        content = content or ""
        if not content.strip() and not media:
            raise ValidationError("Content or media is required")
        if not social_account_ids:
            raise ValidationError("At least one account is required")

        accounts = await self.social_accounts.list_owned_by_ids(user_id, social_account_ids)
        if len(accounts) != len(set(social_account_ids)):
            raise NotFoundError("One or more accounts not found or not owned by you")

        inactive = [account for account in accounts if not account.is_active]
        if inactive:
            names = ", ".join(account.platform_username for account in inactive)
            raise ValidationError(f"Some accounts are disconnected: {names}")

        unsupported = [
            account
            for account in accounts
            if account.platform not in SUPPORTED_PUBLISHING_PLATFORMS
        ]
        if unsupported:
            names = ", ".join(account.platform_username for account in unsupported)
            raise ValidationError(
                f"Posting is currently limited to X and LinkedIn. Unsupported accounts: {names}"
            )

        scheduled_for = self._parse_scheduled_for(scheduled_for_raw)
        post_id = new_id()
        post = await self.posts.add(
            models.Post(
                id=post_id,
                user_id=user_id,
                content=content,
                media_urls=[],
                scheduled_for=scheduled_for,
                status="scheduled" if scheduled_for else "publishing",
            )
        )
        targets = [
            models.PostTarget(
                id=new_id(),
                post_id=post_id,
                social_account_id=account.id,
                status="pending",
            )
            for account in accounts
        ]
        await self.posts.add_targets(targets)
        await self.session.commit()

        for target, account in zip(targets, accounts, strict=True):
            await enqueue_publish_job(
                {
                    "post_id": post_id,
                    "user_id": user_id,
                    "target_id": target.id,
                    "social_account_id": account.id,
                    "content": content,
                    "media_data": [
                        {"data": item.data, "mimeType": item.mime_type}
                        for item in media
                    ],
                },
                scheduled_for=scheduled_for,
            )

        return CreatedPost(post=post, target_count=len(targets), media_count=len(media))

    def _parse_scheduled_for(self, value: str | None) -> datetime | None:
        if not value:
            return None
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise ValidationError("Invalid scheduled date format") from exc
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(UTC).replace(tzinfo=None)

        now = datetime.now(UTC).replace(tzinfo=None)
        if parsed < now - timedelta(minutes=1):
            return None
        if parsed > now + timedelta(days=365):
            raise ValidationError("Scheduled date cannot be more than 1 year in the future")
        return parsed


async def file_to_media(file: object) -> MediaInput:
    content = await file.read()
    mime_type = getattr(file, "content_type", None) or "application/octet-stream"
    return MediaInput(data=base64.b64encode(content).decode("ascii"), mime_type=mime_type)


def parse_account_ids(value: str | None) -> list[str]:
    if value is None:
        raise ValidationError("Invalid request: socialAccountIds is required")
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValidationError("Invalid socialAccountIds format") from exc
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise ValidationError("Invalid socialAccountIds format")
    return parsed
