from __future__ import annotations

from typing import Any

import pytest

from app.core.config import Settings
from app.infrastructure.storage import (
    R2Storage,
    StorageNotConfigured,
    StoredObject,
    get_storage,
)


class _FakeS3Client:
    def __init__(self) -> None:
        self.put_calls: list[dict[str, Any]] = []
        self.delete_calls: list[dict[str, Any]] = []
        self.signed_calls: list[dict[str, Any]] = []

    async def __aenter__(self) -> _FakeS3Client:
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    async def put_object(self, **kwargs: Any) -> dict[str, Any]:
        self.put_calls.append(kwargs)
        return {"ETag": "abc"}

    async def delete_object(self, **kwargs: Any) -> None:
        self.delete_calls.append(kwargs)

    async def generate_presigned_url(
        self, op: str, *, Params: dict[str, str], ExpiresIn: int
    ) -> str:
        self.signed_calls.append({"op": op, **Params, "ExpiresIn": ExpiresIn})
        return f"https://signed.example/{Params['Key']}?Expires={ExpiresIn}"


def _make_storage(public_base_url: str | None = None, expires: int = 86400) -> R2Storage:
    return R2Storage(
        account_id="acct",
        access_key_id="ak",
        secret_access_key="sk",
        bucket="media",
        public_base_url=public_base_url,
        signed_url_default_expires=expires,
    )


def test_r2_requires_complete_credentials() -> None:
    with pytest.raises(StorageNotConfigured):
        R2Storage(
            account_id="",
            access_key_id="ak",
            secret_access_key="sk",
            bucket="media",
        )


async def test_upload_bytes_uses_public_base_url_when_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeS3Client()
    storage = _make_storage(public_base_url="https://cdn.example.com")
    monkeypatch.setattr(storage, "_client_session", lambda: fake)

    result = await storage.upload_bytes(
        data=b"hello", key="videos/abc.mp4", content_type="video/mp4"
    )

    assert result == StoredObject(
        key="videos/abc.mp4",
        url="https://cdn.example.com/videos/abc.mp4",
        size_bytes=5,
        content_type="video/mp4",
    )
    assert fake.put_calls == [
        {
            "Bucket": "media",
            "Key": "videos/abc.mp4",
            "Body": b"hello",
            "ContentType": "video/mp4",
        }
    ]
    assert fake.signed_calls == []


async def test_upload_bytes_returns_signed_url_when_no_public_base(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeS3Client()
    storage = _make_storage(expires=600)
    monkeypatch.setattr(storage, "_client_session", lambda: fake)

    result = await storage.upload_bytes(
        data=b"x", key="k", content_type="text/plain"
    )

    assert result.url == "https://signed.example/k?Expires=600"
    assert fake.signed_calls == [
        {"op": "get_object", "Bucket": "media", "Key": "k", "ExpiresIn": 600}
    ]


async def test_get_signed_url_passes_expires(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeS3Client()
    storage = _make_storage()
    monkeypatch.setattr(storage, "_client_session", lambda: fake)

    url = await storage.get_signed_url(key="k", expires_in=120)

    assert url == "https://signed.example/k?Expires=120"


async def test_get_signed_url_falls_back_to_default_expires(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakeS3Client()
    storage = _make_storage(expires=42)
    monkeypatch.setattr(storage, "_client_session", lambda: fake)

    url = await storage.get_signed_url(key="k")

    assert url == "https://signed.example/k?Expires=42"


async def test_delete(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeS3Client()
    storage = _make_storage()
    monkeypatch.setattr(storage, "_client_session", lambda: fake)

    await storage.delete(key="videos/abc.mp4")

    assert fake.delete_calls == [{"Bucket": "media", "Key": "videos/abc.mp4"}]


def test_get_storage_raises_when_unconfigured() -> None:
    settings = Settings(
        r2_account_id="",
        r2_access_key_id="",
        r2_secret_access_key="",
        r2_bucket="",
    )
    with pytest.raises(StorageNotConfigured):
        get_storage(settings=settings)


def test_get_storage_returns_configured_instance() -> None:
    settings = Settings(
        r2_account_id="acct",
        r2_access_key_id="ak",
        r2_secret_access_key="sk",
        r2_bucket="media",
        r2_public_base_url="https://cdn.example.com/",
        r2_signed_url_expires=900,
    )
    storage = get_storage(settings=settings)
    assert storage.bucket == "media"
