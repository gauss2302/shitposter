from __future__ import annotations

from collections.abc import Callable
from typing import Any
from urllib.parse import parse_qs, parse_qsl

import httpx
import pytest

from app.infrastructure.external import instagram
from app.infrastructure.external.instagram import (
    InstagramApiError,
    create_reel_container,
    exchange_for_long_lived_token,
    exchange_instagram_code,
    fetch_container_status,
    fetch_instagram_user_info,
    publish_reel_container,
    refresh_instagram_token,
)


def _install_transport(
    monkeypatch: pytest.MonkeyPatch,
    handler: Callable[[httpx.Request], httpx.Response],
) -> list[httpx.Request]:
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


# ---------- OAuth ----------


async def test_exchange_instagram_code_returns_short_lived_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "access_token": "IGQVJ.short.123",
                "user_id": "1789",
                "permissions": [
                    "instagram_business_basic",
                    "instagram_business_content_publish",
                ],
            },
        ),
    )

    tokens = await exchange_instagram_code(
        code="abc",
        redirect_uri="https://x/cb",
        client_id="123",
        client_secret="secret",
    )

    assert tokens["access_token"] == "IGQVJ.short.123"
    assert tokens["user_id"] == "1789"
    assert dict(parse_qsl(captured[0].content.decode())) == {
        "client_id": "123",
        "client_secret": "secret",
        "grant_type": "authorization_code",
        "redirect_uri": "https://x/cb",
        "code": "abc",
    }


async def test_exchange_instagram_code_raises_on_oauth_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            400,
            json={
                "error_type": "OAuthException",
                "code": 400,
                "error_message": "Invalid authorization code",
            },
        ),
    )

    with pytest.raises(InstagramApiError):
        await exchange_instagram_code(
            code="bad",
            redirect_uri="https://x/cb",
            client_id="123",
            client_secret="secret",
        )


async def test_exchange_for_long_lived_token_uses_get_with_query_params(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "access_token": "IGQVJ.long.456",
                "token_type": "bearer",
                "expires_in": 5184000,
            },
        ),
    )

    tokens = await exchange_for_long_lived_token(
        short_lived_token="IGQVJ.short.123", client_secret="secret"
    )

    assert tokens["expires_in"] == 5184000
    req = captured[0]
    assert req.method == "GET"
    qs = parse_qs(req.url.query.decode())
    assert qs == {
        "grant_type": ["ig_exchange_token"],
        "client_secret": ["secret"],
        "access_token": ["IGQVJ.short.123"],
    }


async def test_refresh_instagram_token_uses_refresh_grant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "access_token": "IGQVJ.refreshed.789",
                "token_type": "bearer",
                "expires_in": 5184000,
            },
        ),
    )

    tokens = await refresh_instagram_token(access_token="IGQVJ.long.456")

    assert tokens["access_token"] == "IGQVJ.refreshed.789"
    qs = parse_qs(captured[0].url.query.decode())
    assert qs["grant_type"] == ["ig_refresh_token"]


# ---------- User info ----------


async def test_fetch_instagram_user_info(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "id": "1789",
                "username": "acme",
                "account_type": "BUSINESS",
                "profile_picture_url": "https://x/avatar.jpg",
            },
        ),
    )

    user = await fetch_instagram_user_info(access_token="act")

    assert user["username"] == "acme"
    qs = parse_qs(captured[0].url.query.decode())
    assert qs["fields"] == ["id,username,account_type,profile_picture_url"]
    assert qs["access_token"] == ["act"]


# ---------- Reels publish ----------


async def test_create_reel_container_returns_id(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(200, json={"id": "17841401234"}),
    )

    container_id = await create_reel_container(
        access_token="act",
        ig_user_id="1789",
        video_url="https://cdn/x.mp4",
        caption="hello #cat",
        share_to_feed=True,
        thumb_offset=2000,
    )

    assert container_id == "17841401234"
    req = captured[0]
    assert str(req.url) == f"{instagram._GRAPH_BASE}/1789/media"
    body = dict(parse_qsl(req.content.decode()))
    assert body == {
        "media_type": "REELS",
        "video_url": "https://cdn/x.mp4",
        "caption": "hello #cat",
        "share_to_feed": "true",
        "thumb_offset": "2000",
        "access_token": "act",
    }


async def test_create_reel_container_raises_on_graph_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            400,
            json={
                "error": {
                    "message": "(#100) Tried accessing nonexisting field",
                    "type": "OAuthException",
                    "code": 100,
                    "fbtrace_id": "X",
                }
            },
        ),
    )

    with pytest.raises(InstagramApiError, match=r"\(100\)"):
        await create_reel_container(
            access_token="act",
            ig_user_id="1789",
            video_url="https://cdn/x.mp4",
            caption="t",
        )


async def test_fetch_container_status_returns_status_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(200, json={"status_code": "FINISHED"}),
    )

    status = await fetch_container_status(access_token="act", container_id="17841401234")

    assert status == "FINISHED"


async def test_publish_reel_container_returns_media_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(200, json={"id": "17910000001"}),
    )

    media_id = await publish_reel_container(
        access_token="act", ig_user_id="1789", container_id="17841401234"
    )

    assert media_id == "17910000001"
    req = captured[0]
    assert str(req.url) == f"{instagram._GRAPH_BASE}/1789/media_publish"
    body = dict(parse_qsl(req.content.decode()))
    assert body == {"creation_id": "17841401234", "access_token": "act"}


async def test_non_json_response_raises_clean_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(502, text="<html>bad gateway</html>"),
    )

    with pytest.raises(InstagramApiError, match="non-JSON"):
        await fetch_container_status(access_token="act", container_id="X")
