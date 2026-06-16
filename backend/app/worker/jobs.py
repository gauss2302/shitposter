from __future__ import annotations

import asyncio
import base64
import json
import mimetypes
import secrets
from datetime import datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select

from app.application.recipe_service import advance_next_run
from app.core.config import Settings, get_settings
from app.domain.enums import VideoJobStatus, VideoProvider
from app.infrastructure.crypto import decrypt, encrypt
from app.infrastructure.db import models
from app.infrastructure.db.repositories import VideoRecipeRepository
from app.infrastructure.db.session import async_session_factory
from app.infrastructure.external.instagram import (
    create_reel_container,
    fetch_container_status,
    publish_reel_container,
    refresh_instagram_token,
)
from app.infrastructure.external.linkedin import publish_to_linkedin
from app.infrastructure.external.tiktok import (
    post_video_directly,
    refresh_tiktok_token,
    upload_video_to_inbox,
)
from app.infrastructure.external.twitter import post_tweet, refresh_twitter_token
from app.infrastructure.external.twitter_oauth1 import upload_media_to_twitter
from app.infrastructure.external.video_replicate import (
    ReplicateApiError,
    create_replicate_prediction,
    extract_video_url,
    get_replicate_prediction,
)
from app.infrastructure.queue import enqueue_poll_video_job, enqueue_publish_job
from app.infrastructure.storage import StorageNotConfigured, get_storage

# Instagram Reels container processing window. Short Reels typically finish
# within 30s; we cap polling at ~2.5min so we don't outlive the ARQ
# job_timeout (300s) and leave headroom for the publish call itself.
_IG_CONTAINER_POLL_INTERVAL_SECS = 5
_IG_CONTAINER_POLL_MAX_ATTEMPTS = 30

# Video generation re-enqueue delays: short while submitting, longer once
# the provider has accepted the job. Total budget across re-enqueues caps
# at ~1 hour for Kling-class models that finish in 1–5 minutes.
_VIDEO_POLL_INITIAL_DEFER_SECS = 5
_VIDEO_POLL_PROCESSING_DEFER_SECS = 15
_VIDEO_POLL_MAX_AGE_SECS = 60 * 60


