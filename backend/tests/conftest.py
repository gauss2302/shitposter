import os

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture(autouse=True)
def test_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("DATABASE_URL", os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5444/socialposter"))
    monkeypatch.setenv("REDIS_URL", os.environ.get("REDIS_URL", "redis://localhost:6344/0"))
    monkeypatch.setenv("FRONTEND_PUBLIC_URL", "http://localhost:3000")
    monkeypatch.setenv("BACKEND_PUBLIC_URL", "http://localhost:8000")
    monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", "test-token-encryption-key")
    monkeypatch.setenv("SESSION_SECRET", "test-session-secret")


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())
