"""Add binary_content column to knowledge_files table for database file storage

Revision ID: 002
Revises: 001_vector_chunks
Create Date: 2026-03-06 08:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001_vector_chunks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add binary_content column to knowledge_files table
    op.add_column('knowledge_files', sa.Column('binary_content', sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    # Remove binary_content column from knowledge_files table
    op.drop_column('knowledge_files', 'binary_content')
