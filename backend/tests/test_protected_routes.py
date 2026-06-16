from fastapi.testclient import TestClient


def test_dashboard_requires_session_cookie(client: TestClient) -> None:
    response = client.get("/api/v1/dashboard/accounts")

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


def test_expected_route_groups_are_registered(client: TestClient) -> None:
    # FastAPI's nested `_IncludedRouter` doesn't expose .path directly, so
    # walk the resolved OpenAPI schema instead.
    paths = set(client.app.openapi()["paths"].keys())

    assert "/api/v1/auth/sign-in" in paths
    assert "/api/v1/api-keys" in paths
    assert "/api/v1/ai/providers" in paths
    assert "/api/v1/ai/generate" in paths
    assert "/api/v1/dashboard/summary" in paths
    assert "/api/v1/dashboard/agent-readiness" in paths
    assert "/api/v1/posts" in paths
    assert "/api/v1/social/connect/twitter-oauth1" in paths
    assert "/api/v1/billing/webhook/polar" in paths

    # Legacy agent surface is gone; public API replaces it under a
    # dedicated prefix.
    assert not any(p.startswith("/api/v1/agent") for p in paths)
    assert "/api/public/v1/me" in paths
    assert "/api/public/v1/posts" in paths
