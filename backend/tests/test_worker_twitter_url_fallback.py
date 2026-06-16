"""``_publish_twitter`` should fetch image bytes from ``media_url`` when no
inline ``media_data`` is present (the public API uploads to R2 first and
only passes the URL through).
"""

from __future__ import annotations

import base64
from dataclasses import dataclass

import pytest

from app.worker import jobs as worker_jobs


@dataclass
class _Account:
    platform: str = "twitter"
    access_token: str = ""
    access_token_secret: str = "secret-encrypted"
    oauth1_access_token: str | None = None


class _FakeResponse:
    def __init__(self, content: bytes, content_type: str = "image/jpeg") -> None:
        self.content = content
        self.headers = {"content-type": content_type}

    def raise_for_status(self) -> None:
        return None


class _FakeAsyncClient:
    def __init__(self, content: bytes, content_type: str = "image/jpeg") -> None:
        self._content = content
        self._content_type = content_type
        self.requested: list[str] = []

    async def __aenter__(self) -> _FakeAsyncClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def get(self, url: str, follow_redirects: bool = False) -> _FakeResponse:
        self.requested.append(url)
        return _FakeResponse(self._content, self._content_type)


async def test_publish_twitter_fetches_image_bytes_from_media_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No `media_data`, only `media_url` — Twitter image upload still happens."""
    image_bytes = b"\xff\xd8\xff\xe0fake-jpeg-body"
    client = _FakeAsyncClient(image_bytes)
    monkeypatch.setattr(
        worker_jobs.httpx,
        "AsyncClient",
        lambda *args, **kwargs: client,
    )

    captured_uploads: list[dict[str, object]] = []

    async def _upload(
        *,
        media: bytes,
        mime_type: str,
        access_token: str,
        access_token_secret: str,
        consumer_key: str,
        consumer_secret: str,
    ) -> str:
        captured_uploads.append({"media": media, "mime_type": mime_type})
        return "media-id-123"

    captured_tweet: dict[str, object] = {}

    async def _post_tweet(
        *, access_token: str, content: str, media_ids: list[str]
    ) -> str:
        captured_tweet["content"] = content
        captured_tweet["media_ids"] = media_ids
        return "tweet-789"

    monkeypatch.setattr(worker_jobs, "upload_media_to_twitter", _upload)
    monkeypatch.setattr(worker_jobs, "post_tweet", _post_tweet)
    monkeypatch.setattr(worker_jobs, "decrypt", lambda s: s)

    payload = {
        "media_url": "https://cdn.example.com/posts/abc/picture.jpg",
        "post_id": "abc",
    }
    result = await worker_jobs._publish_twitter(
        account=_Account(),
        access_token="dummy",
        content="Look ma",
        payload=payload,
        settings=worker_jobs.get_settings(),
    )

    assert result == "tweet-789"
    assert client.requested == ["https://cdn.example.com/posts/abc/picture.jpg"]
    assert captured_uploads == [
        {"media": image_bytes, "mime_type": "image/jpeg"}
    ]
    assert captured_tweet == {"content": "Look ma", "media_ids": ["media-id-123"]}


async def test_publish_twitter_prefers_inline_media_data_over_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If `media_data` is present, the URL fallback must not fire."""
    inline_bytes = b"inline-bytes"

    def _no_http(*args: object, **kwargs: object) -> object:
        raise AssertionError("HTTP client should not be invoked when media_data is set")

    monkeypatch.setattr(worker_jobs.httpx, "AsyncClient", _no_http)

    captured: dict[str, object] = {}

    async def _upload(
        *,
        media: bytes,
        mime_type: str,
        access_token: str,
        access_token_secret: str,
        consumer_key: str,
        consumer_secret: str,
    ) -> str:
        captured["media"] = media
        captured["mime_type"] = mime_type
        return "media-id"

    async def _post_tweet(
        *, access_token: str, content: str, media_ids: list[str]
    ) -> str:
        return "tweet-id"

    monkeypatch.setattr(worker_jobs, "upload_media_to_twitter", _upload)
    monkeypatch.setattr(worker_jobs, "post_tweet", _post_tweet)
    monkeypatch.setattr(worker_jobs, "decrypt", lambda s: s)

    payload = {
        "media_data": [
            {
                "data": base64.b64encode(inline_bytes).decode(),
                "mimeType": "image/png",
            }
        ],
        "media_url": "https://cdn.example.com/should-not-fetch.png",
    }
    await worker_jobs._publish_twitter(
        account=_Account(),
        access_token="dummy",
        content="x",
        payload=payload,
        settings=worker_jobs.get_settings(),
    )

    assert captured == {"media": inline_bytes, "mime_type": "image/png"}


async def test_publish_twitter_text_only_skips_media_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No media at all — tweet posts plain text and never touches the upload path."""

    def _no_http(*args: object, **kwargs: object) -> object:
        raise AssertionError("HTTP client should not be invoked for text-only tweets")

    monkeypatch.setattr(worker_jobs.httpx, "AsyncClient", _no_http)

    async def _no_upload(**kwargs: object) -> str:
        raise AssertionError("upload_media_to_twitter should not run")

    async def _post_tweet(
        *, access_token: str, content: str, media_ids: list[str]
    ) -> str:
        assert media_ids == []
        return "tweet-id-text"

    monkeypatch.setattr(worker_jobs, "upload_media_to_twitter", _no_upload)
    monkeypatch.setattr(worker_jobs, "post_tweet", _post_tweet)
    monkeypatch.setattr(worker_jobs, "decrypt", lambda s: s)

    result = await worker_jobs._publish_twitter(
        account=_Account(),
        access_token="dummy",
        content="text only",
        payload={},
        settings=worker_jobs.get_settings(),
    )

    assert result == "tweet-id-text"
