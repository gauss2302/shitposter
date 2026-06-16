from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest

from app.infrastructure.external import tiktok
from app.infrastructure.external.tiktok import (
    TikTokApiError,
    exchange_tiktok_code,
    fetch_publish_status,
    fetch_tiktok_user_info,
    post_video_directly,
    refresh_tiktok_token,
    upload_video_to_inbox,
)


def _install_transport(
    monkeypatch: pytest.MonkeyPatch,
    handler: Callable[[httpx.Request], httpx.Response],
) -> list[httpx.Request]:
    """Patch httpx.AsyncClient to use a mock transport, capturing requests."""
    captured: list[httpx.Request] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return handler(request)

    transport = httpx.MockTransport(wrapped)
    real_init = httpx.AsyncClient.__init__

    def patched_init(self: httpx.AsyncClient, **kwargs: Any) -> None:
        kwargs["transport"] = transport
        real_init(self, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "__init__", patched_init)
    return captured


def _form_decode(body: bytes) -> dict[str, str]:
    from urllib.parse import parse_qsl

    return dict(parse_qsl(body.decode()))


# ---------- OAuth ----------


async def test_exchange_tiktok_code_sends_form_and_returns_tokens(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "access_token": "act.123",
                "refresh_token": "rft.456",
                "expires_in": 86400,
                "refresh_expires_in": 31536000,
                "open_id": "open-1",
                "scope": "user.info.basic,video.upload,video.publish",
                "token_type": "Bearer",
            },
        ),
    )

    tokens = await exchange_tiktok_code(
        code="abc", redirect_uri="https://x/cb", client_key="ck", client_secret="cs"
    )

    assert tokens["access_token"] == "act.123"
    assert tokens["open_id"] == "open-1"
    assert len(captured) == 1
    req = captured[0]
    assert str(req.url) == "https://open.tiktokapis.com/v2/oauth/token/"
    assert req.headers["content-type"].startswith("application/x-www-form-urlencoded")
    assert _form_decode(req.content) == {
        "client_key": "ck",
        "client_secret": "cs",
        "code": "abc",
        "grant_type": "authorization_code",
        "redirect_uri": "https://x/cb",
    }


async def test_exchange_tiktok_code_raises_on_oauth_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            400,
            json={"error": "invalid_request", "error_description": "Bad code", "log_id": "L"},
        ),
    )

    with pytest.raises(TikTokApiError, match="Bad code"):
        await exchange_tiktok_code(
            code="x", redirect_uri="https://x/cb", client_key="ck", client_secret="cs"
        )


async def test_refresh_tiktok_token_sends_refresh_grant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "access_token": "act.new",
                "refresh_token": "rft.new",
                "expires_in": 86400,
                "open_id": "open-1",
                "scope": "user.info.basic",
            },
        ),
    )

    tokens = await refresh_tiktok_token(
        refresh_token="rft.old", client_key="ck", client_secret="cs"
    )

    assert tokens["access_token"] == "act.new"
    assert tokens["refresh_token"] == "rft.new"  # rotated value
    assert _form_decode(captured[0].content) == {
        "client_key": "ck",
        "client_secret": "cs",
        "grant_type": "refresh_token",
        "refresh_token": "rft.old",
    }


# ---------- User info ----------


async def test_fetch_tiktok_user_info_returns_user_block(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "data": {
                    "user": {
                        "open_id": "open-1",
                        "union_id": "u-1",
                        "display_name": "Acme",
                        "username": "acme",
                        "avatar_url": "https://x/avatar.jpg",
                    }
                },
                "error": {"code": "ok", "message": "", "log_id": "L"},
            },
        ),
    )

    user = await fetch_tiktok_user_info(access_token="act")

    assert user["open_id"] == "open-1"
    assert user["display_name"] == "Acme"
    assert captured[0].headers["authorization"] == "Bearer act"
    assert "fields=" in str(captured[0].url)


async def test_fetch_tiktok_user_info_raises_on_error_envelope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "data": {},
                "error": {
                    "code": "access_token_invalid",
                    "message": "token expired",
                    "log_id": "L",
                },
            },
        ),
    )

    with pytest.raises(TikTokApiError, match="access_token_invalid"):
        await fetch_tiktok_user_info(access_token="bad")


# ---------- Publish ----------


async def test_upload_video_to_inbox_returns_publish_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "data": {"publish_id": "v_inbox_url~v2.123"},
                "error": {"code": "ok", "message": "", "log_id": "L"},
            },
        ),
    )

    publish_id = await upload_video_to_inbox(
        access_token="act", video_url="https://cdn/x.mp4"
    )

    assert publish_id == "v_inbox_url~v2.123"
    req = captured[0]
    assert str(req.url) == tiktok._INBOX_INIT_URL
    body = json.loads(req.content)
    assert body == {
        "source_info": {"source": "PULL_FROM_URL", "video_url": "https://cdn/x.mp4"}
    }
    assert req.headers["authorization"] == "Bearer act"


async def test_post_video_directly_sends_post_info_and_source(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "data": {"publish_id": "v_pub_url~v2.456"},
                "error": {"code": "ok", "message": "", "log_id": "L"},
            },
        ),
    )

    publish_id = await post_video_directly(
        access_token="act",
        video_url="https://cdn/x.mp4",
        title="hello #cat",
        privacy_level="PUBLIC_TO_EVERYONE",
        disable_comment=True,
        video_cover_timestamp_ms=2000,
    )

    assert publish_id == "v_pub_url~v2.456"
    body = json.loads(captured[0].content)
    assert body["source_info"] == {
        "source": "PULL_FROM_URL",
        "video_url": "https://cdn/x.mp4",
    }
    assert body["post_info"]["title"] == "hello #cat"
    assert body["post_info"]["privacy_level"] == "PUBLIC_TO_EVERYONE"
    assert body["post_info"]["disable_comment"] is True
    assert body["post_info"]["video_cover_timestamp_ms"] == 2000


async def test_post_video_directly_raises_on_error_envelope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "data": {},
                "error": {
                    "code": "url_ownership_unverified",
                    "message": "Domain not verified",
                    "log_id": "L",
                },
            },
        ),
    )

    with pytest.raises(TikTokApiError, match="url_ownership_unverified"):
        await post_video_directly(
            access_token="act", video_url="https://cdn/x.mp4", title="t"
        )


async def test_fetch_publish_status_returns_data(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "data": {"status": "PROCESSING_DOWNLOAD"},
                "error": {"code": "ok", "message": "", "log_id": "L"},
            },
        ),
    )

    data = await fetch_publish_status(access_token="act", publish_id="v_pub_url~v2.456")

    assert data == {"status": "PROCESSING_DOWNLOAD"}


async def test_non_json_response_raises_clean_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(502, text="<html>bad gateway</html>"),
    )

    with pytest.raises(TikTokApiError, match="non-JSON"):
        await upload_video_to_inbox(access_token="act", video_url="https://cdn/x.mp4")
