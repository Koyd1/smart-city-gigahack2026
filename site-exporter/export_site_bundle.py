from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


def source_id_for(document: dict[str, Any]) -> str:
    raw_path = document.get("extraction", {}).get("raw_path")
    if not isinstance(raw_path, str):
        raise TypeError(f"Document {document.get('document_id')} has no extraction.raw_path")
    parts = PurePosixPath(raw_path).parts
    if len(parts) < 3 or parts[:2] != ("data", "raw"):
        raise ValueError(f"Cannot determine source_id from raw path: {raw_path}")
    return parts[2]


def _validator(project_root: Path, name: str) -> Draft202012Validator:
    schema = json.loads((project_root / "schemas" / name).read_text(encoding="utf-8"))
    return Draft202012Validator(schema, format_checker=FormatChecker())


def build_site_bundle(
    project_root: Path,
    output_path: Path,
    *,
    source_ids: set[str] | None = None,
    include_reference: bool = False,
) -> dict[str, Any]:
    project_root = project_root.resolve()
    output_path = output_path.resolve()
    document_validator = _validator(project_root, "document.schema.json")
    chunk_validator = _validator(project_root, "chunk.schema.json")

    selected: list[tuple[Path, dict[str, Any], str]] = []
    for document_path in sorted((project_root / "data/processed/documents").glob("doc_*/*.json")):
        document = json.loads(document_path.read_text(encoding="utf-8"))
        document_validator.validate(document)
        current_source_id = source_id_for(document)
        if source_ids and current_source_id not in source_ids:
            continue
        if document.get("category") == "reference" and not include_reference:
            continue
        selected.append((document_path, document, current_source_id))

    deduplicated: dict[tuple[str, str], tuple[Path, dict[str, Any], str]] = {}
    duplicate_groups = 0
    for item in selected:
        key = (item[2], item[1]["content_sha256"])
        if key in deduplicated:
            duplicate_groups += 1
            continue
        deduplicated[key] = item
    documents = sorted(
        deduplicated.values(),
        key=lambda item: (item[2], item[1]["source_url"], item[1]["version_id"]),
    )

    manifest_documents: list[dict[str, Any]] = []
    chunk_lines: list[str] = []
    source_counts: dict[str, int] = defaultdict(int)
    archive_files: dict[str, bytes] = {}
    for document_path, document, current_source_id in documents:
        markdown_path = document_path.with_suffix(".md")
        if not markdown_path.is_file():
            raise FileNotFoundError(f"Missing Markdown sibling: {markdown_path}")
        markdown = markdown_path.read_bytes()
        relative_markdown = f"documents/{markdown_path.name}"
        archive_files[relative_markdown] = markdown

        chunks_path = (
            project_root
            / "data/processed/chunks"
            / document["document_id"]
            / f"{document['version_id']}.jsonl"
        )
        document_chunk_lines = chunks_path.read_text(encoding="utf-8").splitlines()
        for line_number, line in enumerate(document_chunk_lines, start=1):
            chunk = json.loads(line)
            chunk_validator.validate(chunk)
            if (
                chunk["document_id"] != document["document_id"]
                or chunk["version_id"] != document["version_id"]
            ):
                raise ValueError(f"Chunk identity mismatch in {chunks_path}:{line_number}")
            chunk_lines.append(line)

        source_counts[current_source_id] += 1
        manifest_documents.append(
            {
                "source_id": current_source_id,
                "document_id": document["document_id"],
                "version_id": document["version_id"],
                "title": document["title"],
                "source_url": document["source_url"],
                "retrieved_at": document["retrieved_at"],
                "content_sha256": document["content_sha256"],
                "language": document["language"],
                "category": document.get("category"),
                "document_type": document.get("document_type"),
                "mime_type": "text/markdown",
                "markdown_path": relative_markdown,
                "markdown_size": len(markdown),
                "chunk_count": len(document_chunk_lines),
            }
        )

    manifest = {
        "format": "civic-site-rag-bundle",
        "format_version": 1,
        "generated_at": datetime.now(UTC).isoformat(),
        "settings": {
            "include_reference": include_reference,
            "source_ids": sorted(source_ids) if source_ids else None,
        },
        "summary": {
            "documents": len(manifest_documents),
            "chunks": len(chunk_lines),
            "duplicate_groups_removed": duplicate_groups,
            "sources": dict(sorted(source_counts.items())),
        },
        "documents": manifest_documents,
    }
    archive_files["manifest.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    archive_files["chunks.jsonl"] = ("\n".join(chunk_lines) + ("\n" if chunk_lines else "")).encode()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(archive_files.items()):
            archive.writestr(name, content)

    return {
        **manifest["summary"],
        "archive": str(output_path),
        "archive_sha256": hashlib.sha256(output_path.read_bytes()).hexdigest(),
        "archive_size": output_path.stat().st_size,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Package processed site data for a RAG importer")
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path)
    parser.add_argument("--source-id", action="append", default=[])
    parser.add_argument("--include-reference", action="store_true")
    args = parser.parse_args()

    generated_at = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    output_path = args.output or (
        args.project_root / "data/exports/site-import" / f"site-bundle-{generated_at}.zip"
    )
    summary = build_site_bundle(
        args.project_root,
        output_path,
        source_ids=set(args.source_id) or None,
        include_reference=args.include_reference,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()