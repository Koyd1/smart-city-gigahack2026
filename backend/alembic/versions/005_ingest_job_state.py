"""add durable ingest job state

Revision ID: 005_ingest_job_state
Revises: 004_remove_object_storage
Create Date: 2026-09-26
"""

from alembic import op
import sqlalchemy as sa


revision = "005_ingest_job_state"
down_revision = "004_remove_object_storage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "knowledge_files",
        sa.Column("ingest_attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("knowledge_files", sa.Column("ingest_error", sa.Text(), nullable=True))
    op.add_column("knowledge_files", sa.Column("processing_started_at", sa.DateTime(), nullable=True))
    op.add_column("knowledge_files", sa.Column("heartbeat_at", sa.DateTime(), nullable=True))
    op.create_index(
        "knowledge_files_status_heartbeat_idx",
        "knowledge_files",
        ["status", "heartbeat_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("knowledge_files_status_heartbeat_idx", table_name="knowledge_files")
    op.drop_column("knowledge_files", "heartbeat_at")
    op.drop_column("knowledge_files", "processing_started_at")
    op.drop_column("knowledge_files", "ingest_error")
    op.drop_column("knowledge_files", "ingest_attempts")
