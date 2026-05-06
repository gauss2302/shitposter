from __future__ import annotations

import base64
from datetime import datetime
from typing import Any

from sqlalchemy import select

from app.core.config import get_settings
from app.infrastructure.crypto import decrypt, encrypt
from app.infrastructure.db import models
from app.infrastructure.db.session import async_session_factory
from app.infrastructure.external.linkedin import publish_to_linkedin
from app.infrastructure.external.twitter import post_tweet, refresh_twitter_token
from app.infrastructure.external.twitter_oauth1 import upload_media_to_twitter


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
            settings = get_settings()
            access_token = decrypt(account.access_token)
            content = str(payload.get("content") or "")
            if account.token_expires_at and account.token_expires_at < datetime.utcnow():
                if account.platform == "twitter" and account.refresh_token:
                    tokens = await refresh_twitter_token(
                        refresh_token=decrypt(account.refresh_token),
                        client_id=settings.twitter_client_id,
                        client_secret=settings.twitter_client_secret,
                    )
                    access_token = tokens["access_token"]
                    account.access_token = encrypt(access_token)
                    if tokens.get("refresh_token"):
                        account.refresh_token = encrypt(str(tokens["refresh_token"]))
                    expires_in = int(tokens.get("expires_in") or 0)
                    if expires_in:
                        from datetime import timedelta

                        account.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                    await session.flush()
                else:
                    account.is_active = False
                    raise RuntimeError("Token expired and cannot be refreshed")

            if account.platform == "twitter":
                media_ids = []
                media_payload = payload.get("media_data") or []
                if media_payload:
                    if not account.access_token_secret:
                        raise RuntimeError("OAuth 1.0a credentials are required for Twitter media")
                    oauth1_token = (
                        decrypt(account.oauth1_access_token)
                        if account.oauth1_access_token
                        else access_token
                    )
                    oauth1_secret = decrypt(account.access_token_secret)
                    for item in media_payload:
                        media_ids.append(
                            await upload_media_to_twitter(
                                media=base64.b64decode(str(item["data"])),
                                mime_type=str(item["mimeType"]),
                                access_token=oauth1_token,
                                access_token_secret=oauth1_secret,
                                consumer_key=settings.twitter_client_id,
                                consumer_secret=settings.twitter_client_secret,
                            )
                        )
                platform_post_id = await post_tweet(
                    access_token=access_token,
                    content=content,
                    media_ids=media_ids,
                )
            elif account.platform == "linkedin":
                platform_post_id = await publish_to_linkedin(
                    access_token=access_token,
                    account_id=account.platform_user_id,
                    content=content,
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

