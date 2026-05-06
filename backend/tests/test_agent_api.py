from fastapi.testclient import TestClient


def test_agent_routes_require_api_key(client: TestClient) -> None:
    response = client.get("/api/v1/agent/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid API key"


def test_agent_capabilities_route_is_registered(client: TestClient) -> None:
    routes = {route.path for route in client.app.routes}

    assert "/api/v1/agent/social/capabilities" in routes
    assert "/api/v1/agent/social/accounts" in routes
    assert "/api/v1/agent/posts/{post_id}" in routes
    assert "/api/v1/agent/ai/generate" in routes
