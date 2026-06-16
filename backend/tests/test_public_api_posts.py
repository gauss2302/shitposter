"""Cursor encoding + PostsService PATCH/cancel/list guards.

The route-level multipart flow is covered by manual curl in the plan's
verification section; here we lock the unit-level contract:

  * cursor round-trips (incl. timestamps without microseconds and with
    fractional seconds) and rejects malformed inputs
  * cancel succeeds only when nothing has shipped, fails on later states
  * update happy paths: content-only edits in place; scheduledFor edit
    rotates ``dispatch_token`` AND re-enqueues exactly once per target
  * list_posts_paginated honours limit, advertises a next cursor only
    when more rows are pending, and filters by status
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.public.v1.cursor import decode_cursor, encode_cursor
from app.application import posts_service as svc
from app.domain.exceptions import ConflictError, NotFoundError, ValidationError


def test_cursor_round_trip() -> None:
    when = datetime(2026, 6, 16, 18, 30, tzinfo=UTC).replace(tzinfo=None)
    cursor = encode_cursor(when, "post-abc")

    decoded_when, decoded_id = decode_cursor(cursor)

    assert decoded_when == when
    assert decoded_id == "post-abc"


def test_cursor_round_trip_with_microseconds() -> None:
    when = datetime(2026, 6, 16, 18, 30, 45, 123456)
    cursor = encode_cursor(when, "abc_-XYZ")

    decoded_when, decoded_id = decode_cursor(cursor)

    assert decoded_when == when
    assert decoded_id == "abc_-XYZ"


def test_cursor_decode_rejects_malformed() -> None:
    with pytest.raises(ValueError):
        decode_cursor("not a base64 cursor!!!")


def test_cursor_decode_rejects_empty_id() -> None:
    # Encoded payload where the id half is empty.
    import base64

    bad = base64.urlsafe_b64encode(b"2026-06-16T00:00:00|").decode().rstrip("=")
    with pytest.raises(ValueError):
        decode_cursor(bad)


def test_cursor_decode_rejects_missing_separator() -> None:
    import base64

    bad = base64.urlsafe_b64encode(b"no-pipe-anywhere").decode().rstrip("=")
    with pytest.raises(ValueError):
        decode_cursor(bad)


# ---------- Service guards ----------


class _AccountStub:
    def __init__(self, account_id: str = "acc-1") -> None:
        self.id = account_id
        self.platform = "twitter"
        self.platform_username = "@me"


class _FakePostRepo:
    def __init__(
        self,
        post: Any,
        targets: list[Any],
        accounts: list[Any] | None = None,
        all_posts: list[Any] | None = None,
    ) -> None:
        self._post = post
        self._targets = targets
        self._accounts = accounts or []
        self._all_posts = all_posts or ([post] if post else [])

    async def get_owned(self, post_id: str, user_id: str) -> Any | None:
        if self._post is None:
            return None
        if (post_id, user_id) == (self._post.id, self._post.user_id):
            return self._post
        return None

    async def get_targets(self, post_id: str) -> Sequence[Any]:
        return self._targets

    async def list_accounts_by_target_ids(self, ids: Sequence[str]) -> Sequence[Any]:
        wanted = set(ids)
        return [a for a in self._accounts if a.id in wanted]

    async def list_for_user_paginated(
        self,
        user_id: str,
        *,
        limit: int,
        cursor: tuple[datetime, str] | None = None,
        status: str | None = None,
    ) -> Sequence[Any]:
        rows = [p for p in self._all_posts if p.user_id == user_id]
        if status is not None:
            rows = [p for p in rows if p.status == status]
        # Same ORDER BY (created_at DESC, id DESC) the real repo uses.
        rows.sort(key=lambda p: (p.created_at, p.id), reverse=True)
        if cursor is not None:
            cursor_created, cursor_id = cursor
            rows = [
                p
                for p in rows
                if (p.created_at, p.id) < (cursor_created, cursor_id)
            ]
        return rows[:limit]


class _FakeSession:
    def __init__(self) -> None:
        self.committed = 0

    async def commit(self) -> None:
        self.committed += 1


def _make_service(
    post: Any,
    targets: list[Any],
    accounts: list[Any] | None = None,
    all_posts: list[Any] | None = None,
) -> tuple[svc.PostsService, _FakeSession]:
    service = svc.PostsService.__new__(svc.PostsService)
    session = _FakeSession()
    service.session = cast(AsyncSession, session)
    service.posts = cast(
        Any, _FakePostRepo(post, targets, accounts, all_posts)
    )
    service.social_accounts = cast(Any, None)
    return service, session


class _PostStub:
    def __init__(
        self,
        *,
        status: str,
        scheduled_for: datetime | None,
        post_id: str = "post-1",
        user_id: str = "user-1",
        created_at: datetime | None = None,
        media_urls: list[str] | None = None,
    ) -> None:
        self.id = post_id
        self.user_id = user_id
        self.content = "hello"
        self.media_urls = media_urls if media_urls is not None else ["https://cdn/x.jpg"]
        self.status = status
        self.scheduled_for = scheduled_for
        now = datetime.now(UTC).replace(tzinfo=None)
        self.created_at = created_at or now
        self.updated_at = now


class _TargetStub:
    def __init__(
        self,
        *,
        status: str = "pending",
        token: str | None = "t-0",
        target_id: str = "target-1",
        account_id: str = "acc-1",
    ) -> None:
        self.id = target_id
        self.social_account_id = account_id
        self.status = status
        self.dispatch_token = token


async def test_cancel_scheduled_post_marks_post_and_targets_cancelled() -> None:
    post = _PostStub(
        status="scheduled",
        scheduled_for=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2),
    )
    target = _TargetStub(status="pending")
    service, session = _make_service(post, [target])

    await service.cancel_scheduled_post(user_id="user-1", post_id="post-1")

    assert post.status == "cancelled"
    assert target.status == "cancelled"
    assert session.committed == 1


async def test_cancel_404_when_post_missing() -> None:
    service, _ = _make_service(
        _PostStub(status="scheduled", scheduled_for=None), []
    )

    with pytest.raises(NotFoundError):
        await service.cancel_scheduled_post(
            user_id="someone-else", post_id="post-1"
        )


async def test_cancel_409_when_post_already_publishing() -> None:
    service, _ = _make_service(
        _PostStub(status="publishing", scheduled_for=None),
        [_TargetStub(status="publishing")],
    )

    with pytest.raises(ConflictError):
        await service.cancel_scheduled_post(user_id="user-1", post_id="post-1")


async def test_cancel_409_when_post_scheduled_but_target_already_publishing() -> None:
    """Race window: a worker picked up the target before cancel landed."""
    post = _PostStub(
        status="scheduled",
        scheduled_for=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2),
    )
    service, _ = _make_service(post, [_TargetStub(status="publishing")])

    with pytest.raises(ConflictError):
        await service.cancel_scheduled_post(user_id="user-1", post_id="post-1")


async def test_update_409_when_target_already_publishing() -> None:
    post = _PostStub(
        status="scheduled",
        scheduled_for=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2),
    )
    service, _ = _make_service(post, [_TargetStub(status="publishing")])

    with pytest.raises(ConflictError):
        await service.update_scheduled_post(
            user_id="user-1", post_id="post-1", content="new"
        )


# ---------- Update happy paths ----------


async def test_update_content_only_does_not_rotate_token_or_reenqueue(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Editing only `content` should not re-dispatch the worker job."""
    post = _PostStub(
        status="scheduled",
        scheduled_for=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2),
    )
    target = _TargetStub(token="token-original")
    service, _ = _make_service(post, [target])

    enqueued: list[Any] = []

    async def _spy(payload: Any, *, scheduled_for: Any) -> None:
        enqueued.append((payload, scheduled_for))

    monkeypatch.setattr(svc, "enqueue_publish_job", _spy)

    updated = await service.update_scheduled_post(
        user_id="user-1", post_id="post-1", content="new copy"
    )

    assert updated.content == "new copy"
    assert target.dispatch_token == "token-original"
    assert enqueued == []


