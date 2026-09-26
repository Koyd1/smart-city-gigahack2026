from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from openai import AsyncOpenAI
from redis.asyncio import from_url as redis_from_url
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import VectorChunk
from app.deps import get_db

router = APIRouter(prefix="/health", tags=["health"])
LOGGER = logging.getLogger(__name__)

WINDOWS: dict[str, timedelta] = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}


@router.get("/detailed")
async def detailed_health(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    openai_data = await _check_openai()
    redis_data = await _check_redis()
    database_data = await _check_database(db)
    analytics = await _build_analytics(db)

    services_status = _section_status(all([openai_data["ok"], redis_data["ok"], database_data["ok"]]), warn=False)
    usage_status = "warn" if analytics["coverage"]["missingPricingModels"] else "ok"
    quality_status = (
        "warn"
        if analytics["quality"]["windows"]["24h"]["avgHallScore"] > settings.health_hall_warn_threshold
        else "ok"
    )
    coverage_status = (
        "warn"
        if analytics["coverage"]["judgeCoverage30d"]["coveragePct"] < 70
        or analytics["coverage"]["telemetryCoverage30d"]["coveragePct"] < 70
        or analytics["coverage"]["missingPricingModels"]
        else "ok"
    )

    status = "ok"
    if services_status == "error":
        status = "error"
    elif (
        openai_data["latencyMs"] > settings.health_openai_warn_ms
        or usage_status == "warn"
        or quality_status == "warn"
        or coverage_status == "warn"
    ):
        status = "warn"

    return {
        "status": status,
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "status": services_status,
            "openai": openai_data,
            "redis": redis_data,
            "database": database_data,
        },
        "usage": {
            "status": usage_status,
            **analytics["usage"],
        },
        "quality": {
            "status": quality_status,
            **analytics["quality"],
        },
        "coverage": {
            "status": coverage_status,
            **analytics["coverage"],
        },
    }


def _section_status(ok: bool, *, warn: bool) -> str:
    if not ok:
        return "error"
    return "warn" if warn else "ok"


