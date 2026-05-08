from fastapi.testclient import TestClient

from app.application.agent_readiness_service import (
    AGENT_AUTOMATION_SCOPES,
    AGENT_PROVIDER_API_SCOPES,
    _scopes_cover_requirement,
)


def test_agent_readiness_requires_session(client: TestClient) -> None:
    response = client.get("/api/v1/dashboard/agent-readiness")

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized"


def test_scope_cover_star_grants_all() -> None:
    assert _scopes_cover_requirement(["*"], AGENT_AUTOMATION_SCOPES)
    assert _scopes_cover_requirement(["*", "posts:read"], AGENT_PROVIDER_API_SCOPES)


def test_scope_cover_exact_automation_set() -> None:
    scopes = sorted(AGENT_AUTOMATION_SCOPES)
    assert _scopes_cover_requirement(scopes, AGENT_AUTOMATION_SCOPES)


def test_scope_cover_missing_scope_fails() -> None:
    assert not _scopes_cover_requirement(["posts:write", "ai:generate"], AGENT_AUTOMATION_SCOPES)


def test_provider_api_scopes_subset() -> None:
    combined = sorted(AGENT_AUTOMATION_SCOPES | AGENT_PROVIDER_API_SCOPES)
    assert _scopes_cover_requirement(combined, AGENT_PROVIDER_API_SCOPES)
