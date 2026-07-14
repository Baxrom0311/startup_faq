"""Add projects core

Revision ID: 20260713_1212
Revises: 20260713_1201
Create Date: 2026-07-13 12:12:00.000000

"""

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


revision = "20260713_1212"
down_revision = "20260713_1201"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "project",
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("pitch", sqlmodel.sql.sqltypes.AutoString(length=3000), nullable=True),
        sa.Column("repo_url", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["lead_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["problem_id"], ["problem.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_status"), "project", ["status"], unique=False)

    op.create_table(
        "projectmember",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("project_id", "user_id"),
    )


def downgrade():
    op.drop_table("projectmember")
    op.drop_index(op.f("ix_project_status"), table_name="project")
    op.drop_table("project")
