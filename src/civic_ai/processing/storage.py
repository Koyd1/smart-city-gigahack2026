from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

from civic_ai.crawler.policy import canonicalize_url, suffix_for_url
from civic_ai.models import ExportedDocument, Extraction, Resource
from civic_ai.processing.chunking import chunk_id, split_markdown

CONTENT_TYPE_SUFFIXES = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/rtf": ".rtf",
    "text/csv": ".csv",
    "text/html": ".html",
    "text/markdown": ".md",
    "text/plain": ".txt",
}


def atomic_write(path: Path, data: str | bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = "wb" if isinstance(data, bytes) else "w"
    kwargs: dict[str, Any] = {} if isinstance(data, bytes) else {"encoding": "utf-8"}
    with tempfile.NamedTemporaryFile(mode=mode, dir=path.parent, delete=False, **kwargs) as handle:
        handle.write(data)
        temporary = Path(handle.name)
    os.replace(temporary, path)
    path.chmod(0o644)


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def normalized_content_type(headers: dict[str, str]) -> str:
    value = next(
        (value for key, value in headers.items() if key.lower() == "content-type"), ""
    )
    return value.split(";", 1)[0].strip().lower()


def resource_suffix(resource: Resource) -> str:
    content_type = normalized_content_type(resource.headers)
    if resource.body.startswith(b"%PDF-"):
        return ".pdf"
    if content_type in CONTENT_TYPE_SUFFIXES:
        return CONTENT_TYPE_SUFFIXES[content_type]
    suffix = suffix_for_url(resource.final_url)
    if suffix:
        return suffix
    guessed = mimetypes.guess_extension(content_type) if content_type else None
    return guessed or ".bin"


def stable_document_id(url: str) -> str:
    canonical = canonicalize_url(url, url) or url
    return f"doc_{hashlib.sha256(canonical.encode()).hexdigest()[:20]}"


class CorpusStore:
    def __init__(self, project_root: Path) -> None:
        self.root = project_root.resolve()
        self.raw_root = self.root / "data/raw"
        self.extracted_root = self.root / "data/interim/extracted"
        self.normalized_root = self.root / "data/interim/normalized"
        self.documents_root = self.root / "data/processed/documents"
        self.chunks_root = self.root / "data/processed/chunks"
        self.document_validator = self._validator("document.schema.json")
        self.chunk_validator = self._validator("chunk.schema.json")

    def _validator(self, name: str) -> Draft202012Validator:
        schema = json.loads((self.root / "schemas" / name).read_text(encoding="utf-8"))
        return Draft202012Validator(schema, format_checker=FormatChecker())

    def save_raw(self, resource: Resource) -> tuple[Path, str]:
        digest = hashlib.sha256(resource.body).hexdigest()
        suffix = resource_suffix(resource)
        raw_path = self.raw_root / resource.source.source_id / f"{digest}{suffix}"
        metadata_path = raw_path.with_suffix(raw_path.suffix + ".meta.json")
        atomic_write(raw_path, resource.body)
        atomic_write(
            metadata_path,
            json_text(
                {
                    "source_id": resource.source.source_id,
                    "category": resource.source.category,
                    "requested_url": resource.url,
                    "final_url": resource.final_url,
                    "retrieved_at": resource.retrieved_at,
                    "status": resource.status,
                    "headers": resource.headers,
                    "content_sha256": digest,
                    "raw_path": str(raw_path.relative_to(self.root)),
                }
            ),
        )
        return raw_path, digest

    def export(
        self,
        resource: Resource,
        extraction: Extraction,
        raw_path: Path,
        raw_digest: str,
    ) -> ExportedDocument:
        source_url = extraction.canonical_url or resource.final_url
        document_id = stable_document_id(source_url)
        content_digest = hashlib.sha256(extraction.markdown.encode("utf-8")).hexdigest()
        version_id = f"ver_{document_id[4:12]}_{content_digest[:12]}"
        relative_raw = str(raw_path.relative_to(self.root))
        extracted_path = self.extracted_root / document_id / f"{version_id}.md"
        normalized_path = self.normalized_root / document_id / f"{version_id}.json"
        document_dir = self.documents_root / document_id
        markdown_path = document_dir / f"{version_id}.md"
        json_path = document_dir / f"{version_id}.json"

        atomic_write(extracted_path, extraction.markdown)
        structure_path: str | None = None
        if extraction.structured is not None:
            structure_file = self.extracted_root / document_id / f"{version_id}.structure.json"
            atomic_write(structure_file, json_text(extraction.structured))
            structure_path = str(structure_file.relative_to(self.root))

        record = {
            "document_id": document_id,
            "version_id": version_id,
            "title": extraction.title,
            "source_url": source_url,
            "retrieved_at": resource.retrieved_at,
            "content_sha256": content_digest,
            "language": extraction.language,
            "category": resource.source.category,
            "document_type": resource_suffix(resource).lstrip("."),
            "document_date": None,
            "effective_from": None,
            "effective_to": None,
            "content": extraction.markdown,
            "extraction": {
                "method": extraction.method,
                "quality": extraction.quality,
                "page_count": extraction.page_count,
                "raw_path": relative_raw,
                "raw_content_sha256": raw_digest,
                "structure_path": structure_path,
            },
        }
        self.document_validator.validate(record)
        atomic_write(normalized_path, json_text(record))
        atomic_write(json_path, json_text(record))
        atomic_write(markdown_path, self._markdown_export(record))

        chunks = self._chunk_records(record)
        chunk_file = self.chunks_root / document_id / f"{version_id}.jsonl"
        atomic_write(chunk_file, "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in chunks))
        self.rebuild_chunk_export()
        return ExportedDocument(
            document_id=document_id,
            version_id=version_id,
            raw_path=raw_path,
            markdown_path=markdown_path,
            json_path=json_path,
            chunk_count=len(chunks),
        )

    def _chunk_records(self, document: dict[str, Any]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for chunk in split_markdown(document["content"]):
            record = {
                "chunk_id": chunk_id(document["version_id"], chunk),
                "document_id": document["document_id"],
                "version_id": document["version_id"],
                "source_url": document["source_url"],
                "title": document["title"],
                "category": document["category"],
                "language": document["language"],
                "heading_path": chunk.heading_path,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
                "anchor": None,
                "text": chunk.text,
                "token_count": chunk.token_count,
                "extraction_quality": document["extraction"]["quality"],
                "retrieved_at": document["retrieved_at"],
            }
            self.chunk_validator.validate(record)
            records.append(record)
        return records

    def rebuild_chunk_export(self) -> None:
        parts = [
            path.read_text(encoding="utf-8")
            for path in sorted(self.chunks_root.glob("doc_*/*.jsonl"))
        ]
        atomic_write(self.chunks_root / "chunks.jsonl", "".join(parts))

    @staticmethod
    def _markdown_export(document: dict[str, Any]) -> str:
        fields = (
            "document_id",
            "version_id",
            "title",
            "source_url",
            "retrieved_at",
            "content_sha256",
            "language",
            "category",
            "document_type",
            "document_date",
            "effective_from",
            "effective_to",
        )
        frontmatter = ["---"]
        for field in fields:
            value = document[field]
            rendered = "null" if value is None else json.dumps(value, ensure_ascii=False)
            frontmatter.append(f"{field}: {rendered}")
        frontmatter.extend(["---", "", document["content"].rstrip(), ""])
        return "\n".join(frontmatter)


def utc_now() -> str:
    return datetime.now(UTC).isoformat()
