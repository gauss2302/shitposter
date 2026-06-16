"""TikTok Login Kit OAuth + Content Posting API adapter.

OAuth 2.0 v2 with authorization-code grant (no PKCE for our confidential
server-side client).

* Authorize URL: ``https://www.tiktok.com/v2/auth/authorize/`` — note the
  parameter is ``client_key`` (not ``client_id``) and scopes are comma
  separated.
* Token endpoint: ``POST https://open.tiktokapis.com/v2/oauth/token/``.

Token lifetimes:

* ``access_token``: 86400s (24h)
* ``refresh_token``: 31536000s (365d), and rotates on every refresh —
  callers must persist the newly returned refresh_token.

Content Posting API:

* **Inbox** ``POST /v2/post/publish/inbox/video/init/`` (scope ``video.upload``)
  uploads to the user's TikTok drafts/inbox; the user finishes the post
  inside the TikTok app. **Does not require app audit.**
* **Direct Post** ``POST /v2/post/publish/video/init/`` (scope
  ``video.publish``) auto-publishes to the user's feed. **Requires audit
  approval** of the developer app.
* Status: ``POST /v2/post/publish/status/fetch/``.

PULL_FROM_URL constraint: TikTok requires the video URL's domain prefix
to be added to the developer app's "Verified Properties". The Cloudflare
R2 public base URL (or the bucket endpoint) must be on that list.
"""

from __future__ import annotations

from typing import Any

import httpx

_DEFAULT_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
_OAUTH_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/"
_INBOX_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/"
_DIRECT_POST_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/"
_PUBLISH_STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/"

USER_INFO_FIELDS = "open_id,union_id,avatar_url,display_name,username"


class TikTokApiError(RuntimeError):
    """Raised when TikTok returns a non-success response."""


async def exchange_tiktok_code(
    *,
    code: str,
    redirect_uri: str,
    client_key: str,
    client_secret: str,
) -> dict[str, Any]:
    """Exchange an authorization code for access + refresh tokens."""
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.post(
            _OAUTH_TOKEN_URL,
            data={
                "client_key": client_key,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    return _parse_oauth_response(response)


async def refresh_tiktok_token(
    *,
    refresh_token: str,
    client_key: str,
    client_secret: str,
) -> dict[str, Any]:
    """Refresh an expired access token. Returns a new (access_token,
    refresh_token, expires_in, scope, open_id, ...) bundle.

    The refresh_token may rotate; callers must persist whatever value comes
    back in the response.
    """
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.post(
            _OAUTH_TOKEN_URL,
            data={
                "client_key": client_key,
                "client_secret": client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    return _parse_oauth_response(response)


async def fetch_tiktok_user_info(*, access_token: str) -> dict[str, Any]:
    """Fetch the connected user's profile (open_id, display_name, ...)."""
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.get(
            _USER_INFO_URL,
            params={"fields": USER_INFO_FIELDS},
            headers={"Authorization": f"Bearer {access_token}"},
        )
    data = _parse_envelope_response(response)
    user = data.get("user")
    if not isinstance(user, dict):
        raise TikTokApiError("TikTok user info missing 'user' object")
    return user


async def upload_video_to_inbox(
    *,
    access_token: str,
    video_url: str,
) -> str:
    """Send a video to the user's TikTok Inbox via PULL_FROM_URL.

    Returns the ``publish_id``. The user must open the TikTok app to
    finish editing and post. Works without app audit.
    """
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.post(
            _INBOX_INIT_URL,
            json={
                "source_info": {"source": "PULL_FROM_URL", "video_url": video_url},
            },
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
        )
    data = _parse_envelope_response(response)
    publish_id = data.get("publish_id")
    if not isinstance(publish_id, str) or not publish_id:
        raise TikTokApiError("TikTok inbox upload returned no publish_id")
    return publish_id


async def post_video_directly(
    *,
    access_token: str,
    video_url: str,
    title: str,
    privacy_level: str = "PUBLIC_TO_EVERYONE",
    disable_duet: bool = False,
    disable_comment: bool = False,
    disable_stitch: bool = False,
    video_cover_timestamp_ms: int | None = None,
) -> str:
    """Auto-publish a video to TikTok via PULL_FROM_URL. Requires app audit."""
    post_info: dict[str, Any] = {
        "title": title,
        "privacy_level": privacy_level,
        "disable_duet": disable_duet,
        "disable_comment": disable_comment,
        "disable_stitch": disable_stitch,
    }
    if video_cover_timestamp_ms is not None:
        post_info["video_cover_timestamp_ms"] = video_cover_timestamp_ms
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.post(
            _DIRECT_POST_INIT_URL,
            json={
                "post_info": post_info,
                "source_info": {"source": "PULL_FROM_URL", "video_url": video_url},
            },
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
            },
        )
    data = _parse_envelope_response(response)
    publish_id = data.get("publish_id")
    if not isinstance(publish_id, str) or not publish_id:
        raise TikTokApiError("TikTok direct post returned no publish_id")
    return publish_id


async def fetch_publish_status(
    *,
    access_token: str,
    publish_id: str,
) -> dict[str, Any]:
    """Query the status of a previously initiated publish operation."""
    async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
        response = await client.post(
            _PUBLISH_STATUS_URL,
            json={"publish_id": publish_id},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
        )
    return _parse_envelope_response(response)


def _parse_oauth_response(response: httpx.Response) -> dict[str, Any]:
    """OAuth token responses are flat (no ``data`` envelope)."""
    body = _safe_json(response)
    error = body.get("error")
    if response.status_code >= 400 or (error and error not in ("", "ok")):
        msg = (
            body.get("error_description")
            or (error if isinstance(error, str) else None)
            or response.text
        )
        raise TikTokApiError(f"TikTok OAuth failed: {msg}")
    return body


def _parse_envelope_response(response: httpx.Response) -> dict[str, Any]:
    """Content Posting + user.info responses use a {data, error} envelope."""
    body = _safe_json(response)
    error = body.get("error") or {}
    code = error.get("code") if isinstance(error, dict) else None
    if response.status_code >= 400 or (code and code != "ok"):
        msg = error.get("message") if isinstance(error, dict) else None
        raise TikTokApiError(f"TikTok API error ({code}): {msg or response.text}")
    data = body.get("data")
    if not isinstance(data, dict):
        raise TikTokApiError("TikTok API response missing 'data' object")
    return data


def _safe_json(response: httpx.Response) -> dict[str, Any]:
    try:
        body = response.json()
    except ValueError as exc:
        raise TikTokApiError(
            f"TikTok returned non-JSON ({response.status_code}): {response.text[:200]}"
        ) from exc
    if not isinstance(body, dict):
        raise TikTokApiError(f"TikTok returned non-object JSON: {body!r}")
    return body