async def test_update_scheduled_for_rotates_token_and_reenqueues_per_target(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    old_when = datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2)
    new_when = old_when + timedelta(hours=4)
    post = _PostStub(status="scheduled", scheduled_for=old_when)
    target_a = _TargetStub(token="t-A", target_id="t-a", account_id="acc-1")
    target_b = _TargetStub(token="t-B", target_id="t-b", account_id="acc-2")
    service, _ = _make_service(
        post,
        [target_a, target_b],
        accounts=[_AccountStub("acc-1"), _AccountStub("acc-2")],
    )

    enqueued: list[Any] = []

    async def _spy(payload: Any, *, scheduled_for: Any) -> None:
        enqueued.append((payload, scheduled_for))

    monkeypatch.setattr(svc, "enqueue_publish_job", _spy)

    updated = await service.update_scheduled_post(
        user_id="user-1",
        post_id="post-1",
        scheduled_for_raw=new_when.isoformat(),
    )

    assert updated.scheduled_for == new_when
    # Both tokens rotated to fresh values, and to *different* values.
    assert target_a.dispatch_token not in {"t-A", target_b.dispatch_token}
    assert target_b.dispatch_token not in {"t-B"}
    assert len(enqueued) == 2
    assert {payload["target_id"] for payload, _ in enqueued} == {"t-a", "t-b"}
    # Every re-enqueue carries the rotated token (not the original).
    for payload, when in enqueued:
        assert when == new_when
        assert payload["dispatch_token"] not in {"t-A", "t-B"}


