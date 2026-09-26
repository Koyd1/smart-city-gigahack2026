"""create vector_chunks table

Revision ID: 001_vector_chunks
Revises:
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = "001_vector_chunks"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "vector_chunks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("file_id", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="vector_chunks_pkey"),
    )

    op.create_index(
        "vector_chunks_file_id_idx",
        "vector_chunks",
        ["file_id"],
        unique=False,
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS vector_chunks_embedding_ivfflat_idx
        ON vector_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS vector_chunks_embedding_ivfflat_idx")
    op.drop_index("vector_chunks_file_id_idx", table_name="vector_chunks")
    op.drop_table("vector_chunks")
