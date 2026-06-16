"""``_update_post_status`` reconciles post.status from target rows.

The cancelled-post guard added with the public API must outrank any
worker-driven recalculation, otherwise a stale ``publish_post`` job
firing for the same post would resurrect it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.worker import jobs as worker_jobs


@dataclass
class _Post:
    id: str = "post-1"
    status: str = "scheduled"
    updated_at: Any = None


@dataclass
class _Target:
    id: str
    status: str
    post_id: str = "post-1"


@dataclass
class _ScalarResult:
    rows: list[_Target]

    def scalars(self) -> _ScalarResult:
        return self

    def all(self) -> list[_Target]:
        return self.rows


@dataclass
class _Session:
    post: _Post | None
    targets: list[_Target] = field(default_factory=list)

    async def get(self, model: type, primary_key: str) -> object | None:
        from app.infrastructure.db import models

        if model is models.Post:
            return self.post
        raise AssertionError(f"unexpected get({model})")

    async def execute(self, _stmt: object) -> _ScalarResult:
        return _ScalarResult(self.targets)


async def test_update_post_status_does_not_overwrite_cancelled() -> None:
    post = _Post(status="cancelled")
    session = _Session(post=post, targets=[_Target("t1", "cancelled")])

    await worker_jobs._update_post_status(session, post.id)

    assert post.status == "cancelled"


async def test_update_post_status_marks_all_published() -> None:
    post = _Post(status="publishing")
    session = _Session(
        post=post,
        targets=[_Target("t1", "published"), _Target("t2", "published")],
    )

    await worker_jobs._update_post_status(session, post.id)

    assert post.status == "published"


async def test_update_post_status_ignores_cancelled_targets() -> None:
    """A target cancelled mid-flight must not flip the post back to scheduled."""
    post = _Post(status="publishing")
    session = _Session(
        post=post,
        targets=[
            _Target("t1", "published"),
            _Target("t2", "cancelled"),
        ],
    )

    await worker_jobs._update_post_status(session, post.id)

    assert post.status == "published"


async def test_update_post_status_failed_when_no_successes() -> None:
    post = _Post(status="publishing")
    session = _Session(
        post=post,
        targets=[_Target("t1", "failed"), _Target("t2", "failed")],
    )

    await worker_jobs._update_post_status(session, post.id)

    assert post.status == "failed"


async def test_update_post_status_published_on_mixed_failed_and_published() -> None:
    post = _Post(status="publishing")
    session = _Session(
        post=post,
        targets=[_Target("t1", "published"), _Target("t2", "failed")],
    )

    await worker_jobs._update_post_status(session, post.id)

    assert post.status == "published"


async def test_update_post_status_no_active_targets_is_noop() -> None:
    """All targets cancelled but post slipped through to status=scheduled? Don't touch it."""
    post = _Post(status="scheduled")
    session = _Session(
        post=post,
        targets=[_Target("t1", "cancelled"), _Target("t2", "cancelled")],
    )

    await worker_jobs._update_post_status(session, post.id)

    # Behavior: when there are no non-cancelled targets the function bails
    # without touching the post — leaving the cancel flow as source of truth.
    assert post.status == "scheduled"


async def test_update_post_status_no_post_is_safe() -> None:
    session = _Session(post=None, targets=[])

    await worker_jobs._update_post_status(session, "missing")  # noqa: F841 — just no raise
