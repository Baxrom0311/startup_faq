"""Add AI analysis and embeddings

Revision ID: 20260714_1220
Revises: 20260714_1205
Create Date: 2026-07-14 12:20:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


revision = "20260714_1220"
down_revision = "20260714_1205"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ai_analysis",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("summary_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["problem_id"], ["problem.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "problem_embedding",
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("embedding", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["problem_id"], ["problem.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("problem_id"),
    )


def downgrade():
    op.drop_table("problem_embedding")
    op.drop_table("ai_analysis")
