from __future__ import annotations

import base64
from typing import Any

import pytest

from app.core.config import Settings
from app.infrastructure.storage import StorageNotConfigured, StoredObject
from app.worker import jobs as worker_jobs


class _FakeStorage:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def upload_bytes(
        self, *, data: bytes, key: str, content_type: str
    ) -> StoredObject:
        self.calls.append({"data": data, "key": key, "content_type": content_type})
        return StoredObject(
            key=key,
            url=f"https://cdn.example.com/{key}",
            size_bytes=len(data),
            content_type=content_type,
        )


# ---------- _ensure_video_url ----------


async def test_ensure_video_url_returns_existing_media_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = {"media_url": "https://cdn.example.com/already.mp4", "post_id": "p1"}
    settings = Settings()

    def _no_storage(_: Settings | None = None) -> Any:
        raise AssertionError("storage should not be touched when media_url is present")

    monkeypatch.setattr(worker_jobs, "get_storage", _no_storage)

    url = await worker_jobs._ensure_video_url(payload, settings, key_prefix="posts/p1")

    assert url == "https://cdn.example.com/already.mp4"


async def test_ensure_video_url_uploads_base64_when_only_media_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw_bytes = b"fake-mp4-content"
    encoded = base64.b64encode(raw_bytes).decode()
    payload = {
        "media_data": [{"data": encoded, "mimeType": "video/mp4"}],
        "post_id": "p1",
    }
    settings = Settings()
    fake = _FakeStorage()
    monkeypatch.setattr(worker_jobs, "get_storage", lambda _settings=None: fake)

    url = await worker_jobs._ensure_video_url(payload, settings, key_prefix="posts/p1")

    assert url.startswith("https://cdn.example.com/posts/p1/")
    assert url.endswith(".mp4")
    assert len(fake.calls) == 1
    call = fake.calls[0]
    assert call["data"] == raw_bytes
    assert call["content_type"] == "video/mp4"
    assert call["key"].startswith("posts/p1/")


async def test_ensure_video_url_raises_when_no_media_provided() -> None:
    payload = {"post_id": "p1"}
    settings = Settings()
    with pytest.raises(RuntimeError, match="required"):
        await worker_jobs._ensure_video_url(payload, settings, key_prefix="posts/p1")


async def test_ensure_video_url_raises_when_storage_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = {
        "media_data": [{"data": base64.b64encode(b"x").decode(), "mimeType": "video/mp4"}],
        "post_id": "p1",
    }
    settings = Settings()

    def _raise(_: Settings | None = None) -> Any:
        raise StorageNotConfigured("creds missing")

    monkeypatch.setattr(worker_jobs, "get_storage", _raise)

    with pytest.raises(RuntimeError, match="R2 is not configured"):
        await worker_jobs._ensure_video_url(payload, settings, key_prefix="posts/p1")


# ---------- _extension_for_mime ----------


def test_extension_for_mime_mp4() -> None:
    assert worker_jobs._extension_for_mime("video/mp4") == ".mp4"


def test_extension_for_mime_mov() -> None:
    assert worker_jobs._extension_for_mime("video/quicktime") == ".mov"


def test_extension_for_mime_webm() -> None:
    assert worker_jobs._extension_for_mime("video/webm") == ".webm"


def test_extension_for_mime_unknown_falls_back_to_bin() -> None:
    assert worker_jobs._extension_for_mime("application/octet-stream") == ".bin"
