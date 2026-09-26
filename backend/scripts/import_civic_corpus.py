from __future__ import annotations

import argparse
import asyncio
import math
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select, text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.core.civic_bundle import (
    CivicBundle,
    chunks_match,
    document_filename,
    load_civic_bundle,
)
from app.db.models import VectorChunk
from app.db.session import AsyncSessionLocal
from app.deps import embedder

BATCH_SIZE = 64


def _chunk_metadata(document: dict[str, Any], chunk: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_id": document.get("source_id"),
        "document_id": document["document_id"],
        "version_id": document["version_id"],
        "source_url": document.get("source_url") or chunk.get("source_url"),
        "title": document.get("title") or chunk.get("title"),
        "language": document.get("language") or chunk.get("language"),
        "category": document.get("category") or chunk.get("category"),
        "document_date": document.get("document_date"),
        "retrieved_at": document.get("retrieved_at") or chunk.get("retrieved_at"),
        "content_sha256": document.get("content_sha256"),
        "heading_path": chunk.get("heading_path"),
        "page_start": chunk.get("page_start"),
        "page_end": chunk.get("page_end"),
        "anchor": chunk.get("anchor"),
    }


async def _is_current(
    document_id: str,
    document: dict[str, Any],
    chunks: list[dict[str, Any]],
) -> bool:
    async with AsyncSessionLocal() as session:
        file = (
            await session.execute(
                text(
                    "SELECT status, chunk_count, filename FROM knowledge_files "
                    "WHERE id = :document_id"
                ),
                {"document_id": document_id},
            )
        ).mappings().first()
        if file is None:
            return False
        stored_rows = list(
            await session.scalars(
                select(VectorChunk).where(VectorChunk.file_id == document_id)
            )
        )
        stored_chunks = [(row.id, row.content) for row in stored_rows]
        if not chunks_match(stored_chunks, chunks):
            return False
        expected_filename = document_filename(document)
        if (
            file.status != "READY"
            or file.chunk_count != len(chunks)
            or file.filename != expected_filename
        ):
            await session.execute(
                text(
                    "UPDATE knowledge_files SET filename = :filename, status = 'READY', "
                    "chunk_count = :chunk_count, "
                    "updated_at = CURRENT_TIMESTAMP WHERE id = :document_id"
                ),
                {
                    "filename": expected_filename,
                    "chunk_count": len(chunks),
                    "document_id": document_id,
                },
            )
        chunks_by_id = {chunk["chunk_id"]: chunk for chunk in chunks}
        for row in stored_rows:
            row.meta = _chunk_metadata(document, chunks_by_id[row.id])
        await session.commit()
        return True


async def _set_processing(document_id: str, document: dict[str, Any], payload: bytes) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                "INSERT INTO knowledge_files "
                "(id, filename, mime_type, size, binary_content, status, chunk_count, "
                "uploaded_by, created_at, updated_at) "
                "VALUES (:id, :filename, :mime_type, :size, :binary_content, "
                "'PROCESSING', NULL, :uploaded_by, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) "
                "ON CONFLICT (id) DO UPDATE SET "
                "filename = EXCLUDED.filename, mime_type = EXCLUDED.mime_type, "
                "size = EXCLUDED.size, binary_content = EXCLUDED.binary_content, "
                "status = 'PROCESSING', chunk_count = NULL, updated_at = CURRENT_TIMESTAMP"
            ),
            {
                "id": document_id,
                "filename": document_filename(document),
                "mime_type": document.get("mime_type", "text/markdown"),
                "size": len(payload),
                "binary_content": payload,
                "uploaded_by": "civic-corpus-import",
            },
        )
        await session.commit()


async def _set_error(document_id: str, exc: Exception) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE knowledge_files SET status = 'ERROR', updated_at = CURRENT_TIMESTAMP "
                "WHERE id = :document_id"
            ),
            {"document_id": document_id},
        )
        await session.commit()


