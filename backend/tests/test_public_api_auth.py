"""Public-API auth gates: 401 without key, 403 without scope, 402 without plan.

Most checks bypass downstream gates via dependency_overrides so the route
itself reveals which gate fired. The 402 path is exercised at the dep
level since the route would also try to hit Redis (rate-limiter) before
returning.
"""

from __future__ import annotations

from typing import cast

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.deps import ApiPrincipal, get_current_api_principal
from app.api.public.v1 import deps as public_deps
from app.application.billing_service import SubscriptionState


def _principal(scopes: set[str] = frozenset({"posts:read", "posts:write", "accounts:read", "ai:generate", "ai:providers:read", "ai:providers:write"})) -> ApiPrincipal:  # noqa: E501
    return ApiPrincipal(
        user_id="user-1",
        api_key_id="key-1",
        api_key_name="local",
        scopes=frozenset(scopes),
    )


def _active_state(plan: str = "basic") -> SubscriptionState:
    return SubscriptionState(
        plan=plan,
        limit_per_platform=None,
        status="active",
        current_period_end=None,
        cancel_at_period_end=False,
    )


def _bypass_downstream(client: TestClient) -> None:
    client.app.dependency_overrides[public_deps.require_active_subscription] = (
        lambda: _active_state()
    )
    client.app.dependency_overrides[public_deps.enforce_read_rate_limit] = lambda: None
    client.app.dependency_overrides[public_deps.enforce_write_rate_limit] = lambda: None


def test_public_api_routes_require_api_key(client: TestClient) -> None:
    response = client.get("/api/public/v1/me")

    assert response.status_code == 401
    assert "Invalid API key" in response.json()["detail"]


def test_public_api_403_when_scope_missing(client: TestClient) -> None:
    client.app.dependency_overrides[get_current_api_principal] = lambda: _principal(
        scopes={"accounts:read"}
    )
    _bypass_downstream(client)

    response = client.get("/api/public/v1/posts")

    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient scope"
    client.app.dependency_overrides.clear()


async def test_require_active_subscription_returns_402_without_plan(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.application import billing_service

    async def _no_state(self: object, user_id: str) -> None:
        return None

    monkeypatch.setattr(
        billing_service.BillingService, "get_subscription_state", _no_state
    )

    with pytest.raises(HTTPException) as exc:
        await public_deps.require_active_subscription(_principal(), db=cast(object, None))

    assert exc.value.status_code == 402
    assert "active subscription" in str(exc.value.detail)


async def test_require_active_subscription_returns_state_when_plan_active(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.application import billing_service

    async def _state(self: object, user_id: str) -> SubscriptionState:
        return _active_state(plan="business")

    monkeypatch.setattr(
        billing_service.BillingService, "get_subscription_state", _state
    )

    result = await public_deps.require_active_subscription(
        _principal(), db=cast(object, None)
    )

    assert result.plan == "business"


def test_expected_public_api_paths_registered(client: TestClient) -> None:
    paths = set(client.app.openapi()["paths"].keys())

    assert "/api/public/v1/me" in paths
    assert "/api/public/v1/capabilities" in paths
    assert "/api/public/v1/accounts" in paths
    assert "/api/public/v1/posts" in paths
    assert "/api/public/v1/posts/{post_id}" in paths
    assert "/api/public/v1/ai/providers" in paths
    assert "/api/public/v1/ai/providers/{credential_id}" in paths
    assert "/api/public/v1/ai/generate" in paths

    # Legacy agent surface fully removed.
    assert not any(p.startswith("/api/v1/agent") for p in paths)
