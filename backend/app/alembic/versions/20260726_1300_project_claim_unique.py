"""partial unique index preventing duplicate active claims per lead

Revision ID: 20260726_1300
Revises: 20260726_1200
Create Date: 2026-07-26

"""
from alembic import op

revision = "20260726_1300"
down_revision = "20260726_1200"
branch_labels = None
depends_on = None

_INDEX = "uq_active_project_per_lead"
_ACTIVE = "('proposed','approved','in_progress','piloting')"


def upgrade() -> None:
    # A lead may hold only one non-terminal project per problem. A partial
    # unique index enforces this atomically, closing the check-then-insert race
    # in claim_problem (concurrent claims otherwise create duplicates).
    op.execute(
        f"CREATE UNIQUE INDEX {_INDEX} ON project (problem_id, lead_id) "
        f"WHERE status IN {_ACTIVE}"
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {_INDEX}")
