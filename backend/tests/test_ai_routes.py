from fastapi.testclient import TestClient


def test_ai_provider_routes_require_session(client: TestClient) -> None:
    response = client.get("/api/v1/ai/providers")

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


def test_ai_generate_route_requires_session(client: TestClient) -> None:
    response = client.post(
        "/api/v1/ai/generate",
        json={"prompt": "Write a launch post"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"
