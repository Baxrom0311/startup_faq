"""add ondelete rules, hot-path indexes, widen projectissue.body

Makes user deletion possible (FKs referencing user were NO ACTION and blocked
DELETE), lets session cleanup drop expired auth sessions safely, adds indexes
on hot per-problem query columns, and widens projectissue.body to match the
model (10000).

Revision ID: 20260726_1200
Revises: 20260726_1000
Create Date: 2026-07-26

"""
from alembic import op
import sqlalchemy as sa

revision = "20260726_1200"
down_revision = "20260726_1000"
branch_labels = None
depends_on = None


# (table, constraint_name, column, referred_table, referred_column, ondelete)
_FKS = [
    ("refresh_tokens", "refresh_tokens_user_id_fkey", "user_id", "user", "id", "CASCADE"),
    ("refresh_tokens", "refresh_tokens_auth_session_token_fkey", "auth_session_token", "auth_session", "token", "SET NULL"),
    ("auth_session", "auth_session_user_id_fkey", "user_id", "user", "id", "SET NULL"),
    ("comment", "comment_user_id_fkey", "user_id", "user", "id", "CASCADE"),
    ("projectmember", "projectmember_user_id_fkey", "user_id", "user", "id", "CASCADE"),
    ("project", "project_lead_id_fkey", "lead_id", "user", "id", "CASCADE"),
    ("project", "project_problem_id_fkey", "problem_id", "problem", "id", "CASCADE"),
    ("project_update", "project_update_author_id_fkey", "author_id", "user", "id", "CASCADE"),
    ("review", "review_reviewer_id_fkey", "reviewer_id", "user", "id", "CASCADE"),
    ("projectissue", "projectissue_author_id_fkey", "author_id", "user", "id", "CASCADE"),
    ("issuecomment", "issuecomment_author_id_fkey", "author_id", "user", "id", "CASCADE"),
    ("problem_status_log", "problem_status_log_actor_id_fkey", "actor_id", "user", "id", "SET NULL"),
    ("problem", "problem_duplicate_of_fkey", "duplicate_of", "problem", "id", "SET NULL"),
]

# (index_name, table, column)
_INDEXES = [
    ("ix_comment_problem_id", "comment", "problem_id"),
    ("ix_project_problem_id", "project", "problem_id"),
    ("ix_problem_author_id", "problem", "author_id"),
    ("ix_ai_analysis_problem_id", "ai_analysis", "problem_id"),
]


def upgrade() -> None:
    # Drop the redundant unique constraint left by the google_auth migration on
    # already-migrated databases (fresh DBs create only the unique index).
    op.execute('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS uq_user_google_id')

    for table, name, col, ref_table, ref_col, ondelete in _FKS:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(
            name, table, ref_table, [col], [ref_col], ondelete=ondelete
        )

    for name, table, col in _INDEXES:
        op.create_index(name, table, [col])

    op.alter_column(
        "projectissue",
        "body",
        existing_type=sa.String(length=5000),
        type_=sa.String(length=10000),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "projectissue",
        "body",
        existing_type=sa.String(length=10000),
        type_=sa.String(length=5000),
        existing_nullable=True,
    )

    for name, table, _col in _INDEXES:
        op.drop_index(name, table_name=table)

    for table, name, col, ref_table, ref_col, _ondelete in _FKS:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(name, table, ref_table, [col], [ref_col])