def _validate_embeddings(embeddings: list[list[float]], expected: int) -> None:
    if len(embeddings) != expected:
        raise RuntimeError(f"Embedding count mismatch: expected {expected}, got {len(embeddings)}")
    for embedding in embeddings:
        if len(embedding) != settings.openai_embedding_dim:
            raise RuntimeError(
                f"Embedding dimension mismatch: expected {settings.openai_embedding_dim}, got {len(embedding)}"
            )
        if not all(math.isfinite(value) for value in embedding):
            raise RuntimeError("Embedding contains a non-finite value")


async def _import_document(
    document_id: str,
    document: dict[str, Any],
    payload: bytes,
    chunks: list[dict[str, Any]],
) -> bool:
    if await _is_current(document_id, document, chunks):
        return False

    await _set_processing(document_id, document, payload)
    rows: list[VectorChunk] = []
    for start in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[start : start + BATCH_SIZE]
        embeddings = await embedder.embed_texts([item["text"] for item in batch])
        _validate_embeddings(embeddings, len(batch))
        rows.extend(
            VectorChunk(
                id=item["chunk_id"],
                file_id=document_id,
                content=item["text"],
                embedding=embedding,
                meta=_chunk_metadata(document, item),
            )
            for item, embedding in zip(batch, embeddings, strict=True)
        )

    async with AsyncSessionLocal() as session:
        file_id = await session.scalar(
            text("SELECT id FROM knowledge_files WHERE id = :document_id"),
            {"document_id": document_id},
        )
        if file_id is None:
            raise RuntimeError(f"KnowledgeFile disappeared during import: {document_id}")
        await session.execute(delete(VectorChunk).where(VectorChunk.file_id == document_id))
        session.add_all(rows)
        await session.execute(
            text(
                "UPDATE knowledge_files SET chunk_count = :chunk_count, status = 'READY', "
                "updated_at = CURRENT_TIMESTAMP WHERE id = :document_id"
            ),
            {"chunk_count": len(rows), "document_id": document_id},
        )
        await session.commit()
    return True


async def import_corpus(bundle: CivicBundle, apply: bool) -> dict[str, int]:
    chunks_by_document: dict[str, list[dict[str, Any]]] = {
        document_id: [] for document_id in bundle.documents
    }
    for chunk in bundle.chunks:
        chunks_by_document[chunk["document_id"]].append(chunk)

    summary = {
        "documents": len(bundle.documents),
        "chunks": len(bundle.chunks),
        "imported": 0,
        "skipped": 0,
        "failed": 0,
    }
    if not apply:
        print(
            f"Dry run: validated {summary['documents']} documents and "
            f"{summary['chunks']} chunks; database unchanged"
        )
        return summary

    if not settings.openai_api_key or settings.allow_fake_embeddings:
        raise RuntimeError(
            "Real OPENAI_API_KEY embeddings are required; fake embeddings are disabled for corpus import"
        )
    if settings.openai_embedding_dim != 3072:
        raise RuntimeError("Database vector dimension is 3072; OPENAI_EMBEDDING_DIM must be 3072")

    for index, (document_id, document) in enumerate(bundle.documents.items(), start=1):
        try:
            imported = await _import_document(
                document_id,
                document,
                bundle.markdown[document_id],
                chunks_by_document[document_id],
            )
            summary["imported" if imported else "skipped"] += 1
        except (RuntimeError, ValueError, SQLAlchemyError) as exc:
            summary["failed"] += 1
            await _set_error(document_id, exc)
            print(f"ERROR {document_id}: {exc}", flush=True)
        print(f"Processed {index}/{summary['documents']} documents", flush=True)

    print(f"CIVIS import complete: {summary}", flush=True)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import a civic site bundle without clearing existing data"
    )
    parser.add_argument("--export-path", "--export-dir", dest="export_path", type=Path, required=True)
    parser.add_argument("--source-id", action="append", default=[])
    parser.add_argument("--document-id", action="append", default=[])
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write to the configured database; default is validation-only",
    )
    args = parser.parse_args()
    bundle = load_civic_bundle(
        args.export_path,
        set(args.source_id) or None,
        set(args.document_id) or None,
    )
    summary = asyncio.run(import_corpus(bundle, args.apply))
    if summary["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
