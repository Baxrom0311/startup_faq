"""Add sector name_ru/name_en and user language field

Revision ID: 20260716_1000
Revises: 20260715_1000
Create Date: 2026-07-16 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "20260716_1000"
down_revision = "20260715_1000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sector", sa.Column("name_ru", sa.String(length=255), nullable=True))
    op.add_column("sector", sa.Column("name_en", sa.String(length=255), nullable=True))
    op.add_column(
        "user",
        sa.Column("language", sa.String(length=5), nullable=False, server_default="uz"),
    )


def downgrade() -> None:
    op.drop_column("user", "language")
    op.drop_column("sector", "name_en")
    op.drop_column("sector", "name_ru")
