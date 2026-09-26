from __future__ import annotations

from dataclasses import dataclass
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class RetrievedSource:
    file_id: str
    content: str
    metadata: dict | None
    similarity: float
    filename: str | None = None


class Retriever:
    def __init__(self, *, top_k: int, similarity_threshold: float) -> None:
        self._top_k = top_k
        self._similarity_threshold = similarity_threshold

    async def retrieve(
        self,
        db: AsyncSession,
        query_embedding: list[float],
    ) -> list[RetrievedSource]:
        vector_literal = "[" + ",".join(f"{value:.10f}" for value in query_embedding) + "]"

        sql_with_threshold = text(
            """
            SELECT
              file_id,
              content,
              metadata,
              1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
            FROM vector_chunks
            WHERE 1 - (embedding <=> CAST(:embedding AS vector)) >= :threshold
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT :limit
            """
        )

        # Prefer ANN first, but with higher probes to reduce misses on small collections.
        await db.execute(text("SET LOCAL ivfflat.probes = 100"))
        result = await db.execute(
            sql_with_threshold,
            {
                "embedding": vector_literal,
                "threshold": self._similarity_threshold,
                "limit": self._top_k,
            },
        )

        rows = result.mappings().all()

        if not rows:
            LOGGER.info("retriever.ann_empty_fallback", extra={"top_k": self._top_k})
            # Fallback to exact scan when ANN returns nothing.
            await db.execute(text("SET LOCAL enable_indexscan = off"))
            await db.execute(text("SET LOCAL enable_bitmapscan = off"))
            await db.execute(text("SET LOCAL enable_indexonlyscan = off"))

            relaxed_threshold = min(self._similarity_threshold, 0.05)
            fallback_result = await db.execute(
                sql_with_threshold,
                {
                    "embedding": vector_literal,
                    "threshold": relaxed_threshold,
                    "limit": self._top_k,
                },
            )
            rows = fallback_result.mappings().all()

        sources: list[RetrievedSource] = []
        for row in rows:
            similarity = float(row["similarity"])
            sources.append(
                RetrievedSource(
                    file_id=str(row["file_id"]),
                    content=str(row["content"]),
                    metadata=row.get("metadata") if isinstance(row.get("metadata"), dict) else None,
                    similarity=similarity,
                )
            )

        return sources
