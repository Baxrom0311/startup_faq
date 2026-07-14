"""Add problems core tables

Revision ID: 20260713_1137
Revises: 20260713_1117
Create Date: 2026-07-13 11:37:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


revision = "20260713_1137"
down_revision = "20260713_1117"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "sector",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sqlmodel.sql.sqltypes.AutoString(length=80), nullable=False),
        sa.Column("name_uz", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("icon", sqlmodel.sql.sqltypes.AutoString(length=80), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sector_slug"), "sector", ["slug"], unique=True)

    op.create_table(
        "region",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["parent_id"], ["region.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "problem",
        sa.Column("raw_text", sqlmodel.sql.sqltypes.AutoString(length=5000), nullable=True),
        sa.Column("raw_audio_key", sqlmodel.sql.sqltypes.AutoString(length=512), nullable=True),
        sa.Column("region_id", sa.Integer(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sector_id", sa.Integer(), nullable=True),
        sa.Column("transcript", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=True),
        sa.Column("structured_desc", sa.JSON(), nullable=True),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column("severity_score", sa.Float(), nullable=True),
        sa.Column("vote_count", sa.Integer(), nullable=False),
        sa.Column("duplicate_of", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["duplicate_of"], ["problem.id"]),
        sa.ForeignKeyConstraint(["region_id"], ["region.id"]),
        sa.ForeignKeyConstraint(["sector_id"], ["sector.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_problem_status"), "problem", ["status"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_problem_status"), table_name="problem")
    op.drop_table("problem")
    op.drop_table("region")
    op.drop_index(op.f("ix_sector_slug"), table_name="sector")
    op.drop_table("sector")
