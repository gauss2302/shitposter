"""Worker `publish_post` cancellation + stale-dispatch + idempotency guards."""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.worker import jobs as worker_jobs


@dataclass
class _PostStub:
    id: str = "post-1"
    status: str = "scheduled"
    user_id: str = "user-1"


@dataclass
class _TargetStub:
    id: str = "target-1"
    status: str = "pending"
    dispatch_token: str | None = "token-current"
    post_id: str = "post-1"
    social_account_id: str = "acc-1"


class _Session:
    """Async-context-aware fake mirroring the shape ``publish_post`` needs."""

    def __init__(self, post: _PostStub | None, target: _TargetStub | None) -> None:
        self._post = post
        self._target = target
        self.committed = 0
        from app.infrastructure.db import models

        self._models = models

    async def __aenter__(self) -> _Session:
        return self

    async def __aexit__(self, *args: object) -> None:  # noqa: D401
        return None

    async def get(self, model: type, primary_key: str) -> object | None:
        if model is self._models.PostTarget:
            return self._target
        if model is self._models.Post:
            return self._post
        if model is self._models.SocialAccount:
            # Tests don't exercise the publish branch; returning None
            # makes the worker raise "Social account ... not found".
            return None
        raise AssertionError(f"unexpected get({model}, {primary_key})")

    async def commit(self) -> None:
        self.committed += 1

    async def flush(self) -> None:
        return None


def _install(monkeypatch: pytest.MonkeyPatch, session: _Session) -> None:
    monkeypatch.setattr(
        worker_jobs, "async_session_factory", lambda: session
    )


async def test_publish_post_skips_when_target_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _Session(post=None, target=None)
    _install(monkeypatch, session)

    result = await worker_jobs.publish_post(
        {}, {"target_id": "x", "post_id": "y", "social_account_id": "z"}
    )

    assert result == {"status": "skipped:target_missing"}


async def test_publish_post_skips_when_post_cancelled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    post = _PostStub(status="cancelled")
    target = _TargetStub(status="pending", dispatch_token="token-current")
    session = _Session(post=post, target=target)
    _install(monkeypatch, session)

    result = await worker_jobs.publish_post(
        {}, {"target_id": target.id, "post_id": post.id, "social_account_id": "acc-1"}
    )

    assert result == {"status": "skipped:cancelled"}
    assert target.status == "cancelled"


async def test_publish_post_skips_on_stale_dispatch_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    post = _PostStub(status="scheduled")
    target = _TargetStub(status="pending", dispatch_token="token-current")
    session = _Session(post=post, target=target)
    _install(monkeypatch, session)

    payload = {
        "target_id": target.id,
        "post_id": post.id,
        "social_account_id": "acc-1",
        "dispatch_token": "token-OLD",
    }
    result = await worker_jobs.publish_post({}, payload)

    assert result == {"status": "skipped:stale_dispatch"}
    # Status untouched — we didn't even mark publishing.
    assert target.status == "pending"


async def test_publish_post_idempotent_when_target_already_published(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    post = _PostStub(status="published")
    target = _TargetStub(status="published", dispatch_token="t")
    session = _Session(post=post, target=target)
    _install(monkeypatch, session)

    result = await worker_jobs.publish_post(
        {}, {"target_id": target.id, "post_id": post.id, "social_account_id": "acc-1"}
    )

    assert result == {"status": "already_published"}


async def test_publish_post_legacy_null_token_back_compat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Rows from before the migration have NULL dispatch_token; if the
    payload also has none, the guard must NOT short-circuit. The publish
    branch then fails on the missing social account — we just want to
    prove the guard let the request through."""
    post = _PostStub(status="scheduled")
    target = _TargetStub(status="pending", dispatch_token=None)
    session = _Session(post=post, target=target)
    _install(monkeypatch, session)

    payload = {
        "target_id": target.id,
        "post_id": post.id,
        "social_account_id": "acc-1",
    }
    with pytest.raises(RuntimeError, match="Social account"):
        await worker_jobs.publish_post({}, payload)
