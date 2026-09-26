"""reset legacy HR content and add query indexes

Revision ID: 006_civis_domain_reset
Revises: 005_ingest_job_state
Create Date: 2026-09-26
"""

from alembic import op


revision = "006_civis_domain_reset"
down_revision = "005_ingest_job_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The product is now municipal CIVIS. Legacy HR knowledge and suggestions
    # must not influence answers after deployment.
    op.execute("DELETE FROM vector_chunks")
    op.execute("DELETE FROM knowledge_files")
    op.execute("DELETE FROM prompt_templates")
    op.execute("DELETE FROM faq_items")

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS vector_chunks_content_fts_idx
        ON vector_chunks USING gin (to_tsvector('simple', content))
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS messages_role_created_at_idx
        ON messages (role, created_at)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS messages_role_created_at_idx")
    op.execute("DROP INDEX IF EXISTS vector_chunks_content_fts_idx")
