from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest

from app.infrastructure.external.video_replicate import (
    ReplicateApiError,
    cancel_replicate_prediction,
    create_replicate_prediction,
    extract_video_url,
    get_replicate_prediction,
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


# ---------- extract_video_url ----------


def test_extract_video_url_handles_string() -> None:
    assert extract_video_url("https://r.in/abc.mp4") == "https://r.in/abc.mp4"


def test_extract_video_url_handles_list_with_string() -> None:
    assert extract_video_url(["https://r.in/abc.mp4"]) == "https://r.in/abc.mp4"


def test_extract_video_url_returns_none_for_empty_list() -> None:
    assert extract_video_url([]) is None


def test_extract_video_url_returns_none_for_non_url_string() -> None:
    assert extract_video_url("not a url") is None


def test_extract_video_url_returns_none_for_dict() -> None:
    assert extract_video_url({"x": "y"}) is None


# ---------- create_prediction ----------


async def test_create_prediction_with_model_only(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            201,
            json={"id": "pred1", "status": "starting"},
        ),
    )

    result = await create_replicate_prediction(
        api_token="r8_xxx",
        model="kwaivgi/kling-v2.1",
        input={"prompt": "ocean waves"},
    )

    assert result["id"] == "pred1"
    req = captured[0]
    assert str(req.url) == "https://api.replicate.com/v1/predictions"
    assert req.headers["authorization"] == "Token r8_xxx"
    body = json.loads(req.content)
    assert body == {
        "model": "kwaivgi/kling-v2.1",
        "input": {"prompt": "ocean waves"},
    }


async def test_create_prediction_with_pinned_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(201, json={"id": "pred1", "status": "starting"}),
    )

    await create_replicate_prediction(
        api_token="r8_xxx",
        model="kwaivgi/kling-v2.1",
        version="abc123def",
        input={"prompt": "ocean waves"},
    )

    body = json.loads(captured[0].content)
    assert body["version"] == "abc123def"
    assert "model" not in body  # version takes precedence over model


async def test_create_prediction_includes_webhook_when_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(201, json={"id": "pred1", "status": "starting"}),
    )

    await create_replicate_prediction(
        api_token="r8_xxx",
        model="kwaivgi/kling-v2.1",
        input={"prompt": "x"},
        webhook="https://x/webhook",
    )

    body = json.loads(captured[0].content)
    assert body["webhook"] == "https://x/webhook"
    assert body["webhook_events_filter"] == ["completed"]


async def test_create_prediction_raises_on_400(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            400,
            json={"title": "Invalid request", "detail": "input.prompt is required"},
        ),
    )

    with pytest.raises(ReplicateApiError, match="input.prompt"):
        await create_replicate_prediction(
            api_token="r8_xxx",
            model="kwaivgi/kling-v2.1",
            input={},
        )


# ---------- get_prediction ----------


async def test_get_prediction_returns_body(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={
                "id": "pred1",
                "status": "succeeded",
                "output": ["https://r.in/abc.mp4"],
            },
        ),
    )

    result = await get_replicate_prediction(api_token="r8_xxx", prediction_id="pred1")

    assert result["status"] == "succeeded"
    assert extract_video_url(result["output"]) == "https://r.in/abc.mp4"
    assert str(captured[0].url) == "https://api.replicate.com/v1/predictions/pred1"


# ---------- cancel_prediction ----------


async def test_cancel_prediction_uses_post(monkeypatch: pytest.MonkeyPatch) -> None:
    captured = _install_transport(
        monkeypatch,
        lambda req: httpx.Response(200, json={"id": "pred1", "status": "canceled"}),
    )

    result = await cancel_replicate_prediction(api_token="r8_xxx", prediction_id="pred1")

    assert result["status"] == "canceled"
    assert captured[0].method == "POST"
    assert str(captured[0].url) == "https://api.replicate.com/v1/predictions/pred1/cancel"


# ---------- error envelopes ----------


async def test_non_json_response_raises_clean_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_transport(
        monkeypatch,
        lambda req: httpx.Response(502, text="<html>bad gateway</html>"),
    )

    with pytest.raises(ReplicateApiError, match="non-JSON"):
        await get_replicate_prediction(api_token="r8_xxx", prediction_id="pred1")
