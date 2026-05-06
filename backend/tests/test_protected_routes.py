from fastapi.testclient import TestClient


def test_dashboard_requires_session_cookie(client: TestClient) -> None:
    response = client.get("/api/v1/dashboard/accounts")

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


def test_expected_route_groups_are_registered(client: TestClient) -> None:
    routes = {route.path for route in client.app.routes}

    assert "/api/v1/auth/sign-in" in routes
    assert "/api/v1/dashboard/summary" in routes
    assert "/api/v1/posts" in routes
    assert "/api/v1/social/connect/twitter-oauth1" in routes
    assert "/api/v1/billing/webhook/polar" in routes
