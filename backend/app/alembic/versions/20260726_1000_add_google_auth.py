"""add_google_auth

Revision ID: 20260726_1000
Revises: 20260719_1000
Create Date: 2026-07-26 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260726_1000'
down_revision = '20260719_1000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user', sa.Column('google_id', sa.String(length=255), nullable=True))
    try:
        op.create_unique_constraint('uq_user_google_id', 'user', ['google_id'])
        op.create_index('ix_user_google_id', 'user', ['google_id'], unique=True)
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index('ix_user_google_id', table_name='user')
        op.drop_constraint('uq_user_google_id', 'user', type_='unique')
    except Exception:
        pass
    op.drop_column('user', 'google_id')
