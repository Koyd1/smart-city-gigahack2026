from __future__ import annotations

import json
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

MAX_ARCHIVE_BYTES = 15 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
SUPPORTED_FORMAT = "civic-site-rag-bundle"
SUPPORTED_FORMAT_VERSION = 1


def chunks_match(stored_chunks: list[tuple[str, str]], expected_chunks: list[dict[str, Any]]) -> bool:
    stored = dict(stored_chunks)
    expected = {chunk["chunk_id"]: chunk["text"] for chunk in expected_chunks}
    return len(stored) == len(stored_chunks) == len(expected) and stored == expected


def document_filename(document: dict[str, Any]) -> str:
    title = str(document.get("title") or "document").lower()
    slug = re.sub(r"[^\w.-]+", "-", title, flags=re.UNICODE).strip("-._")[:60]
    return f"{slug or 'document'}-{document['document_id']}.md"


@dataclass(slots=True)
class CivicBundle:
    documents: dict[str, dict[str, Any]]
    markdown: dict[str, bytes]
    chunks: list[dict[str, Any]]


def _safe_parts(name: str) -> tuple[str, ...]:
    path = PurePosixPath(name)
    if not name or "\\" in name or path.is_absolute() or ".." in path.parts:
        raise ValueError(f"Unsafe bundle path: {name!r}")
    return path.parts


def _markdown_path(document: dict[str, Any]) -> str:
    name = document.get("markdown_path") or document.get("markdown") or document.get("file")
    if not isinstance(name, str) or not name:
        raise ValueError("Each manifest document requires a Markdown file path")
    return name


def _read_directory(export_path: Path) -> tuple[dict[str, Any], bytes, dict[str, bytes]]:
    root = export_path.resolve()
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    chunks = (root / "chunks.jsonl").read_bytes()
    markdown_files: dict[str, bytes] = {}
    for document in manifest.get("documents", []):
        name = _markdown_path(document)
        parts = _safe_parts(name)
        path = root.joinpath(*parts).resolve()
        if not path.is_relative_to(root):
            raise ValueError(f"Bundle path escapes export directory: {name!r}")
        markdown_files[name] = path.read_bytes()
    return manifest, chunks, markdown_files


def _read_zip(export_path: Path) -> tuple[dict[str, Any], bytes, dict[str, bytes]]:
    archive_size = export_path.stat().st_size
    if archive_size > MAX_ARCHIVE_BYTES:
        raise ValueError(f"Bundle exceeds {MAX_ARCHIVE_BYTES} byte compressed-size limit")

    with zipfile.ZipFile(export_path) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if len(names) != len(set(names)):
            raise ValueError("Bundle contains duplicate ZIP paths")
        total_size = sum(entry.file_size for entry in entries)
        if total_size > MAX_UNCOMPRESSED_BYTES:
            raise ValueError(
                f"Bundle exceeds {MAX_UNCOMPRESSED_BYTES} byte uncompressed-size limit"
            )
        for name in names:
            _safe_parts(name)

        manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
        chunks = archive.read("chunks.jsonl")
        markdown_files = {}
        for document in manifest.get("documents", []):
            name = _markdown_path(document)
            _safe_parts(name)
            markdown_files[name] = archive.read(name)
    return manifest, chunks, markdown_files


def load_civic_bundle(
    export_path: Path,
    source_ids: set[str] | None = None,
    document_ids: set[str] | None = None,
) -> CivicBundle:
    export_path = export_path.resolve()
    if export_path.is_dir():
        manifest, chunk_bytes, markdown_files = _read_directory(export_path)
    elif export_path.is_file():
        manifest, chunk_bytes, markdown_files = _read_zip(export_path)
    else:
        raise FileNotFoundError(f"Export does not exist: {export_path}")

    bundle_format = manifest.get("format")
    if bundle_format not in (None, SUPPORTED_FORMAT):
        raise ValueError(f"Unsupported bundle format: {bundle_format}")
    if bundle_format and manifest.get("format_version") != SUPPORTED_FORMAT_VERSION:
        raise ValueError(f"Unsupported bundle version: {manifest.get('format_version')}")

    documents: dict[str, dict[str, Any]] = {}
    selected_paths: dict[str, str] = {}
    declared_versions: set[tuple[str, str]] = set()
    for item in manifest.get("documents", []):
        document_id = item.get("document_id")
        version_id = item.get("version_id")
        markdown_path = _markdown_path(item)
        current_source_id = item.get("source_id", "legacy-civic-export")
        if not document_id or not version_id or not markdown_path:
            raise ValueError("Each manifest document requires document_id, version_id, and file path")
        declared_versions.add((document_id, version_id))
        if source_ids and current_source_id not in source_ids:
            continue
        if document_ids and document_id not in document_ids:
            continue
        if markdown_path not in markdown_files:
            raise ValueError(f"Missing document Markdown: {markdown_path}")
        document = dict(item)
        document["source_id"] = current_source_id
        document["markdown_path"] = markdown_path
        current = documents.get(document_id)
        if current is None or document.get("retrieved_at", "") >= current.get("retrieved_at", ""):
            documents[document_id] = document
            selected_paths[document_id] = markdown_path

    if source_ids and any(
        item.get("source_id") is None for item in manifest.get("documents", [])
    ):
        raise ValueError("Cannot filter a legacy export that has no source_id metadata")
    missing_document_ids = (document_ids or set()) - documents.keys()
    if missing_document_ids:
        missing = ", ".join(sorted(missing_document_ids))
        raise ValueError(f"Requested document IDs not found in selected export: {missing}")
    markdown = {
        document_id: markdown_files[path]
        for document_id, path in selected_paths.items()
    }

    chunks: list[dict[str, Any]] = []
    chunk_ids: set[str] = set()
    chunks_per_document: dict[str, int] = {}
    for line_number, raw_line in enumerate(chunk_bytes.decode("utf-8").splitlines(), start=1):
        if not raw_line.strip():
            continue
        chunk = json.loads(raw_line)
        document_id = chunk.get("document_id")
        version_id = chunk.get("version_id")
        if (document_id, version_id) not in declared_versions:
            raise ValueError(f"Chunk references an unknown document version at line {line_number}")
        if document_id not in documents or version_id != documents[document_id]["version_id"]:
            continue
        if not chunk.get("chunk_id") or not isinstance(chunk.get("text"), str) or not chunk["text"].strip():
            raise ValueError(f"Invalid chunk identity or text at line {line_number}")
        if chunk["chunk_id"] in chunk_ids:
            raise ValueError(f"Duplicate chunk_id: {chunk['chunk_id']}")
        chunk_ids.add(chunk["chunk_id"])
        chunks_per_document[document_id] = chunks_per_document.get(document_id, 0) + 1
        chunks.append(chunk)

    for document_id, document in documents.items():
        expected_chunks = document.get("chunk_count", document.get("chunks"))
        if not chunks_per_document.get(document_id):
            raise ValueError(f"Document has no chunks: {document_id}")
        if expected_chunks is not None and expected_chunks != chunks_per_document[document_id]:
            raise ValueError(f"Chunk count mismatch for document {document_id}")

    if not documents:
        raise ValueError("The selected export contains no documents")
    return CivicBundle(documents=documents, markdown=markdown, chunks=chunks)