"""Drop item table (template leftover)

Revision ID: 20260715_1000
Revises: 20260714_1240
Create Date: 2026-07-15 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "20260715_1000"
down_revision = "20260714_1240"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("item")


def downgrade() -> None:
    op.create_table(
        "item",
        sa.Column("title", sa.VARCHAR(length=255), nullable=False),
        sa.Column("description", sa.VARCHAR(length=255), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
