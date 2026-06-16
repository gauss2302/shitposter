from __future__ import annotations

import io
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.api.v1 import media as media_route
from app.application.auth_service import AuthenticatedUser
from app.infrastructure.storage import StorageNotConfigured, StoredObject


def _override_user(client: TestClient) -> AuthenticatedUser:
    user = AuthenticatedUser(
        id="user-1", name="Acme", email="acme@example.com", image=None
    )
    client.app.dependency_overrides[get_current_user] = lambda: user
    return user


def test_upload_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/media/upload",
        files={"file": ("clip.mp4", b"x", "video/mp4")},
    )
    assert response.status_code == 401


def test_upload_rejects_unsupported_mime(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_user(client)
    response = client.post(
        "/api/v1/media/upload",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400
    assert "unsupported_media_type" in response.json()["detail"]
    client.app.dependency_overrides.clear()


def test_upload_rejects_empty_file(client: TestClient) -> None:
    _override_user(client)
    response = client.post(
        "/api/v1/media/upload",
        files={"file": ("clip.mp4", b"", "video/mp4")},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "empty_file"
    client.app.dependency_overrides.clear()


def test_upload_returns_503_when_storage_unconfigured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_user(client)

    def _raise(_: Any = None) -> Any:
        raise StorageNotConfigured("creds missing")

    monkeypatch.setattr(media_route, "get_storage", _raise)

    response = client.post(
        "/api/v1/media/upload",
        files={"file": ("clip.mp4", io.BytesIO(b"abc"), "video/mp4")},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "storage_not_configured"
    client.app.dependency_overrides.clear()


def test_upload_happy_path(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_user(client)

    fake_storage = AsyncMock()

    async def _upload_bytes(
        *, data: bytes, key: str, content_type: str
    ) -> StoredObject:
        return StoredObject(
            key=key,
            url=f"https://cdn.example.com/{key}",
            size_bytes=len(data),
            content_type=content_type,
        )

    fake_storage.upload_bytes = _upload_bytes
    monkeypatch.setattr(media_route, "get_storage", lambda _settings=None: fake_storage)

    body = b"\x00\x00\x00\x20ftypisom" + b"\x00" * 100
    response = client.post(
        "/api/v1/media/upload",
        files={"file": ("clip.mp4", io.BytesIO(body), "video/mp4")},
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["success"] is True
    assert payload["url"].startswith("https://cdn.example.com/uploads/user-1/")
    assert payload["url"].endswith(".mp4")
    assert payload["mimeType"] == "video/mp4"
    assert payload["sizeBytes"] == len(body)
    client.app.dependency_overrides.clear()
