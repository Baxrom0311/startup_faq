"""Add problem media

Revision ID: 20260713_1325
Revises: 20260713_1305
Create Date: 2026-07-13 13:25:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


revision = "20260713_1325"
down_revision = "20260713_1305"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "problem_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column("object_key", sqlmodel.sql.sqltypes.AutoString(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["problem_id"], ["problem.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_problem_media_object_key"), "problem_media", ["object_key"], unique=True)


def downgrade():
    op.drop_index(op.f("ix_problem_media_object_key"), table_name="problem_media")
    op.drop_table("problem_media")
