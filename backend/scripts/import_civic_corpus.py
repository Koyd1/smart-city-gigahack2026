from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from sqlalchemy import delete, text

from app.db.models import KnowledgeFile, VectorChunk
from app.db.session import AsyncSessionLocal
from app.deps import embedder


DEFAULT_EXPORT = Path("/data/exports/rag/export-20260925T220757Z")
BATCH_SIZE = 128


def load_export(export_dir: Path) -> tuple[dict[str, dict], list[dict]]:
    manifest = json.loads((export_dir / "manifest.json").read_text(encoding="utf-8"))
    documents = {item["document_id"]: item for item in manifest["documents"]}
    chunks = [
        json.loads(line)
        for line in (export_dir / "chunks.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    return documents, chunks


async def import_corpus(export_dir: Path, replace: bool) -> None:
    documents, chunks = load_export(export_dir)

    async with AsyncSessionLocal() as session:
        if replace:
            await session.execute(delete(VectorChunk))
            await session.execute(delete(KnowledgeFile))

        for document_id, document in documents.items():
            source_path = export_dir / document["file"]
            payload = source_path.read_bytes()
            session.add(
                KnowledgeFile(
                    id=document_id,
                    filename=source_path.name,
                    mime_type="text/markdown",
                    size=len(payload),
                    binary_content=payload,
                    status="PROCESSING",
                    chunk_count=None,
                    uploaded_by="civic-corpus-import",
                    ingest_attempts=1,
                )
            )
        await session.commit()

    imported = 0
    for start in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[start : start + BATCH_SIZE]
        embeddings = await embedder.embed_texts([item["text"] for item in batch])
        async with AsyncSessionLocal() as session:
            session.add_all(
                [
                    VectorChunk(
                        id=item["chunk_id"],
                        file_id=item["document_id"],
                        content=item["text"],
                        embedding=embedding,
                        meta={
                            "filename": documents[item["document_id"]]["file"],
                            "title": item.get("title"),
                            "source_url": item.get("source_url"),
                            "language": item.get("language"),
                            "category": item.get("category"),
                            "heading_path": item.get("heading_path"),
                            "page_start": item.get("page_start"),
                            "page_end": item.get("page_end"),
                            "anchor": item.get("anchor"),
                        },
                    )
                    for item, embedding in zip(batch, embeddings, strict=True)
                ]
            )
            await session.commit()
        imported += len(batch)
        print(f"Imported {imported}/{len(chunks)} chunks", flush=True)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                """
                UPDATE knowledge_files AS file
                SET status = 'READY',
                    chunk_count = counts.chunk_count,
                    ingest_error = NULL,
                    updated_at = NOW()
                FROM (
                    SELECT file_id, COUNT(*)::integer AS chunk_count
                    FROM vector_chunks
                    GROUP BY file_id
                ) AS counts
                WHERE file.id = counts.file_id
                """
            )
        )
        await session.execute(
            text(
                """
                UPDATE knowledge_files AS file
                SET status = 'ERROR',
                    ingest_error = 'No chunks were found in the corpus export',
                    updated_at = NOW()
                WHERE status = 'PROCESSING'
                  AND NOT EXISTS (
                    SELECT 1 FROM vector_chunks AS chunk WHERE chunk.file_id = file.id
                  )
                """
            )
        )
        await session.commit()

    print(f"CIVIS corpus ready: {len(documents)} documents, {len(chunks)} chunks")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--export-dir", type=Path, default=DEFAULT_EXPORT)
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args()
    asyncio.run(import_corpus(args.export_dir, args.replace))


if __name__ == "__main__":
    main()
