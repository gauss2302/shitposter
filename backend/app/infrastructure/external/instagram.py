"""Instagram Login + Graph API adapter for Reels publishing.

This uses the **Instagram Login** flow (introduced 2024) — NOT the legacy
Facebook-Login-for-Business + Page intermediary path. With Instagram Login
the user authenticates directly with their Instagram Business / Creator
account and we get a single token for both reading and publishing.

OAuth:

* Authorize URL: ``https://api.instagram.com/oauth/authorize``
* Token endpoint: ``POST https://api.instagram.com/oauth/access_token``
  (returns a short-lived 1-hour token)
* Long-lived exchange: ``GET https://graph.instagram.com/access_token`` with
  ``grant_type=ig_exchange_token`` (returns a 60-day token)
* Refresh: ``GET https://graph.instagram.com/refresh_access_token`` with
  ``grant_type=ig_refresh_token`` (must be called inside the 60-day window;
  resets the 60-day clock)

Scopes required for Reels publishing:

* ``instagram_business_basic``        — read profile
* ``instagram_business_content_publish`` — publish via the API

Reels publishing is a two-step flow on the Graph API (``graph.instagram.com``):

1. Create container — ``POST /{ig-user-id}/media`` with ``media_type=REELS``,
   ``video_url`` (PULL_FROM_URL — same as TikTok, the URL is fetched by Meta),
   ``caption``, optional ``share_to_feed``.
2. Wait for status — ``GET /{container-id}?fields=status_code`` until
   ``status_code == "FINISHED"`` (typical 30s-2min for short Reels).
3. Publish — ``POST /{ig-user-id}/media_publish`` with ``creation_id``.

The video URL must be publicly accessible to Meta. Cloudflare R2 public
domain (or signed URL with a long enough TTL) works.
"""

from __future__ import annotations

from typing import Any

import httpx

_DEFAULT_TIMEOUT = httpx.Timeout(60.0, connect=10.0)
_GRAPH_API_VERSION = "v23.0"

_OAUTH_SHORT_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
_OAUTH_LONG_TOKEN_URL = "https://graph.instagram.com/access_token"
_OAUTH_REFRESH_URL = "https://graph.instagram.com/refresh_access_token"
_GRAPH_BASE = f"https://graph.instagram.com/{_GRAPH_API_VERSION}"
_USER_INFO_URL = f"https://graph.instagram.com/{_GRAPH_API_VERSION}/me"


class InstagramApiError(RuntimeError):
    """Raised when Instagram returns a non-success response."""


async def exchange_instagram_code(
    *,
    code: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str,
) -> dict[str, Any]:
    """Exchange an authorization code for a short-lived (1-hour) access token.

    Returns dict with ``access_token``, ``user_id``, ``permissions``.
    """
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.post(
            _OAUTH_SHORT_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
                "code": code,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    return _parse_oauth_response(response)


async def exchange_for_long_lived_token(
    *,
    short_lived_token: str,
    client_secret: str,
) -> dict[str, Any]:
    """Trade a short-lived token for a 60-day long-lived token.

    Returns dict with ``access_token``, ``token_type``, ``expires_in``.
    """
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.get(
            _OAUTH_LONG_TOKEN_URL,
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": client_secret,
                "access_token": short_lived_token,
            },
        )
    return _parse_oauth_response(response)


async def refresh_instagram_token(*, access_token: str) -> dict[str, Any]:
    """Refresh a long-lived token. Must be called inside the 60-day window.

    Returns a fresh ``access_token`` + ``expires_in`` (~60 days).
    """
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.get(
            _OAUTH_REFRESH_URL,
            params={
                "grant_type": "ig_refresh_token",
                "access_token": access_token,
            },
        )
    return _parse_oauth_response(response)


async def fetch_instagram_user_info(*, access_token: str) -> dict[str, Any]:
    """Fetch the connected Instagram user (id, username, account_type)."""
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.get(
            _USER_INFO_URL,
            params={
                "fields": "id,username,account_type,profile_picture_url",
                "access_token": access_token,
            },
        )
    return _parse_graph_response(response)


