"""Add project update media link

Revision ID: 20260714_1240
Revises: 20260714_1220
Create Date: 2026-07-14 12:40:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260714_1240"
down_revision = "20260714_1220"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "problem_media",
        sa.Column("project_update_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_problem_media_project_update_id",
        "problem_media",
        "project_update",
        ["project_update_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_problem_media_project_update_id"),
        "problem_media",
        ["project_update_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_problem_media_project_update_id"), table_name="problem_media")
    op.drop_constraint(
        "fk_problem_media_project_update_id",
        "problem_media",
        type_="foreignkey",
    )
    op.drop_column("problem_media", "project_update_id")
