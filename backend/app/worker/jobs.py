from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select

from app.infrastructure.crypto import decrypt
from app.infrastructure.db import models
from app.infrastructure.db.session import async_session_factory
from app.infrastructure.external.linkedin import publish_to_linkedin
from app.infrastructure.external.twitter import post_tweet


async def publish_post(ctx: dict[str, Any], payload: dict[str, Any]) -> dict[str, str]:
    """ARQ job entrypoint for publishing a single post target."""

    async with async_session_factory() as session:
        target = await session.get(models.PostTarget, payload["target_id"])
        if target is None:
            raise RuntimeError(f"Post target {payload['target_id']} not found")

        target.status = "publishing"
        await session.flush()

        account = await session.get(models.SocialAccount, payload["social_account_id"])
        if account is None:
            raise RuntimeError(f"Social account {payload['social_account_id']} not found")
        if not account.is_active:
            raise RuntimeError(f"Social account {account.id} is not active")

        try:
            access_token = decrypt(account.access_token)
            content = str(payload.get("content") or "")
            if account.platform == "twitter":
                platform_post_id = await post_tweet(access_token, content)
            elif account.platform == "linkedin":
                platform_post_id = await publish_to_linkedin(
                    access_token,
                    account.platform_user_id,
                    content,
                )
            else:
                raise RuntimeError(f"Unsupported platform: {account.platform}")

            target.status = "published"
            target.platform_post_id = platform_post_id
            target.published_at = datetime.utcnow()
            target.error_message = None
            await _update_post_status(session, target.post_id)
            await session.commit()
            return {"platformPostId": platform_post_id}
        except Exception as exc:
            target.status = "failed"
            target.error_message = str(exc)
            await _update_post_status(session, target.post_id)
            await session.commit()
            raise


async def _update_post_status(session: Any, post_id: str) -> None:
    post = await session.get(models.Post, post_id)
    if post is None:
        return
    result = await session.execute(
        select(models.PostTarget).where(models.PostTarget.post_id == post_id)
    )
    statuses = [target.status for target in result.scalars().all()]
    if statuses and all(status == "published" for status in statuses):
        post.status = "published"
    elif any(status == "failed" for status in statuses):
        post.status = "published" if any(status == "published" for status in statuses) else "failed"
    elif any(status == "publishing" for status in statuses):
        post.status = "publishing"
    else:
        post.status = "scheduled"
    post.updated_at = datetime.utcnow()

