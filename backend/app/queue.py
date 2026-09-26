from __future__ import annotations

from arq import create_pool
from arq.connections import RedisSettings

from app.config import settings


class IngestQueueUnavailable(RuntimeError):
    pass


async def enqueue_ingest(file_id: str) -> None:
    redis = None
    try:
        redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        await redis.enqueue_job("ingest_document", file_id, _job_id=f"ingest:{file_id}")
    except Exception as exc:
        raise IngestQueueUnavailable("Ingest queue is unavailable") from exc
    finally:
        if redis is not None:
            await redis.aclose()
