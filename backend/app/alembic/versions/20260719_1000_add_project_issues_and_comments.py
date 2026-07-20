"""add_project_issues_and_comments

Revision ID: 20260719_1000
Revises: 4dc4129c77d4
Create Date: 2026-07-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '20260719_1000'
down_revision = '4dc4129c77d4'
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    from alembic import op as _op
    conn = _op.get_bind()
    return conn.dialect.has_table(conn, name)


def upgrade():
    if not _table_exists('projectissue'):
        op.create_table(
            'projectissue',
            sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
            sa.Column('body', sqlmodel.sql.sqltypes.AutoString(length=5000), nullable=True),
            sa.Column('kind', sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
            sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('project_id', sa.Uuid(), nullable=False),
            sa.Column('author_id', sa.Uuid(), nullable=False),
            sa.Column('comment_count', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['author_id'], ['user.id'], ),
            sa.ForeignKeyConstraint(['project_id'], ['project.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_projectissue_project_id'), 'projectissue', ['project_id'], unique=False)

    if not _table_exists('issuecomment'):
        op.create_table(
            'issuecomment',
            sa.Column('text', sqlmodel.sql.sqltypes.AutoString(length=5000), nullable=False),
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('issue_id', sa.Uuid(), nullable=False),
            sa.Column('author_id', sa.Uuid(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['author_id'], ['user.id'], ),
            sa.ForeignKeyConstraint(['issue_id'], ['projectissue.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_issuecomment_issue_id'), 'issuecomment', ['issue_id'], unique=False)


def downgrade():
    if _table_exists('issuecomment'):
        op.drop_index(op.f('ix_issuecomment_issue_id'), table_name='issuecomment')
        op.drop_table('issuecomment')
    if _table_exists('projectissue'):
        op.drop_index(op.f('ix_projectissue_project_id'), table_name='projectissue')
        op.drop_table('projectissue')