async def create_reel_container(
    *,
    access_token: str,
    ig_user_id: str,
    video_url: str,
    caption: str,
    share_to_feed: bool = True,
    cover_url: str | None = None,
    thumb_offset: int | None = None,
) -> str:
    """Create a Reels container. Returns the container id.

    The container is async-processed by Instagram; poll
    :func:`fetch_container_status` until ``FINISHED`` before publishing.
    """
    payload: dict[str, Any] = {
        "media_type": "REELS",
        "video_url": video_url,
        "caption": caption,
        "share_to_feed": "true" if share_to_feed else "false",
        "access_token": access_token,
    }
    if cover_url:
        payload["cover_url"] = cover_url
    if thumb_offset is not None:
        payload["thumb_offset"] = str(thumb_offset)

    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{_GRAPH_BASE}/{ig_user_id}/media",
            data=payload,
        )
    body = _parse_graph_response(response)
    container_id = body.get("id")
    if not isinstance(container_id, str) or not container_id:
        raise InstagramApiError("Instagram media container creation returned no id")
    return container_id


async def fetch_container_status(
    *,
    access_token: str,
    container_id: str,
) -> str:
    """Return the container's ``status_code``: ``IN_PROGRESS``, ``FINISHED``,
    ``ERROR``, ``EXPIRED``, or ``PUBLISHED``."""
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.get(
            f"{_GRAPH_BASE}/{container_id}",
            params={"fields": "status_code", "access_token": access_token},
        )
    body = _parse_graph_response(response)
    status = body.get("status_code")
    if not isinstance(status, str):
        raise InstagramApiError(
            f"Instagram container status missing status_code: {body!r}"
        )
    return status


async def publish_reel_container(
    *,
    access_token: str,
    ig_user_id: str,
    container_id: str,
) -> str:
    """Publish a previously-created container. Returns the IG media id."""
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.post(
            f"{_GRAPH_BASE}/{ig_user_id}/media_publish",
            data={"creation_id": container_id, "access_token": access_token},
        )
    body = _parse_graph_response(response)
    media_id = body.get("id")
    if not isinstance(media_id, str) or not media_id:
        raise InstagramApiError("Instagram media_publish returned no id")
    return media_id


def _parse_oauth_response(response: httpx.Response) -> dict[str, Any]:
    """OAuth endpoints (api.instagram.com + graph.instagram.com/access_token)
    return either a flat token bundle or an ``error`` object."""
    body = _safe_json(response)
    if response.status_code >= 400 or _has_error_field(body):
        raise InstagramApiError(_format_error(body, response))
    return body


def _parse_graph_response(response: httpx.Response) -> dict[str, Any]:
    """Graph API endpoints return either the resource directly or an
    ``error`` object with ``message`` / ``code`` / ``type``."""
    body = _safe_json(response)
    if response.status_code >= 400 or _has_error_field(body):
        raise InstagramApiError(_format_error(body, response))
    return body


def _safe_json(response: httpx.Response) -> dict[str, Any]:
    try:
        body = response.json()
    except ValueError as exc:
        raise InstagramApiError(
            f"Instagram returned non-JSON ({response.status_code}): "
            f"{response.text[:200]}"
        ) from exc
    if not isinstance(body, dict):
        raise InstagramApiError(f"Instagram returned non-object JSON: {body!r}")
    return body


def _has_error_field(body: dict[str, Any]) -> bool:
    err = body.get("error")
    return bool(err) and (isinstance(err, dict) or isinstance(err, str))


def _format_error(body: dict[str, Any], response: httpx.Response) -> str:
    err = body.get("error")
    if isinstance(err, dict):
        message = err.get("message") or err.get("error_user_msg") or "unknown"
        code = err.get("code") or err.get("type") or response.status_code
        return f"Instagram API error ({code}): {message}"
    if isinstance(err, str):
        description = body.get("error_message") or body.get("error_description") or err
        return f"Instagram API error: {description}"
    return f"Instagram API HTTP {response.status_code}: {response.text[:200]}"
