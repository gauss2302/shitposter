"""Dashboard PATCH/DELETE на `/api/v1/posts/{id}` (cookie auth).

Сервисный слой уже покрыт `test_public_api_posts.py`. Здесь — HTTP layer:
auth, route wiring, и маппинг доменных исключений на HTTP-коды.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.application import posts_service as svc
from app.application.auth_service import AuthenticatedUser
from app.domain.exceptions import ConflictError, NotFoundError, ValidationError


def _override_user(client: TestClient, user_id: str = "user-1") -> None:
    user = AuthenticatedUser(
        id=user_id, name="Acme", email=f"{user_id}@example.com", image=None
    )
    client.app.dependency_overrides[get_current_user] = lambda: user


def _clear(client: TestClient) -> None:
    client.app.dependency_overrides.clear()


# ---------- Auth gate ----------


def test_patch_requires_session(client: TestClient) -> None:
    response = client.patch("/api/v1/posts/post-1", json={"content": "x"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


def test_delete_requires_session(client: TestClient) -> None:
    response = client.delete("/api/v1/posts/post-1")

    assert response.status_code == 401


# ---------- PATCH ----------


def test_patch_happy_path_returns_serialized_post(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_user(client)

    captured: dict[str, Any] = {}

    async def _fake_update(
        self: svc.PostsService,
        *,
        user_id: str,
        post_id: str,
        content: str | None = None,
        scheduled_for_raw: str | None = None,
    ) -> Any:
        captured["call"] = {
            "user_id": user_id,
            "post_id": post_id,
            "content": content,
            "scheduled_for_raw": scheduled_for_raw,
        }

        class _Stub:
            id = post_id
            status = "scheduled"
            content = "new copy"
            scheduled_for = None

        return _Stub()

    monkeypatch.setattr(svc.PostsService, "update_scheduled_post", _fake_update)

    response = client.patch(
        "/api/v1/posts/post-1",
        json={"content": "new copy", "scheduledFor": None},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert body["post"]["id"] == "post-1"
    assert body["post"]["status"] == "scheduled"
    assert body["post"]["content"] == "new copy"
    assert captured["call"] == {
        "user_id": "user-1",
        "post_id": "post-1",
        "content": "new copy",
        "scheduled_for_raw": None,
    }
    _clear(client)


def test_patch_404_when_post_not_found(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_user(client)

    async def _raise_not_found(*args: Any, **kwargs: Any) -> Any:
        raise NotFoundError("Post not found")

    monkeypatch.setattr(
        svc.PostsService, "update_scheduled_post", _raise_not_found
    )

    response = client.patch(
        "/api/v1/posts/missing", json={"content": "x"}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Post not found"
    _clear(client)


def test_patch_409_when_post_already_publishing(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_user(client)

    async def _raise_conflict(*args: Any, **kwargs: Any) -> Any:
        raise ConflictError("Cannot edit post in status 'publishing'")

    monkeypatch.setattr(svc.PostsService, "update_scheduled_post", _raise_conflict)

    response = client.patch(
        "/api/v1/posts/post-1", json={"content": "late edit"}
    )

    assert response.status_code == 409
    assert "publishing" in response.json()["detail"]
    _clear(client)


def test_patch_400_when_validation_fails(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_user(client)

    async def _raise_validation(*args: Any, **kwargs: Any) -> Any:
        raise ValidationError("No mutable fields provided")

    monkeypatch.setattr(svc.PostsService, "update_scheduled_post", _raise_validation)

    response = client.patch("/api/v1/posts/post-1", json={})

    assert response.status_code == 400
    assert "mutable" in response.json()["detail"]
    _clear(client)


# ---------- DELETE ----------


def test_delete_happy_path_returns_204(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_user(client)

    captured: dict[str, Any] = {}

    async def _fake_cancel(
        self: svc.PostsService, *, user_id: str, post_id: str
    ) -> Any:
        captured["call"] = {"user_id": user_id, "post_id": post_id}

        class _Stub:
            id = post_id
            status = "cancelled"

        return _Stub()

    monkeypatch.setattr(svc.PostsService, "cancel_scheduled_post", _fake_cancel)

    response = client.delete("/api/v1/posts/post-1")

    assert response.status_code == 204
    assert response.content == b""
    assert captured["call"] == {"user_id": "user-1", "post_id": "post-1"}
    _clear(client)


def test_delete_404_when_post_not_found(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_user(client)

    async def _raise_not_found(*args: Any, **kwargs: Any) -> Any:
        raise NotFoundError("Post not found")

    monkeypatch.setattr(svc.PostsService, "cancel_scheduled_post", _raise_not_found)

    response = client.delete("/api/v1/posts/missing")

    assert response.status_code == 404
    _clear(client)


def test_delete_409_when_post_already_published(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _override_user(client)

    async def _raise_conflict(*args: Any, **kwargs: Any) -> Any:
        raise ConflictError("Cannot cancel post in status 'published'")

    monkeypatch.setattr(svc.PostsService, "cancel_scheduled_post", _raise_conflict)

    response = client.delete("/api/v1/posts/post-1")

    assert response.status_code == 409
    assert "published" in response.json()["detail"]
    _clear(client)


# ---------- Routing ----------


def test_routes_registered(client: TestClient) -> None:
    paths = client.app.openapi()["paths"]

    assert "/api/v1/posts/{post_id}" in paths
    methods = {m.lower() for m in paths["/api/v1/posts/{post_id}"]}
    assert "patch" in methods
    assert "delete" in methods
