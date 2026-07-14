"""Add notifications

Revision ID: 20260713_1345
Revises: 20260713_1325
Create Date: 2026-07-13 13:45:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


revision = "20260713_1345"
down_revision = "20260713_1325"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notification",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sqlmodel.sql.sqltypes.AutoString(length=80), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_status", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_error", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notification_type"), "notification", ["type"], unique=False)
    op.create_index(op.f("ix_notification_user_id"), "notification", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_notification_delivery_status"),
        "notification",
        ["delivery_status"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_notification_delivery_status"), table_name="notification")
    op.drop_index(op.f("ix_notification_user_id"), table_name="notification")
    op.drop_index(op.f("ix_notification_type"), table_name="notification")
    op.drop_table("notification")