async def publish_post(ctx: dict[str, Any], payload: dict[str, Any]) -> dict[str, str]:
    """ARQ job entrypoint for publishing a single post target."""

    async with async_session_factory() as session:
        target = await session.get(models.PostTarget, payload["target_id"])
        if target is None:
            # Post was hard-deleted between enqueue and execution; nothing
            # left to do.
            return {"status": "skipped:target_missing"}

        post = await session.get(models.Post, payload["post_id"])
        if post is None:
            return {"status": "skipped:post_missing"}

        # Cancellation guard — set by ``PostsService.cancel_scheduled_post``.
        if post.status == "cancelled" or target.status == "cancelled":
            if target.status != "cancelled":
                target.status = "cancelled"
                await session.commit()
            return {"status": "skipped:cancelled"}

        # Stale-dispatch guard — public-API PATCH rotates dispatch_token
        # when scheduled_for changes, so the previously enqueued job no
        # longer matches the row and must no-op. Legacy rows with NULL
        # token + missing payload token still publish (back-compat).
        payload_token = payload.get("dispatch_token")
        if target.dispatch_token and payload_token and payload_token != target.dispatch_token:
            return {"status": "skipped:stale_dispatch"}

        # Idempotency — re-firing a job (manual retry, ARQ duplicate) for a
        # target that already succeeded should not double-post.
        if target.status == "published":
            return {"status": "already_published"}

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
            access_token = await _refresh_token_if_needed(account, access_token, settings)
            if account.token_expires_at and account.token_expires_at < datetime.utcnow():
                # Refresh failed silently or token genuinely cannot be refreshed.
                account.is_active = False
                raise RuntimeError("Token expired and cannot be refreshed")
            await session.flush()

            if account.platform == "twitter":
                platform_post_id = await _publish_twitter(
                    account=account,
                    access_token=access_token,
                    content=content,
                    payload=payload,
                    settings=settings,
                )
            elif account.platform == "linkedin":
                platform_post_id = await publish_to_linkedin(
                    access_token=access_token,
                    account_id=account.platform_user_id,
                    content=content,
                )
            elif account.platform == "tiktok":
                platform_post_id = await _publish_tiktok(
                    account=account,
                    access_token=access_token,
                    content=content,
                    payload=payload,
                    settings=settings,
                )
            elif account.platform == "instagram":
                platform_post_id = await _publish_instagram(
                    account=account,
                    access_token=access_token,
                    content=content,
                    payload=payload,
                    settings=settings,
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


# ---------- Token refresh ----------


async def _refresh_token_if_needed(
    account: models.SocialAccount,
    access_token: str,
    settings: Settings,
) -> str:
    if not account.token_expires_at or account.token_expires_at >= datetime.utcnow():
        return access_token

    if account.platform == "twitter" and account.refresh_token:
        tokens = await refresh_twitter_token(
            refresh_token=decrypt(account.refresh_token),
            client_id=settings.twitter_client_id,
            client_secret=settings.twitter_client_secret,
        )
        return _persist_oauth2_refresh(
            account,
            str(tokens["access_token"]),
            tokens.get("refresh_token"),
            tokens.get("expires_in"),
        )

    if account.platform == "tiktok" and account.refresh_token:
        tokens = await refresh_tiktok_token(
            refresh_token=decrypt(account.refresh_token),
            client_key=settings.tiktok_client_key,
            client_secret=settings.tiktok_client_secret,
        )
        new_token = _persist_oauth2_refresh(
            account,
            str(tokens["access_token"]),
            tokens.get("refresh_token"),
            tokens.get("expires_in"),
        )
        if tokens.get("scope"):
            account.granted_scopes = str(tokens["scope"])
        return new_token

    if account.platform == "instagram":
        # IG long-lived tokens refresh themselves (no separate refresh_token).
        tokens = await refresh_instagram_token(access_token=access_token)
        new_token = str(tokens["access_token"])
        account.access_token = encrypt(new_token)
        account.refresh_token = encrypt(new_token)
        expires_in = tokens.get("expires_in")
        if expires_in:
            account.token_expires_at = datetime.utcnow() + timedelta(seconds=int(expires_in))
        return new_token

    return access_token


def _persist_oauth2_refresh(
    account: models.SocialAccount,
    access_token: str,
    refresh_token: object,
    expires_in: object,
) -> str:
    account.access_token = encrypt(access_token)
    if refresh_token:
        account.refresh_token = encrypt(str(refresh_token))
    if isinstance(expires_in, int) or (isinstance(expires_in, str) and expires_in.isdigit()):
        account.token_expires_at = datetime.utcnow() + timedelta(seconds=int(expires_in))
    return access_token


# ---------- Per-platform publish ----------


async def _publish_twitter(
    *,
    account: models.SocialAccount,
    access_token: str,
    content: str,
    payload: dict[str, Any],
    settings: Settings,
) -> str:
    media_ids: list[str] = []
    media_payload = list(payload.get("media_data") or [])
    # Public API uploads media to R2 and passes a URL instead of base64.
    # Twitter's image-upload endpoint needs bytes, so fetch them on demand.
    if not media_payload:
        media_url = payload.get("media_url")
        if isinstance(media_url, str) and media_url:
            async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
                response = await client.get(media_url, follow_redirects=True)
                response.raise_for_status()
                media_payload = [
                    {
                        "data": base64.b64encode(response.content).decode(),
                        "mimeType": response.headers.get("content-type") or "image/jpeg",
                    }
                ]
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
    return await post_tweet(
        access_token=access_token,
        content=content,
        media_ids=media_ids,
    )


async def _publish_tiktok(
    *,
    account: models.SocialAccount,
    access_token: str,
    content: str,
    payload: dict[str, Any],
    settings: Settings,
) -> str:
    video_url = await _ensure_video_url(payload, settings, key_prefix=f"posts/{payload['post_id']}")
    granted = (account.granted_scopes or "").split(",")
    if "video.publish" in granted:
        return await post_video_directly(
            access_token=access_token,
            video_url=video_url,
            # TikTok caption / title limit is 2200 chars.
            title=content[:2200],
            privacy_level="PUBLIC_TO_EVERYONE",
        )
    return await upload_video_to_inbox(access_token=access_token, video_url=video_url)


async def _publish_instagram(
    *,
    account: models.SocialAccount,
    access_token: str,
    content: str,
    payload: dict[str, Any],
    settings: Settings,
) -> str:
    video_url = await _ensure_video_url(payload, settings, key_prefix=f"posts/{payload['post_id']}")
    container_id = await create_reel_container(
        access_token=access_token,
        ig_user_id=account.platform_user_id,
        video_url=video_url,
        caption=content,
    )
    await _wait_for_ig_container(access_token=access_token, container_id=container_id)
    return await publish_reel_container(
        access_token=access_token,
        ig_user_id=account.platform_user_id,
        container_id=container_id,
    )


async def _wait_for_ig_container(*, access_token: str, container_id: str) -> None:
    for _ in range(_IG_CONTAINER_POLL_MAX_ATTEMPTS):
        status = await fetch_container_status(
            access_token=access_token, container_id=container_id
        )
        if status == "FINISHED":
            return
        if status in {"ERROR", "EXPIRED"}:
            raise RuntimeError(f"Instagram container {container_id} {status}")
        await asyncio.sleep(_IG_CONTAINER_POLL_INTERVAL_SECS)
    raise RuntimeError(f"Instagram container {container_id} did not finish in time")


# ---------- Media URL resolution ----------


async def _ensure_video_url(
    payload: dict[str, Any],
    settings: Settings,
    *,
    key_prefix: str,
) -> str:
    """Return a publicly fetchable video URL for PULL_FROM_URL platforms.

    Prefers ``payload['media_url']`` if present (set by the upload endpoint
    in phase 1e). Falls back to base64-encoded ``media_data`` by uploading
    to R2 here.
    """
    media_url = payload.get("media_url")
    if isinstance(media_url, str) and media_url:
        return media_url
    media_data = payload.get("media_data") or []
    if not media_data:
        raise RuntimeError("Video media is required for TikTok / Instagram targets")
    item = media_data[0]
    raw = base64.b64decode(str(item["data"]))
    mime_type = str(item.get("mimeType") or "video/mp4")
    try:
        storage = get_storage(settings)
    except StorageNotConfigured as exc:
        raise RuntimeError(
            "Cloudflare R2 is not configured; cannot host video for TikTok / Instagram"
        ) from exc
    extension = _extension_for_mime(mime_type)
    key = f"{key_prefix}/{secrets.token_urlsafe(8)}{extension}"
    stored = await storage.upload_bytes(data=raw, key=key, content_type=mime_type)
    return stored.url


def _extension_for_mime(mime_type: str) -> str:
    if "mp4" in mime_type:
        return ".mp4"
    if "quicktime" in mime_type or "mov" in mime_type:
        return ".mov"
    if "webm" in mime_type:
        return ".webm"
    return ".bin"


# ---------- Cross-target post status reconciliation ----------


async def poll_video_job(ctx: dict[str, Any], payload: dict[str, Any]) -> dict[str, str]:
    """ARQ job that drives one step of a video generation lifecycle.

    Submits the job to the provider on first run (when ``provider_job_id``
    is empty), then re-enqueues itself until the provider returns a
    terminal state. On success the rendered video is mirrored to R2 and the
    public URL persisted on the job row.
    """

    async with async_session_factory() as session:
        job = await session.get(models.VideoGenerationJob, payload["job_id"])
        if job is None:
            raise RuntimeError(f"Video job {payload['job_id']} not found")
        if job.status in {
            VideoJobStatus.UPLOADED.value,
            VideoJobStatus.FAILED.value,
            VideoJobStatus.CANCELED.value,
        }:
            return {"status": job.status}
        if (datetime.utcnow() - job.created_at).total_seconds() > _VIDEO_POLL_MAX_AGE_SECS:
            await _mark_video_failed(session, job, "Provider did not finish in time")
            return {"status": job.status}

        settings = get_settings()
        try:
            if job.provider == VideoProvider.REPLICATE.value:
                await _step_replicate_job(session, job, settings)
            else:
                await _mark_video_failed(session, job, f"Unsupported provider: {job.provider}")
                return {"status": job.status}
        except (ReplicateApiError, StorageNotConfigured, httpx.HTTPError) as exc:
            await _mark_video_failed(session, job, str(exc))
            return {"status": job.status}

        # If the job just hit UPLOADED and was triggered by a recipe, chain
        # into publishing so the cron-driven flow is end-to-end.
        await _maybe_chain_recipe_publish(session, job)
        await session.commit()

    if job.status not in {
        VideoJobStatus.UPLOADED.value,
        VideoJobStatus.FAILED.value,
        VideoJobStatus.CANCELED.value,
    }:
        defer = (
            _VIDEO_POLL_INITIAL_DEFER_SECS
            if not job.provider_job_id
            else _VIDEO_POLL_PROCESSING_DEFER_SECS
        )
        await enqueue_poll_video_job({"job_id": job.id}, defer_seconds=defer)
    return {"status": job.status}


async def _step_replicate_job(
    session: Any,
    job: models.VideoGenerationJob,
    settings: Settings,
) -> None:
    if not settings.replicate_api_token:
        raise ReplicateApiError("Replicate API token is not configured")

    if not job.provider_job_id:
        params = json.loads(job.params_json) if job.params_json else {}
        if not isinstance(params, dict):
            params = {}
        input_payload: dict[str, Any] = {"prompt": job.prompt, **params}
        prediction = await create_replicate_prediction(
            api_token=settings.replicate_api_token,
            model=job.model,
            input=input_payload,
        )
        job.provider_job_id = str(prediction.get("id") or "")
        job.status = VideoJobStatus.PROCESSING.value
        job.started_at = datetime.utcnow()
        job.updated_at = datetime.utcnow()
        return

    prediction = await get_replicate_prediction(
        api_token=settings.replicate_api_token,
        prediction_id=job.provider_job_id,
    )
    status_str = str(prediction.get("status") or "")
    if status_str == "succeeded":
        url = extract_video_url(prediction.get("output"))
        if not url:
            raise ReplicateApiError("Replicate prediction succeeded but produced no URL")
        job.provider_output_url = url
        job.status = VideoJobStatus.DOWNLOADING.value
        job.updated_at = datetime.utcnow()
        await _mirror_video_to_r2(job, url, settings)
    elif status_str in {"failed", "canceled"}:
        error = prediction.get("error") or status_str
        if status_str == "canceled":
            job.status = VideoJobStatus.CANCELED.value
        else:
            job.status = VideoJobStatus.FAILED.value
        job.error_message = str(error) if error else status_str
        job.completed_at = datetime.utcnow()
        job.updated_at = datetime.utcnow()
    else:
        # starting / processing — keep the timestamps fresh and re-enqueue.
        job.updated_at = datetime.utcnow()


async def _mirror_video_to_r2(
    job: models.VideoGenerationJob,
    source_url: str,
    settings: Settings,
) -> None:
    storage = get_storage(settings)
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        response = await client.get(source_url, follow_redirects=True)
        response.raise_for_status()
        content_type = response.headers.get("content-type") or "video/mp4"
        data = response.content
    extension = mimetypes.guess_extension(content_type.split(";", 1)[0].strip()) or ".mp4"
    key = f"videos/{job.user_id}/{job.id}{extension}"
    stored = await storage.upload_bytes(data=data, key=key, content_type=content_type)
    job.output_url = stored.url
    job.output_key = stored.key
    job.status = VideoJobStatus.UPLOADED.value
    job.completed_at = datetime.utcnow()
    job.updated_at = datetime.utcnow()


async def _maybe_chain_recipe_publish(
    session: Any, job: models.VideoGenerationJob
) -> None:
    """If the job came from a recipe, create a Post + PostTargets and
    enqueue publishing for each target social account."""
    if job.status != VideoJobStatus.UPLOADED.value or not job.output_url:
        return
    metadata_raw = job.metadata_json
    if not metadata_raw:
        return
    try:
        metadata = json.loads(metadata_raw)
    except json.JSONDecodeError:
        return
    if not isinstance(metadata, dict):
        return
    target_ids = metadata.get("targetSocialAccountIds")
    if not isinstance(target_ids, list) or not target_ids:
        return
    caption = str(metadata.get("caption") or "")

    post_id = secrets.token_urlsafe(16)
    post = models.Post(
        id=post_id,
        user_id=job.user_id,
        content=caption,
        media_urls=[job.output_url],
        scheduled_for=None,
        status="publishing",
    )
    session.add(post)
    targets: list[models.PostTarget] = []
    for account_id in target_ids:
        if not isinstance(account_id, str):
            continue
        target = models.PostTarget(
            id=secrets.token_urlsafe(16),
            post_id=post_id,
            social_account_id=account_id,
            status="pending",
            dispatch_token=secrets.token_urlsafe(16),
        )
        targets.append(target)
        session.add(target)
    await session.flush()

    for target in targets:
        await enqueue_publish_job(
            {
                "post_id": post_id,
                "user_id": job.user_id,
                "target_id": target.id,
                "social_account_id": target.social_account_id,
                "content": caption,
                "media_url": job.output_url,
                "dispatch_token": target.dispatch_token,
            },
            scheduled_for=None,
        )

    recipe_id = metadata.get("recipeId")
    if isinstance(recipe_id, str):
        recipe = await session.get(models.VideoRecipe, recipe_id)
        if recipe is not None:
            recipe.last_run_at = datetime.utcnow()
            recipe.last_run_job_id = job.id
            recipe.updated_at = datetime.utcnow()


async def recipe_scheduler(ctx: dict[str, Any]) -> dict[str, int]:
    """ARQ cron entrypoint — fires every minute and dispatches due recipes."""
    async with async_session_factory() as session:
        repo = VideoRecipeRepository(session)
        due = await repo.list_due(now=datetime.utcnow())
        dispatched = 0
        for recipe in due:
            recipe.next_run_at = advance_next_run(
                frequency=recipe.frequency, anchor=datetime.utcnow()
            )
            recipe.updated_at = datetime.utcnow()
            dispatched += 1
        await session.commit()
        for recipe in due:
            await _enqueue_run_recipe(recipe.id)
    return {"dispatched": dispatched}


async def _enqueue_run_recipe(recipe_id: str) -> None:
    from app.infrastructure.queue import get_queue_pool

    pool = await get_queue_pool()
    try:
        await pool.enqueue_job("run_recipe", {"recipe_id": recipe_id}, _defer_by=1)
    finally:
        await pool.aclose()


async def run_recipe(ctx: dict[str, Any], payload: dict[str, Any]) -> dict[str, str]:
    """Submit a video generation job for the recipe and chain into polling.

    The recipe id and its target accounts are stored on the job's
    ``metadata_json`` so :func:`poll_video_job` can finish the cycle by
    creating a Post + PostTargets when the asset is in R2.
    """
    async with async_session_factory() as session:
        recipe = await session.get(models.VideoRecipe, payload["recipe_id"])
        if recipe is None or not recipe.is_active:
            return {"status": "skipped"}

        try:
            params = json.loads(recipe.params_json or "{}")
        except json.JSONDecodeError:
            params = {}
        try:
            target_ids = json.loads(recipe.target_social_account_ids_json or "[]")
        except json.JSONDecodeError:
            target_ids = []
        if not isinstance(target_ids, list) or not target_ids:
            recipe.is_active = False
            recipe.updated_at = datetime.utcnow()
            await session.commit()
            return {"status": "skipped_no_targets"}

        now = datetime.utcnow()
        job = models.VideoGenerationJob(
            id=secrets.token_urlsafe(16),
            user_id=recipe.user_id,
            provider=recipe.provider,
            model=recipe.model,
            prompt=recipe.prompt,
            params_json=json.dumps(params if isinstance(params, dict) else {}),
            status=VideoJobStatus.QUEUED.value,
            metadata_json=json.dumps(
                {
                    "recipeId": recipe.id,
                    "targetSocialAccountIds": [str(x) for x in target_ids],
                    "caption": recipe.caption_template or "",
                }
            ),
            created_at=now,
            updated_at=now,
        )
        session.add(job)
        recipe.last_run_job_id = job.id
        recipe.updated_at = now
        await session.commit()

    await enqueue_poll_video_job({"job_id": job.id})
    return {"status": "queued", "jobId": job.id}


async def _mark_video_failed(
    session: Any,
    job: models.VideoGenerationJob,
    message: str,
) -> None:
    job.status = VideoJobStatus.FAILED.value
    job.error_message = message
    job.completed_at = datetime.utcnow()
    job.updated_at = datetime.utcnow()
    await session.commit()


async def _update_post_status(session: Any, post_id: str) -> None:
    post = await session.get(models.Post, post_id)
    if post is None:
        return
    if post.status == "cancelled":
        # A user-initiated cancellation outranks any worker reconciliation.
        return
    result = await session.execute(
        select(models.PostTarget).where(models.PostTarget.post_id == post_id)
    )
    statuses = [target.status for target in result.scalars().all()]
    active = [status for status in statuses if status != "cancelled"]
    if not active:
        return
    if all(status == "published" for status in active):
        post.status = "published"
    elif any(status == "failed" for status in active):
        post.status = "published" if any(status == "published" for status in active) else "failed"
    elif any(status == "publishing" for status in active):
        post.status = "publishing"
    else:
        post.status = "scheduled"
    post.updated_at = datetime.utcnow()
