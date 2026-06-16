"""Add video_recipe table for cron-driven generate-and-post automation.

Also adds ``metadata_json`` to ``video_generation_job`` so the polling
worker can identify recipe-driven jobs and chain them to publishing
once the asset is in R2.

Revision ID: 0006_add_video_recipes
Revises: 0005_add_video_generation_job
Create Date: 2026-05-09
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_add_video_recipes"
down_revision: str | None = "0005_add_video_generation_job"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "video_generation_job",
        sa.Column("metadata_json", sa.Text(), nullable=True),
    )

    op.create_table(
        "video_recipe",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Text(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("caption_template", sa.Text(), nullable=True),
        # JSON-encoded provider-specific input.
        sa.Column("params_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        # JSON-encoded list of social_account ids to target on each run.
        sa.Column(
            "target_social_account_ids_json",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        # Discrete fixed cadences keep the cron parser out of the build.
        sa.Column("frequency", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("next_run_at", sa.DateTime(), nullable=True),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("last_run_job_id", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_video_recipe_active_due",
        "video_recipe",
        ["is_active", "next_run_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_video_recipe_active_due", "video_recipe")
    op.drop_table("video_recipe")
    op.drop_column("video_generation_job", "metadata_json")