async def test_update_scheduled_for_same_value_is_a_noop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    when = datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2)
    post = _PostStub(status="scheduled", scheduled_for=when)
    target = _TargetStub(token="token-original")
    service, _ = _make_service(post, [target])

    enqueued: list[Any] = []

    async def _spy(payload: Any, *, scheduled_for: Any) -> None:
        enqueued.append((payload, scheduled_for))

    monkeypatch.setattr(svc, "enqueue_publish_job", _spy)

    await service.update_scheduled_post(
        user_id="user-1",
        post_id="post-1",
        scheduled_for_raw=when.isoformat(),
    )

    assert target.dispatch_token == "token-original"
    assert enqueued == []


async def test_update_requires_at_least_one_field() -> None:
    post = _PostStub(
        status="scheduled",
        scheduled_for=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2),
    )
    service, _ = _make_service(post, [_TargetStub()])

    with pytest.raises(ValidationError):
        await service.update_scheduled_post(user_id="user-1", post_id="post-1")


async def test_update_rejects_past_scheduled_for() -> None:
    post = _PostStub(
        status="scheduled",
        scheduled_for=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2),
    )
    service, _ = _make_service(post, [_TargetStub()])

    long_ago = (datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=2)).isoformat()
    with pytest.raises(ValidationError):
        await service.update_scheduled_post(
            user_id="user-1", post_id="post-1", scheduled_for_raw=long_ago
        )


async def test_update_blank_content_with_no_media_is_invalid() -> None:
    post = _PostStub(
        status="scheduled",
        scheduled_for=datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=2),
        media_urls=[],
    )
    service, _ = _make_service(post, [_TargetStub()])

    with pytest.raises(ValidationError):
        await service.update_scheduled_post(
            user_id="user-1", post_id="post-1", content="   "
        )


# ---------- Pagination ----------


async def test_list_posts_paginated_round_trip() -> None:
    base = datetime(2026, 6, 16, 12, 0)
    posts = [
        _PostStub(
            status="scheduled",
            scheduled_for=None,
            post_id=f"p{i:02d}",
            created_at=base - timedelta(minutes=i),
        )
        for i in range(7)
    ]
    service, _ = _make_service(
        post=posts[0], targets=[], all_posts=posts
    )

    page1, cursor1 = await service.list_posts_paginated("user-1", limit=3)

    assert len(page1) == 3
    assert [p.id for p, _ in page1] == ["p00", "p01", "p02"]
    assert cursor1 is not None

    page2, cursor2 = await service.list_posts_paginated(
        "user-1", limit=3, cursor=cursor1
    )
    assert [p.id for p, _ in page2] == ["p03", "p04", "p05"]
    assert cursor2 is not None

    page3, cursor3 = await service.list_posts_paginated(
        "user-1", limit=3, cursor=cursor2
    )
    assert [p.id for p, _ in page3] == ["p06"]
    assert cursor3 is None  # last page → no further cursor


async def test_list_posts_paginated_filters_by_status() -> None:
    base = datetime(2026, 6, 16, 12, 0)
    posts = [
        _PostStub(status="scheduled", scheduled_for=None, post_id="p1", created_at=base),
        _PostStub(
            status="published",
            scheduled_for=None,
            post_id="p2",
            created_at=base - timedelta(minutes=1),
        ),
        _PostStub(
            status="scheduled",
            scheduled_for=None,
            post_id="p3",
            created_at=base - timedelta(minutes=2),
        ),
    ]
    service, _ = _make_service(post=posts[0], targets=[], all_posts=posts)

    page, _cursor = await service.list_posts_paginated(
        "user-1", limit=10, status="scheduled"
    )

    assert [p.id for p, _ in page] == ["p1", "p3"]


async def test_list_posts_paginated_clamps_limit_to_max_100() -> None:
    base = datetime(2026, 6, 16, 12, 0)
    posts = [
        _PostStub(
            status="scheduled",
            scheduled_for=None,
            post_id=f"p{i:03d}",
            created_at=base - timedelta(minutes=i),
        )
        for i in range(150)
    ]
    service, _ = _make_service(post=posts[0], targets=[], all_posts=posts)

    page, cursor = await service.list_posts_paginated("user-1", limit=500)

    # 100-row cap with a next cursor since 50 rows remain unread.
    assert len(page) == 100
    assert cursor is not None
