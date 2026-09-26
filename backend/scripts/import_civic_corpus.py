from __future__ import annotations

import argparse
import asyncio
import json
from collections import defaultdict
from pathlib import Path

from sqlalchemy import delete

from app.db.models import KnowledgeFile, VectorChunk
from app.db.session import AsyncSessionLocal
from app.deps import embedder


DEFAULT_EXPORT = Path("/data/exports/rag/export-20260925T220757Z")
BATCH_SIZE = 64


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
    chunks_by_document: dict[str, list[dict]] = defaultdict(list)
    for chunk in chunks:
        chunks_by_document[chunk["document_id"]].append(chunk)

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
        for document_id, document_chunks in chunks_by_document.items():
            file = await session.get(KnowledgeFile, document_id)
            if file:
                file.status = "READY"
                file.chunk_count = len(document_chunks)
                file.ingest_error = None
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
