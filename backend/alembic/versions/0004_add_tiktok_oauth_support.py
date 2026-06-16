"""Add TikTok OAuth support: granted_scopes column on social_account.

The column is nullable text (comma-separated, as returned by TikTok's
``scope`` field). It enables the publishing worker to gate Direct Post on
the presence of ``video.publish`` without a per-platform schema column.

Revision ID: 0004_add_tiktok_oauth_support
Revises: 0003_add_ai_provider_credentials
Create Date: 2026-05-09
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_add_tiktok_oauth_support"
down_revision: str | None = "0003_add_ai_provider_credentials"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "social_account",
        sa.Column("granted_scopes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("social_account", "granted_scopes")
