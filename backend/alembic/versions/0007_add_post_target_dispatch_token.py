"""Add post_target.dispatch_token so the worker can detect stale dispatches.

Public-API ``PATCH /posts/{id}`` rotates the token when ``scheduled_for``
changes; the worker compares the payload token against the DB row and
skips early when they diverge so the previously enqueued ARQ job doesn't
double-post after the schedule moves.

Revision ID: 0007_add_post_target_dispatch_token
Revises: 0006_add_video_recipes
Create Date: 2026-06-16
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_add_post_target_dispatch_token"
down_revision: str | None = "0006_add_video_recipes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "post_target",
        sa.Column("dispatch_token", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("post_target", "dispatch_token")
