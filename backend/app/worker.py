from __future__ import annotations

import json
import logging
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

from arq import func
from arq.connections import RedisSettings
from sqlalchemy import or_, select

from app.config import settings
from app.core.civic_bundle import load_civic_bundle
from app.db.models import KnowledgeFile
from app.db.session import AsyncSessionLocal
from app.deps import ingest_pipeline
from app.queue import civic_bundle_payload_key, civic_bundle_status_key

LOGGER = logging.getLogger(__name__)


async def ingest_document(ctx: dict, file_id: str) -> None:
    await ingest_pipeline.run(file_id, attempt=int(ctx.get("job_try", 1)))


async def import_civic_bundle(ctx: dict, job_id: str) -> None:
    redis = ctx["redis"]
    payload_key = civic_bundle_payload_key(job_id)
    status_key = civic_bundle_status_key(job_id)
    payload = await redis.get(payload_key)
    if payload is None:
        await redis.hset(status_key, mapping={"status": "ERROR", "error": "Uploaded ZIP expired"})
        return

    await redis.hset(status_key, mapping={"status": "PROCESSING", "error": ""})
    try:
        with tempfile.NamedTemporaryFile(suffix=".zip") as archive_file:
            archive_file.write(payload)
            archive_file.flush()
            bundle = load_civic_bundle(Path(archive_file.name))

        from scripts.import_civic_corpus import import_corpus

        summary = await import_corpus(bundle, apply=True)
        status = "PARTIAL" if summary["failed"] else "READY"
        await redis.hset(
            status_key,
            mapping={
                "status": status,
                "summary": json.dumps(summary),
                "error": "",
            },
        )
    except Exception as exc:
        LOGGER.exception("civic_bundle_import.failed", extra={"job_id": job_id})
        await redis.hset(status_key, mapping={"status": "ERROR", "error": str(exc)[:2000]})
    finally:
        await redis.delete(payload_key)


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
    functions = [
        func(ingest_document, max_tries=3, timeout=600, keep_result=0),
        func(import_civic_bundle, max_tries=1, timeout=3600, keep_result=0),
    ]
    on_startup = recover_ingest_jobs
    max_jobs = 2
    job_timeout = 600
    health_check_interval = 30
