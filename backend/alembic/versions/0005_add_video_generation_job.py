"""Add video_generation_job table for async provider-driven video creation.

Revision ID: 0005_add_video_generation_job
Revises: 0004_add_tiktok_oauth_support
Create Date: 2026-05-09
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_add_video_generation_job"
down_revision: str | None = "0004_add_tiktok_oauth_support"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "video_generation_job",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Text(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        # JSON-encoded provider-specific input (e.g. duration, aspect_ratio).
        sa.Column("params_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("provider_job_id", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'queued'")),
        # Provider-side URL (typically expires within hours).
        sa.Column("provider_output_url", sa.Text(), nullable=True),
        # Stable URL after we mirror the asset into R2.
        sa.Column("output_url", sa.Text(), nullable=True),
        sa.Column("output_key", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_video_generation_job_user_id_created_at",
        "video_generation_job",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_video_generation_job_user_id_created_at", "video_generation_job")
    op.drop_table("video_generation_job")