async def _check_openai() -> dict[str, Any]:
    if not settings.openai_api_key:
        return {"ok": False, "latencyMs": -1, "detail": "OPENAI_API_KEY is missing"}

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    started = time.perf_counter()
    try:
        await client.embeddings.create(
            model=settings.openai_embedding_model,
            input=["healthcheck"],
            dimensions=settings.openai_embedding_dim,
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {"ok": True, "latencyMs": latency_ms, "model": settings.openai_embedding_model}
    except Exception as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        LOGGER.warning("health.openai_check_failed", extra={"latency_ms": latency_ms, "error": str(exc)})
        return {"ok": False, "latencyMs": latency_ms, "detail": "openai_check_failed"}


async def _check_redis() -> dict[str, Any]:
    started = time.perf_counter()
    client = redis_from_url(settings.redis_url, decode_responses=True)
    try:
        pong = await client.ping()
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {"ok": bool(pong), "latencyMs": latency_ms}
    except Exception as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        LOGGER.warning("health.redis_check_failed", extra={"latency_ms": latency_ms, "error": str(exc)})
        return {"ok": False, "latencyMs": latency_ms, "detail": "redis_check_failed"}
    finally:
        await client.aclose()


async def _check_database(db: AsyncSession) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        chunk_count = await db.scalar(select(func.count(VectorChunk.id)))
        message_count = await db.execute(text("SELECT COUNT(*) AS count FROM messages"))
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {
            "ok": True,
            "latencyMs": latency_ms,
            "chunkCount": int(chunk_count or 0),
            "messageCount": int(message_count.scalar() or 0),
        }
    except Exception as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        LOGGER.warning("health.database_check_failed", extra={"latency_ms": latency_ms, "error": str(exc)})
        return {
            "ok": False,
            "latencyMs": latency_ms,
            "chunkCount": 0,
            "messageCount": 0,
            "detail": "database_check_failed",
        }


async def _build_analytics(db: AsyncSession) -> dict[str, Any]:
    since_30d = datetime.utcnow() - WINDOWS["30d"]

    usage = await _summarize_usage(db, since_30d)
    quality = await _summarize_quality(db, since_30d)
    coverage = await _summarize_coverage(db, since_30d)

    return {
        "usage": usage,
        "quality": quality,
        "coverage": coverage,
    }


async def _summarize_usage(db: AsyncSession, since_30d: datetime) -> dict[str, Any]:
    """Get usage metrics directly from SQL aggregations."""
    # Get window summaries using SQL
    windows = {}
    for label, delta in WINDOWS.items():
        since_window = datetime.utcnow() - delta
        windows[label] = await _usage_window_summary_sql(db, since_window)

    # Get daily trends using SQL
    trends30d = await _get_usage_trends_sql(db, since_30d)

    # Get operations breakdown using SQL
    operations30d = await _get_usage_breakdown_sql(db, since_30d, group_by="operation")

    # Get models breakdown using SQL
    models30d = await _get_usage_breakdown_sql(db, since_30d, group_by="model")

    return {
        "windows": windows,
        "trends30d": trends30d,
        "operations30d": operations30d,
        "models30d": models30d,
    }


async def _usage_window_summary_sql(db: AsyncSession, since: datetime) -> dict[str, Any]:
    """Get usage summary for a time window using SQL."""
    result = (await db.execute(
        text(
            """
            SELECT
              COUNT(*) as requests,
              COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
              COALESCE(SUM(completion_tokens), 0) as completion_tokens,
              COALESCE(SUM(total_tokens), 0) as total_tokens,
              COALESCE(SUM(cost_total_usd), 0) as spend_usd,
              COALESCE(AVG(NULLIF(latency_ms, 0)), NULL) as avg_latency_ms
            FROM ai_usage_events
            WHERE created_at >= :since
            """
        ),
        {"since": since},
    )).mappings().one()

    return {
        "requests": int(result["requests"]),
        "promptTokens": int(result["prompt_tokens"]),
        "completionTokens": int(result["completion_tokens"]),
        "totalTokens": int(result["total_tokens"]),
        "spendUsd": round(float(result["spend_usd"]), 6),
        "avgLatencyMs": round(float(result["avg_latency_ms"]), 1) if result["avg_latency_ms"] else None,
    }


async def _get_usage_trends_sql(db: AsyncSession, since: datetime) -> list[dict[str, Any]]:
    """Get daily usage trends using SQL."""
    trends = (await db.execute(
        text(
            """
            SELECT
              DATE(created_at) as day,
              COUNT(*) as requests,
              COALESCE(SUM(total_tokens), 0) as total_tokens,
              COALESCE(SUM(cost_total_usd), 0) as spend_usd
            FROM ai_usage_events
            WHERE created_at >= :since
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            """
        ),
        {"since": since},
    )).mappings().all()

    return [
        {
            "day": row["day"].isoformat() if hasattr(row["day"], "isoformat") else str(row["day"]),
            "exactTokens": int(row["total_tokens"]),
            "estimatedTokens": 0,
            "exactSpendUsd": round(float(row["spend_usd"]), 6),
            "estimatedSpendUsd": 0.0,
            "requests": int(row["requests"]),
        }
        for row in trends
    ]


async def _get_usage_breakdown_sql(
    db: AsyncSession, since: datetime, group_by: str
) -> list[dict[str, Any]]:
    """Get usage breakdown by operation or model."""
    if group_by == "operation":
        query = """
            SELECT
              operation as key_val,
              operation,
              COUNT(*) as requests,
              COALESCE(SUM(total_tokens), 0) as total_tokens,
              COALESCE(SUM(cost_total_usd), 0) as cost_total_usd,
              COALESCE(AVG(NULLIF(latency_ms, 0)), NULL) as avg_latency_ms,
              CASE WHEN SUM(cost_total_usd) IS NULL THEN 1 ELSE 0 END as missing_pricing
            FROM ai_usage_events
            WHERE created_at >= :since
            GROUP BY operation
            ORDER BY total_tokens DESC
        """
    else:  # group_by == "model"
        query = """
            SELECT
              model as key_val,
              'chat' as operation,
              COUNT(*) as requests,
              COALESCE(SUM(total_tokens), 0) as total_tokens,
              COALESCE(SUM(cost_total_usd), 0) as cost_total_usd,
              COALESCE(AVG(NULLIF(latency_ms, 0)), NULL) as avg_latency_ms,
              CASE WHEN SUM(cost_total_usd) IS NULL THEN 1 ELSE 0 END as missing_pricing
            FROM ai_usage_events
            WHERE created_at >= :since
            GROUP BY model
            ORDER BY total_tokens DESC
        """
    
    results = (await db.execute(text(query), {"since": since})).mappings().all()

    rows = []
    for row in results:
        rows.append(
            {
                group_by: str(row["key_val"]) if row["key_val"] else "unknown",
                "operation": str(row["operation"]),
                "requests": int(row["requests"]),
                "exactTokens": int(row["total_tokens"]),
                "estimatedTokens": 0,
                "totalTokens": int(row["total_tokens"]),
                "costTotalUsd": round(float(row["cost_total_usd"]), 6),
                "avgLatencyMs": round(float(row["avg_latency_ms"]), 1) if row["avg_latency_ms"] else None,
                "missingPricing": bool(row["missing_pricing"]),
            }
        )

    return rows


async def _summarize_quality(db: AsyncSession, since: datetime) -> dict[str, Any]:
    """Get quality metrics directly from SQL aggregations."""
    now = datetime.utcnow()

    # Get window summaries
    windows = {}
    for label, delta in WINDOWS.items():
        since_window = now - delta
        windows[label] = await _quality_window_summary_sql(db, since_window)

    # Get daily trends
    trends30d = await _get_quality_trends_sql(db, since)

    # Get reason breakdown
    reasons = await _get_reason_breakdown_sql(db, since)

    # Get risk buckets breakdown
    risk_buckets = await _get_risk_buckets_sql(db, since)

    # Get risky answers for display
    risky_answers = await _get_risky_answers_sql(db, since)

    return {
        "windows": windows,
        "trends30d": trends30d,
        "reasonBreakdown30d": reasons,
        "riskBuckets30d": risk_buckets,
        "riskyAnswers": risky_answers,
    }


async def _quality_window_summary_sql(db: AsyncSession, since: datetime) -> dict[str, Any]:
    """Get quality summary for a time window using SQL."""
    result = (await db.execute(
        text(
            """
            SELECT
              COUNT(*) as message_count,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hall_score) as median_score,
              PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY hall_score) as p95_score,
              AVG(hall_score) as avg_score,
              SUM(CASE WHEN hall_score_source = 'judge' THEN 1 ELSE 0 END) as judged,
              SUM(CASE WHEN hall_score_source IN ('heuristic', 'pending') OR hall_score_source IS NULL THEN 1 ELSE 0 END) as heuristic,
              SUM(CASE WHEN hall_score >= 0.85 THEN 1 ELSE 0 END) as high_risk_count,
              SUM(CASE WHEN f.rating = -1 AND m.hall_score >= :hall_warn_threshold THEN 1 ELSE 0 END) as negative_feedback_overlap
            FROM messages m
            LEFT JOIN feedbacks f ON f.message_id = m.id
            WHERE m.role = 'assistant' AND m.created_at >= :since
            """
        ),
        {"since": since, "hall_warn_threshold": settings.health_hall_warn_threshold},
    )).mappings().one()

    scores = result["avg_score"] or 0.0
    p95_score = result["p95_score"] or 0.0
    
    return {
        "messages": int(result["message_count"] or 0),
        "avgHallScore": round(float(scores), 4),
        "p95HallScore": round(float(p95_score), 4),
        "judgedSamples": int(result["judged"] or 0),
        "heuristicSamples": int(result["heuristic"] or 0),
        "highRiskCount": int(result["high_risk_count"] or 0),
        "negativeFeedbackOverlapCount": int(result["negative_feedback_overlap"] or 0),
    }


async def _get_quality_trends_sql(db: AsyncSession, since: datetime) -> list[dict[str, Any]]:
    """Get daily quality trends using SQL."""
    trends = (await db.execute(
        text(
            """
            SELECT
              DATE(m.created_at) as day,
              AVG(m.hall_score) as avg_score,
              PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.hall_score) as p95_score,
              SUM(CASE WHEN m.hall_score_source = 'judge' THEN 1 ELSE 0 END) as judged,
              SUM(CASE WHEN m.hall_score_source IN ('heuristic', 'pending') OR m.hall_score_source IS NULL THEN 1 ELSE 0 END) as heuristic,
              SUM(CASE WHEN m.hall_score >= 0.85 THEN 1 ELSE 0 END) as high_risk_count,
              SUM(CASE WHEN f.rating = -1 THEN 1 ELSE 0 END) as negative_feedback
            FROM messages m
            LEFT JOIN feedbacks f ON f.message_id = m.id
            WHERE m.role = 'assistant' AND m.created_at >= :since
            GROUP BY DATE(m.created_at)
            ORDER BY day ASC
            """
        ),
        {"since": since},
    )).mappings().all()

    return [
        {
            "day": row["day"].isoformat() if hasattr(row["day"], "isoformat") else str(row["day"]),
            "avgHallScore": round(float(row["avg_score"] or 0), 4),
            "p95HallScore": round(float(row["p95_score"] or 0), 4),
            "judgedSamples": int(row["judged"] or 0),
            "heuristicSamples": int(row["heuristic"] or 0),
            "highRiskCount": int(row["high_risk_count"] or 0),
            "negativeFeedbackCount": int(row["negative_feedback"] or 0),
        }
        for row in trends
    ]


async def _get_reason_breakdown_sql(db: AsyncSession, since: datetime) -> list[dict[str, Any]]:
    """Get hallucination reason breakdown."""
    reasons = (await db.execute(
        text(
            """
            SELECT
              hall_reason as reason,
              COUNT(*) as count
            FROM messages
            WHERE role = 'assistant'
              AND created_at >= :since
              AND hall_reason IS NOT NULL
              AND hall_reason != ''
            GROUP BY hall_reason
            ORDER BY count DESC
            """
        ),
        {"since": since},
    )).mappings().all()

    return [
        {"reason": row["reason"], "count": int(row["count"])}
        for row in reasons
        if row["reason"] and row["reason"] != "unknown"
    ]


async def _get_risk_buckets_sql(db: AsyncSession, since: datetime) -> list[dict[str, Any]]:
    """Get risk bucket distribution."""
    buckets = (await db.execute(
        text(
            """
            SELECT
              CASE
                WHEN hall_score >= 0.85 THEN 'high'
                WHEN hall_score >= 0.65 THEN 'elevated'
                WHEN hall_score >= 0.2 THEN 'moderate'
                ELSE 'low'
              END as risk_bucket,
              COUNT(*) as count
            FROM messages
            WHERE role = 'assistant'
              AND created_at >= :since
              AND hall_score IS NOT NULL
            GROUP BY risk_bucket
            """
        ),
        {"since": since},
    )).mappings().all()

    bucket_dict = {"low": 0, "moderate": 0, "elevated": 0, "high": 0}
    for row in buckets:
        bucket_dict[row["risk_bucket"]] = int(row["count"])

    return [{"bucket": bucket, "count": count} for bucket, count in bucket_dict.items()]


async def _get_risky_answers_sql(db: AsyncSession, since: datetime) -> list[dict[str, Any]]:
    """Get top risky answers for display."""
    answers = (await db.execute(
        text(
            """
            SELECT
              m.id,
              m.session_id,
              m.created_at,
              m.content,
              m.hall_score,
              m.hall_reason,
              m.hall_score_source,
              f.rating as feedback_rating,
              aue.model
            FROM messages m
            LEFT JOIN feedbacks f ON f.message_id = m.id
            LEFT JOIN ai_usage_events aue ON aue.message_id = m.id AND aue.operation = 'chat'
            WHERE m.role = 'assistant'
              AND m.created_at >= :since
              AND m.hall_score >= 0.85
            ORDER BY m.hall_score DESC
            LIMIT 12
            """
        ),
        {"since": since},
    )).mappings().all()

    return [
        {
            "messageId": row["id"],
            "sessionId": row["session_id"],
            "createdAt": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
            "model": row["model"] or settings.openai_chat_model,
            "hallScore": round(float(row["hall_score"] or 0), 4),
            "hallReason": str(row["hall_reason"] or "unknown"),
            "hallScoreSource": row["hall_score_source"] or "heuristic",
            "feedbackRating": row["feedback_rating"],
            "answerExcerpt": str(row["content"] or "")[:240],
        }
        for row in answers
    ]


async def _summarize_coverage(db: AsyncSession, since: datetime) -> dict[str, Any]:
    """Get coverage metrics using SQL."""
    # Count assistant messages
    assistant_count = await db.scalar(
        text(
            """
            SELECT COUNT(*)
            FROM messages
            WHERE role = 'assistant' AND created_at >= :since
            """
        ),
        {"since": since},
    )
    assistant_count = int(assistant_count or 0)

    # Count messages with exact usage
    telemetry_covered = await db.scalar(
        text(
            """
            SELECT COUNT(DISTINCT message_id)
            FROM ai_usage_events
            WHERE message_id IS NOT NULL
              AND operation = 'chat'
              AND created_at >= :since
            """
        ),
        {"since": since},
    )
    telemetry_covered = int(telemetry_covered or 0)

    # Count judged messages
    judge_covered = await db.scalar(
        text(
            """
            SELECT COUNT(*)
            FROM messages
            WHERE role = 'assistant'
              AND hall_score_source = 'judge'
              AND created_at >= :since
            """
        ),
        {"since": since},
    )
    judge_covered = int(judge_covered or 0)

    # Get missing pricing models
    missing_pricing = (await db.execute(
        text(
            """
            SELECT DISTINCT model
            FROM ai_usage_events
            WHERE cost_total_usd IS NULL AND created_at >= :since
            ORDER BY model
            """
        ),
        {"since": since},
    )).scalars().all()

    # Get last exact usage event
    last_exact_event = await db.scalar(
        text(
            """
            SELECT MAX(created_at)
            FROM ai_usage_events
            WHERE created_at >= :since
            """
        ),
        {"since": since},
    )

    return {
        "telemetryCoverage30d": {
            "assistantMessages": assistant_count,
            "withExactUsage": telemetry_covered,
            "withoutUsage": max(assistant_count - telemetry_covered, 0),
            "coveragePct": round((telemetry_covered / assistant_count) * 100, 2) if assistant_count else 100.0,
        },
        "judgeCoverage30d": {
            "assistantMessages": assistant_count,
            "judged": judge_covered,
            "heuristicOnly": max(assistant_count - judge_covered, 0),
            "coveragePct": round((judge_covered / assistant_count) * 100, 2) if assistant_count else 100.0,
        },
        "missingPricingModels": sorted([str(m) for m in missing_pricing if m]),
        "lastExactUsageEventAt": last_exact_event.isoformat() if last_exact_event else None,
        "legacyEstimateMessages30d": 0,
    }


def _within_window(created_at: datetime, now: datetime, delta: timedelta) -> bool:
    return created_at >= now - delta


def _percentile(values: list[float], percentile: int) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round(((percentile / 100) * (len(ordered) - 1)))))
    return round(ordered[index], 4)
