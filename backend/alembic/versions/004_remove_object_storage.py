"""store document content only in PostgreSQL

Revision ID: 004_remove_object_storage
Revises: 003_embedding_dim_3072
Create Date: 2026-09-26
"""

from alembic import op
import sqlalchemy as sa


revision = "004_remove_object_storage"
down_revision = "003_embedding_dim_3072"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rows without database content depended on the removed object store.
    op.execute(
        """
        DELETE FROM vector_chunks
        WHERE file_id IN (
            SELECT id FROM knowledge_files WHERE binary_content IS NULL
        )
        """
    )
    op.execute("DELETE FROM knowledge_files WHERE binary_content IS NULL")
    op.alter_column(
        "knowledge_files",
        "binary_content",
        existing_type=sa.LargeBinary(),
        nullable=False,
    )
    op.drop_column("knowledge_files", "storage_path")


def downgrade() -> None:
    op.add_column(
        "knowledge_files",
        sa.Column("storage_path", sa.String(), nullable=True),
    )
    op.execute(
        """
        UPDATE knowledge_files
        SET storage_path = 'database/' || id
        """
    )
    op.alter_column(
        "knowledge_files",
        "storage_path",
        existing_type=sa.String(),
        nullable=False,
    )
    op.alter_column(
        "knowledge_files",
        "binary_content",
        existing_type=sa.LargeBinary(),
        nullable=True,
    )
