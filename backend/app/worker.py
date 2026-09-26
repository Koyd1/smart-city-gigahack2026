from __future__ import annotations

from datetime import datetime, timedelta

from arq import func
from arq.connections import RedisSettings
from sqlalchemy import or_, select

from app.config import settings
from app.db.models import KnowledgeFile
from app.db.session import AsyncSessionLocal
from app.deps import ingest_pipeline


async def ingest_document(ctx: dict, file_id: str) -> None:
    await ingest_pipeline.run(file_id, attempt=int(ctx.get("job_try", 1)))


async def recover_ingest_jobs(ctx: dict) -> None:
    stale_before = datetime.utcnow() - timedelta(minutes=15)
    async with AsyncSessionLocal() as session:
        rows = await session.scalars(
            select(KnowledgeFile.id).where(
                or_(
                    KnowledgeFile.status == "PENDING",
                    (KnowledgeFile.status == "PROCESSING")
                    & or_(
                        KnowledgeFile.heartbeat_at.is_(None),
                        KnowledgeFile.heartbeat_at < stale_before,
                    ),
                )
            )
        )
        file_ids = list(rows)

    redis = ctx["redis"]
    for file_id in file_ids:
        await redis.enqueue_job("ingest_document", file_id, _job_id=f"ingest:{file_id}")


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [func(ingest_document, max_tries=3, timeout=600, keep_result=0)]
    on_startup = recover_ingest_jobs
    max_jobs = 2
    job_timeout = 600
    health_check_interval = 30
