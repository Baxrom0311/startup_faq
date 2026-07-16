"""Add media owner

Revision ID: 20260714_1205
Revises: 20260713_1345
Create Date: 2026-07-14 12:05:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260714_1205"
down_revision = "20260713_1345"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "problem_media",
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE problem_media
        SET uploaded_by = COALESCE(
            (
                SELECT problem.author_id
                FROM problem
                WHERE problem.id = problem_media.problem_id
            ),
            (
                SELECT "user".id
                FROM "user"
                ORDER BY "user".created_at ASC NULLS LAST, "user".id ASC
                LIMIT 1
            )
        )
        """
    )
    op.alter_column("problem_media", "uploaded_by", nullable=False)
    op.create_foreign_key(
        "fk_problem_media_uploaded_by_user",
        "problem_media",
        "user",
        ["uploaded_by"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_problem_media_uploaded_by"),
        "problem_media",
        ["uploaded_by"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_problem_media_uploaded_by"), table_name="problem_media")
    op.drop_constraint(
        "fk_problem_media_uploaded_by_user",
        "problem_media",
        type_="foreignkey",
    )
    op.drop_column("problem_media", "uploaded_by")
