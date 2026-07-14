"""Add problem status log

Revision ID: 20260713_1201
Revises: 20260713_1145
Create Date: 2026-07-13 12:01:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


revision = "20260713_1201"
down_revision = "20260713_1145"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "problem_status_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_status", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=True),
        sa.Column("to_status", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reason", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["problem_id"], ["problem.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("problem_status_log")
