"""Add Telegram auth fields and sessions

Revision ID: 20260713_1117
Revises: fe56fa70289e
Create Date: 2026-07-13 11:17:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


revision = "20260713_1117"
down_revision = "fe56fa70289e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("user", sa.Column("phone", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=True))
    op.add_column("user", sa.Column("telegram_id", sa.BigInteger(), nullable=True))
    op.add_column("user", sa.Column("telegram_username", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True))
    op.add_column(
        "user",
        sa.Column(
            "roles",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[\"problem_owner\"]'"),
        ),
    )
    op.add_column("user", sa.Column("region_id", sa.Integer(), nullable=True))
    op.add_column("user", sa.Column("bio", sqlmodel.sql.sqltypes.AutoString(length=1000), nullable=True))
    op.add_column("user", sa.Column("reputation", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user", sa.Column("tg_linked_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_user_phone"), "user", ["phone"], unique=True)
    op.create_index(op.f("ix_user_telegram_id"), "user", ["telegram_id"], unique=True)

    op.create_table(
        "auth_session",
        sa.Column("token", sqlmodel.sql.sqltypes.AutoString(length=128), nullable=False),
        sa.Column("phone_entered", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=True),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("client", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=True),
        sa.Column("ip", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("token"),
    )
    op.create_index(op.f("ix_auth_session_phone_entered"), "auth_session", ["phone_entered"], unique=False)
    op.create_index(op.f("ix_auth_session_status"), "auth_session", ["status"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_auth_session_status"), table_name="auth_session")
    op.drop_index(op.f("ix_auth_session_phone_entered"), table_name="auth_session")
    op.drop_table("auth_session")
    op.drop_index(op.f("ix_user_telegram_id"), table_name="user")
    op.drop_index(op.f("ix_user_phone"), table_name="user")
    op.drop_column("user", "tg_linked_at")
    op.drop_column("user", "reputation")
    op.drop_column("user", "bio")
    op.drop_column("user", "region_id")
    op.drop_column("user", "roles")
    op.drop_column("user", "telegram_username")
    op.drop_column("user", "telegram_id")
    op.drop_column("user", "phone")
