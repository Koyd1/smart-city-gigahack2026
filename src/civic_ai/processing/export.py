from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from civic_ai.processing.storage import CorpusStore, atomic_write, json_text


@dataclass(frozen=True, slots=True)
class RagExport:
    root: Path
    documents: int
    chunks: int
    excluded: int
    duplicates: int


def _slug(value: str) -> str:
    slug = re.sub(r"[^\w.-]+", "-", value.lower(), flags=re.UNICODE).strip("-._")
    return slug[:60] or "document"


def build_rag_export(
    project_root: Path,
    *,
    include_reference: bool = False,
    keep_duplicates: bool = False,
) -> RagExport:
    store = CorpusStore(project_root)
    documents: list[tuple[Path, dict[str, Any]]] = []
    excluded: list[dict[str, str]] = []

    for path in sorted(store.documents_root.glob("doc_*/*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        store.document_validator.validate(record)
        if record.get("category") == "reference" and not include_reference:
            excluded.append(
                {
                    "source_url": record["source_url"],
                    "reason": "category=reference",
                }
            )
            continue
        documents.append((path, record))

    duplicate_groups: list[dict[str, Any]] = []
    if not keep_duplicates:
        by_content: dict[str, list[tuple[Path, dict[str, Any]]]] = defaultdict(list)
        for item in documents:
            by_content[item[1]["content_sha256"]].append(item)
        deduplicated: list[tuple[Path, dict[str, Any]]] = []
        for group in by_content.values():
            ordered = sorted(group, key=lambda item: (-len(item[1]["source_url"]), item[1]["source_url"]))
            kept = ordered[0]
            deduplicated.append(kept)
            if len(ordered) > 1:
                duplicate_groups.append(
                    {
                        "kept": kept[1]["source_url"],
                        "skipped": [item[1]["source_url"] for item in ordered[1:]],
                        "content_sha256": kept[1]["content_sha256"],
                    }
                )
        documents = sorted(deduplicated, key=lambda item: item[1]["source_url"])

    generated_at = datetime.now(UTC)
    export_id = generated_at.strftime("export-%Y%m%dT%H%M%SZ")
    export_root = project_root / "data/exports/rag" / export_id
    document_root = export_root / "documents"
    chunks: list[str] = []
    manifest_documents: list[dict[str, Any]] = []
    version_counts = Counter(record["document_id"] for _, record in documents)

    for json_path, record in documents:
        markdown_path = json_path.with_suffix(".md")
        filename = f"{_slug(record['title'])}-{record['document_id']}.md"
        if version_counts[record["document_id"]] > 1:
            filename = (
                f"{_slug(record['title'])}-{record['document_id']}-{record['version_id']}.md"
            )
        target = document_root / filename
        atomic_write(target, markdown_path.read_text(encoding="utf-8"))

        chunk_path = (
            store.chunks_root
            / record["document_id"]
            / f"{record['version_id']}.jsonl"
        )
        document_chunks = chunk_path.read_text(encoding="utf-8").splitlines()
        for line in document_chunks:
            store.chunk_validator.validate(json.loads(line))
            chunks.append(line)
        manifest_documents.append(
            {
                "file": str(target.relative_to(export_root)),
                "document_id": record["document_id"],
                "version_id": record["version_id"],
                "title": record["title"],
                "source_url": record["source_url"],
                "language": record["language"],
                "category": record["category"],
                "chunks": len(document_chunks),
            }
        )

    atomic_write(export_root / "chunks.jsonl", "".join(f"{line}\n" for line in chunks))
    manifest = {
        "export_id": export_id,
        "generated_at": generated_at.isoformat(),
        "usage": {
            "managed_rag": "Upload only the files in documents/",
            "metadata_aware_rag": "Import chunks.jsonl instead of documents/",
            "warning": "Do not upload both formats to the same corpus",
        },
        "settings": {
            "include_reference": include_reference,
            "keep_duplicates": keep_duplicates,
        },
        "summary": {
            "documents": len(manifest_documents),
            "chunks": len(chunks),
            "excluded": len(excluded),
            "duplicate_groups": len(duplicate_groups),
        },
        "documents": manifest_documents,
        "excluded": excluded,
        "duplicates": duplicate_groups,
    }
    atomic_write(export_root / "manifest.json", json_text(manifest))
    atomic_write(
        project_root / "data/exports/rag/latest.json",
        json_text(
            {
                "export_id": export_id,
                "path": str(export_root.relative_to(project_root)),
                "manifest": str((export_root / "manifest.json").relative_to(project_root)),
            }
        ),
    )
    return RagExport(
        root=export_root,
        documents=len(manifest_documents),
        chunks=len(chunks),
        excluded=len(excluded),
        duplicates=len(duplicate_groups),
    )
