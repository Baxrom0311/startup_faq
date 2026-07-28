"""civic appeal layer: agency, problem routing fields, appeal action log

Adds the government-facing civic-appeal layer additively:
- `agency` table (idoralar)
- routing/tracking columns on `problem` (track, agency_id, report_count,
  is_emergency, appeal_status, appeal_due_date, appeal_resolved_at)
- `appeal_action_log` table (execution history)

The existing startup problem flow is unaffected (track defaults to 'startup').

Revision ID: 20260727_1000
Revises: 20260726_1300
Create Date: 2026-07-27

"""
import sqlalchemy as sa
from alembic import op

revision = "20260727_1000"
down_revision = "20260726_1300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agency",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name_uz", sa.String(length=255), nullable=False),
        sa.Column("name_ru", sa.String(length=255), nullable=True),
        sa.Column("name_en", sa.String(length=255), nullable=True),
        sa.Column("icon", sa.String(length=80), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agency_slug", "agency", ["slug"], unique=True)

    op.add_column(
        "problem",
        sa.Column("track", sa.String(length=16), nullable=False, server_default="startup"),
    )
    op.add_column("problem", sa.Column("agency_id", sa.Integer(), nullable=True))
    op.add_column(
        "problem",
        sa.Column("report_count", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "problem",
        sa.Column("is_emergency", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("problem", sa.Column("appeal_status", sa.String(length=20), nullable=True))
    op.add_column("problem", sa.Column("appeal_due_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("problem", sa.Column("appeal_resolved_at", sa.DateTime(timezone=True), nullable=True))

    op.create_foreign_key(
        "problem_agency_id_fkey", "problem", "agency", ["agency_id"], ["id"]
    )
    op.create_index("ix_problem_track", "problem", ["track"])
    op.create_index("ix_problem_agency_id", "problem", ["agency_id"])
    op.create_index("ix_problem_is_emergency", "problem", ["is_emergency"])
    op.create_index("ix_problem_appeal_status", "problem", ["appeal_status"])

    op.create_table(
        "appeal_action_log",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("problem_id", sa.Uuid(), nullable=False),
        sa.Column("agency_id", sa.Integer(), nullable=True),
        sa.Column("from_status", sa.String(length=20), nullable=True),
        sa.Column("to_status", sa.String(length=20), nullable=False),
        sa.Column("note", sa.String(length=1000), nullable=True),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["problem_id"], ["problem.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agency_id"], ["agency.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_appeal_action_log_problem_id", "appeal_action_log", ["problem_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_appeal_action_log_problem_id", table_name="appeal_action_log")
    op.drop_table("appeal_action_log")

    op.drop_index("ix_problem_appeal_status", table_name="problem")
    op.drop_index("ix_problem_is_emergency", table_name="problem")
    op.drop_index("ix_problem_agency_id", table_name="problem")
    op.drop_index("ix_problem_track", table_name="problem")
    op.drop_constraint("problem_agency_id_fkey", "problem", type_="foreignkey")
    op.drop_column("problem", "appeal_resolved_at")
    op.drop_column("problem", "appeal_due_date")
    op.drop_column("problem", "appeal_status")
    op.drop_column("problem", "is_emergency")
    op.drop_column("problem", "report_count")
    op.drop_column("problem", "agency_id")
    op.drop_column("problem", "track")

    op.drop_index("ix_agency_slug", table_name="agency")
    op.drop_table("agency")
