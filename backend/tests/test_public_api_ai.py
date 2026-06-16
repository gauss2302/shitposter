"""AI public-API routes — auth + scope gates."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.deps import ApiPrincipal, get_current_api_principal
from app.api.public.v1 import deps as public_deps
from app.application.billing_service import SubscriptionState


def _bypass(client: TestClient, principal: ApiPrincipal) -> None:
    state = SubscriptionState(
        plan="basic",
        limit_per_platform=None,
        status="active",
        current_period_end=None,
        cancel_at_period_end=False,
    )
    client.app.dependency_overrides[get_current_api_principal] = lambda: principal
    client.app.dependency_overrides[public_deps.require_active_subscription] = lambda: state
    client.app.dependency_overrides[public_deps.enforce_read_rate_limit] = lambda: None
    client.app.dependency_overrides[public_deps.enforce_write_rate_limit] = lambda: None


def test_ai_providers_require_api_key(client: TestClient) -> None:
    response = client.get("/api/public/v1/ai/providers")

    assert response.status_code == 401


def test_ai_generate_requires_api_key(client: TestClient) -> None:
    response = client.post(
        "/api/public/v1/ai/generate",
        json={"prompt": "Write a launch post"},
    )

    assert response.status_code == 401


def test_ai_generate_403_without_generate_scope(client: TestClient) -> None:
    _bypass(
        client,
        ApiPrincipal(
            user_id="user-1",
            api_key_id="key-1",
            api_key_name="local",
            scopes=frozenset({"posts:write"}),
        ),
    )

    response = client.post(
        "/api/public/v1/ai/generate",
        json={"prompt": "Write a launch post"},
    )

    assert response.status_code == 403
    client.app.dependency_overrides.clear()


def test_ai_providers_403_without_read_scope(client: TestClient) -> None:
    _bypass(
        client,
        ApiPrincipal(
            user_id="user-1",
            api_key_id="key-1",
            api_key_name="local",
            scopes=frozenset({"posts:write"}),
        ),
    )

    response = client.get("/api/public/v1/ai/providers")

    assert response.status_code == 403
    client.app.dependency_overrides.clear()
