"""Add project reviews

Revision ID: 20260713_1305
Revises: 20260713_1238
Create Date: 2026-07-13 13:05:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


revision = "20260713_1305"
down_revision = "20260713_1238"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "review",
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("text", sqlmodel.sql.sqltypes.AutoString(length=2000), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("rating >= 1 AND rating <= 5"),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewer_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade():
    op.drop_table("review")
