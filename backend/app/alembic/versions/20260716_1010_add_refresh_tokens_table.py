"""Add refresh_tokens table for token rotation

Revision ID: 20260716_1010
Revises: 20260716_1000
Create Date: 2026-07-16 10:10:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "20260716_1010"
down_revision = "20260716_1000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("jti", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("family", sa.UUID(), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("auth_session_token", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["auth_session_token"], ["auth_session.token"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("jti"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_family", "refresh_tokens", ["family"])
    op.create_index("ix_refresh_tokens_auth_session_token", "refresh_tokens", ["auth_session_token"])


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_auth_session_token", "refresh_tokens")
    op.drop_index("ix_refresh_tokens_family", "refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", "refresh_tokens")
    op.drop_table("refresh_tokens")
