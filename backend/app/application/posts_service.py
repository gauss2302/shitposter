from __future__ import annotations

import base64
import json
import secrets
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.exceptions import ConflictError, NotFoundError, ValidationError
from app.infrastructure.db import models
from app.infrastructure.db.repositories import PostRepository, SocialAccountRepository
from app.infrastructure.queue import enqueue_publish_job

SUPPORTED_PUBLISHING_PLATFORMS = {"twitter", "linkedin", "tiktok", "instagram"}

# Statuses that mean "not yet handed to the platform". Mutations on a post
# are only safe while every target is still in one of these.
_EDITABLE_POST_STATUSES = {"scheduled"}
_EDITABLE_TARGET_STATUSES = {"pending"}


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
        media: Sequence[MediaInput] = (),
        media_urls: Sequence[str] = (),
    ) -> CreatedPost:
        content = content or ""
        if not content.strip() and not media and not media_urls:
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
                f"Posting is not yet supported for these accounts: {names}"
            )

        scheduled_for = self._parse_scheduled_for(scheduled_for_raw)
        post_id = new_id()
        post = await self.posts.add(
            models.Post(
                id=post_id,
                user_id=user_id,
                content=content,
                media_urls=list(media_urls),
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
                dispatch_token=uuid4().hex,
            )
            for account in accounts
        ]
        await self.posts.add_targets(targets)
        await self.session.commit()

        for target, account in zip(targets, accounts, strict=True):
            payload = _build_publish_payload(
                post_id=post_id,
                user_id=user_id,
                target=target,
                account_id=account.id,
                content=content,
                media=media,
                media_urls=media_urls,
            )
            await enqueue_publish_job(payload, scheduled_for=scheduled_for)

        return CreatedPost(
            post=post,
            target_count=len(targets),
            media_count=len(media) + len(media_urls),
        )

    async def update_scheduled_post(
        self,
        *,
        user_id: str,
        post_id: str,
        content: str | None = None,
        scheduled_for_raw: str | None = None,
    ) -> models.Post:
        if content is None and scheduled_for_raw is None:
            raise ValidationError("No mutable fields provided")
        post = await self.posts.get_owned(post_id, user_id)
        if post is None:
            raise NotFoundError("Post not found")
        if post.status not in _EDITABLE_POST_STATUSES:
            raise ConflictError(f"Cannot edit post in status '{post.status}'")
        targets = list(await self.posts.get_targets(post.id))
        if any(target.status not in _EDITABLE_TARGET_STATUSES for target in targets):
            raise ConflictError("One or more targets already started publishing")

        reschedule = False
        new_scheduled_for: datetime | None = post.scheduled_for
        if scheduled_for_raw is not None:
            new_scheduled_for = self._parse_scheduled_for(scheduled_for_raw)
            if new_scheduled_for is None:
                raise ValidationError(
                    "Scheduled date must be in the future for a scheduled post"
                )
            if new_scheduled_for != post.scheduled_for:
                reschedule = True

        if content is not None:
            stripped = content
            if not stripped.strip() and not (post.media_urls or []):
                raise ValidationError("Content or media is required")
            post.content = content

        if reschedule:
            post.scheduled_for = new_scheduled_for

        post.updated_at = datetime.now(UTC).replace(tzinfo=None)

        if reschedule:
            for target in targets:
                target.dispatch_token = uuid4().hex

        await self.session.commit()

        if reschedule:
            accounts = await self.posts.list_accounts_by_target_ids(
                [target.social_account_id for target in targets]
            )
            account_by_id = {account.id: account for account in accounts}
            for target in targets:
                account = account_by_id.get(target.social_account_id)
                if account is None:
                    continue
                payload = _build_publish_payload(
                    post_id=post.id,
                    user_id=user_id,
                    target=target,
                    account_id=account.id,
                    content=post.content,
                    media=(),
                    media_urls=tuple(post.media_urls or ()),
                )
                await enqueue_publish_job(payload, scheduled_for=new_scheduled_for)

        return post

    async def cancel_scheduled_post(self, *, user_id: str, post_id: str) -> models.Post:
        post = await self.posts.get_owned(post_id, user_id)
        if post is None:
            raise NotFoundError("Post not found")
        if post.status not in _EDITABLE_POST_STATUSES:
            raise ConflictError(f"Cannot cancel post in status '{post.status}'")
        targets = list(await self.posts.get_targets(post.id))
        if any(target.status not in _EDITABLE_TARGET_STATUSES for target in targets):
            raise ConflictError("One or more targets already started publishing")
        now = datetime.now(UTC).replace(tzinfo=None)
        post.status = "cancelled"
        post.updated_at = now
        for target in targets:
            target.status = "cancelled"
        await self.session.commit()
        return post

    async def list_posts_paginated(
        self,
        user_id: str,
        *,
        limit: int = 50,
        cursor: tuple[datetime, str] | None = None,
        status: str | None = None,
    ) -> tuple[
        Sequence[tuple[models.Post, list[tuple[models.PostTarget, models.SocialAccount | None]]]],
        tuple[datetime, str] | None,
    ]:
        clamped_limit = max(1, min(limit, 100))
        posts = await self.posts.list_for_user_paginated(
            user_id, limit=clamped_limit + 1, cursor=cursor, status=status
        )
        posts_list = list(posts)
        next_cursor: tuple[datetime, str] | None = None
        if len(posts_list) > clamped_limit:
            anchor = posts_list[clamped_limit - 1]
            next_cursor = (anchor.created_at, anchor.id)
            posts_list = posts_list[:clamped_limit]
        enriched: list[
            tuple[models.Post, list[tuple[models.PostTarget, models.SocialAccount | None]]]
        ] = []
        for post in posts_list:
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
        return enriched, next_cursor

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


def _build_publish_payload(
    *,
    post_id: str,
    user_id: str,
    target: models.PostTarget,
    account_id: str,
    content: str,
    media: Sequence[MediaInput],
    media_urls: Sequence[str],
) -> dict[str, object]:
    payload: dict[str, object] = {
        "post_id": post_id,
        "user_id": user_id,
        "target_id": target.id,
        "social_account_id": account_id,
        "content": content,
        "media_data": [
            {"data": item.data, "mimeType": item.mime_type} for item in media
        ],
        "dispatch_token": target.dispatch_token,
    }
    if media_urls:
        # Worker prefers the URL path: avoids re-hosting and keeps
        # ARQ payloads small for video posts.
        payload["media_url"] = media_urls[0]
    return payload


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
