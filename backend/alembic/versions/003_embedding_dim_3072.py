"""switch vector_chunks embedding to 3072

Revision ID: 003_embedding_dim_3072
Revises: 002
Create Date: 2026-03-14
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "003_embedding_dim_3072"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS vector_chunks_embedding_ivfflat_idx")
    op.execute("TRUNCATE TABLE vector_chunks")
    op.execute("ALTER TABLE vector_chunks ALTER COLUMN embedding TYPE vector(3072)")
    # pgvector ivfflat for vector type is limited to <= 2000 dimensions.
    # For 3072-d embeddings we keep exact search (no ANN index).


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS vector_chunks_embedding_ivfflat_idx")
    op.execute("TRUNCATE TABLE vector_chunks")
    op.execute("ALTER TABLE vector_chunks ALTER COLUMN embedding TYPE vector(1536)")
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS vector_chunks_embedding_ivfflat_idx
        ON vector_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        """
    )
