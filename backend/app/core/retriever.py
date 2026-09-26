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
    def __init__(
        self,
        *,
        top_k: int,
        similarity_threshold: float,
        probes: int = 20,
        exact_scan_max_chunks: int = 1000,
        primary_document_chunks: int = 12,
    ) -> None:
        self._top_k = top_k
        self._similarity_threshold = similarity_threshold
        self._probes = probes
        self._exact_scan_max_chunks = exact_scan_max_chunks
        self._primary_document_chunks = primary_document_chunks

    async def retrieve(
        self,
        db: AsyncSession,
        query_embedding: list[float],
        query_text: str = "",
    ) -> list[RetrievedSource]:
        vector_literal = "[" + ",".join(f"{value:.10f}" for value in query_embedding) + "]"

        sql_with_threshold = text(
            """
            WITH scored AS (
              SELECT
                file_id,
                content,
                metadata,
                1 - (embedding <=> CAST(:embedding AS vector)) AS similarity,
                ts_rank_cd(
                  to_tsvector('simple', content),
                  plainto_tsquery('simple', :query_text)
                ) AS keyword_rank
              FROM vector_chunks
            )
            SELECT file_id, content, metadata, similarity
            FROM scored
            WHERE similarity >= :threshold OR keyword_rank > 0
            ORDER BY (0.85 * similarity + 0.15 * LEAST(keyword_rank, 1.0)) DESC
            LIMIT :limit
            """
        )

        chunk_count = int(await db.scalar(text("SELECT COUNT(*) FROM vector_chunks")) or 0)
        if chunk_count <= self._exact_scan_max_chunks:
            await db.execute(text("SET LOCAL enable_indexscan = off"))
            await db.execute(text("SET LOCAL enable_bitmapscan = off"))
            await db.execute(text("SET LOCAL enable_indexonlyscan = off"))
        else:
            await db.execute(text(f"SET LOCAL ivfflat.probes = {max(1, self._probes)}"))

        result = await db.execute(
            sql_with_threshold,
            {
                "embedding": vector_literal,
                "threshold": self._similarity_threshold,
                "limit": self._top_k,
                "query_text": query_text,
            },
        )

        rows = result.mappings().all()

        if not rows:
            LOGGER.info("retriever.ann_empty_fallback", extra={"top_k": self._top_k})
            # Fallback to exact scan when ANN returns nothing.
            relaxed_threshold = min(self._similarity_threshold, 0.05)
            fallback_result = await db.execute(
                sql_with_threshold,
                {
                    "embedding": vector_literal,
                    "threshold": relaxed_threshold,
                    "limit": self._top_k,
                    "query_text": query_text,
                },
            )
            rows = fallback_result.mappings().all()

        if (
            rows
            and self._primary_document_chunks > 0
            and float(rows[0]["similarity"]) >= max(self._similarity_threshold, 0.45)
        ):
            primary_file_id = str(rows[0]["file_id"])
            primary_result = await db.execute(
                text(
                    """
                    SELECT
                      file_id,
                      content,
                      metadata,
                      1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
                    FROM vector_chunks
                    WHERE file_id = :file_id
                    ORDER BY created_at ASC
                    LIMIT :limit
                    """
                ),
                {
                    "embedding": vector_literal,
                    "file_id": primary_file_id,
                    "limit": self._primary_document_chunks,
                },
            )
            primary_rows = primary_result.mappings().all()
            seen = {(str(row["file_id"]), str(row["content"])) for row in primary_rows}
            rows = [
                *primary_rows,
                *(row for row in rows if (str(row["file_id"]), str(row["content"])) not in seen),
            ]

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
