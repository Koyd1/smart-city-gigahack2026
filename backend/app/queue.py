from __future__ import annotations

import json
from datetime import datetime

from arq import create_pool
from arq.connections import RedisSettings

from app.config import settings


class IngestQueueUnavailable(RuntimeError):
    pass


def civic_bundle_payload_key(job_id: str) -> str:
    return f"civic-bundle:payload:{job_id}"


def civic_bundle_status_key(job_id: str) -> str:
    return f"civic-bundle:status:{job_id}"


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


async def enqueue_civic_bundle_import(job_id: str, filename: str, payload: bytes) -> None:
    redis = None
    payload_key = civic_bundle_payload_key(job_id)
    status_key = civic_bundle_status_key(job_id)
    try:
        redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        await redis.set(payload_key, payload)
        await redis.expire(payload_key, 7 * 24 * 60 * 60)
        await redis.hset(
            status_key,
            mapping={
                "id": job_id,
                "filename": filename,
                "status": "PENDING",
                "created_at": datetime.utcnow().isoformat(),
            },
        )
        await redis.expire(status_key, 30 * 24 * 60 * 60)
        await redis.enqueue_job(
            "import_civic_bundle",
            job_id,
            _job_id=f"civic-bundle:{job_id}",
        )
    except Exception as exc:
        if redis is not None:
            await redis.delete(payload_key, status_key)
        raise IngestQueueUnavailable("Civic bundle import queue is unavailable") from exc
    finally:
        if redis is not None:
            await redis.aclose()


async def get_civic_bundle_import(job_id: str) -> dict[str, object] | None:
    redis = None
    try:
        redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        values = await redis.hgetall(civic_bundle_status_key(job_id))
        if not values:
            return None
        decoded = {
            key.decode("utf-8") if isinstance(key, bytes) else key:
                value.decode("utf-8") if isinstance(value, bytes) else value
            for key, value in values.items()
        }
        summary = decoded.get("summary")
        if summary:
            decoded["summary"] = json.loads(summary)
        return decoded
    except Exception as exc:
        raise IngestQueueUnavailable("Civic bundle import status is unavailable") from exc
    finally:
        if redis is not None:
            await redis.aclose()
