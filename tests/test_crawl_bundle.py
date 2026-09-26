from __future__ import annotations

import json
from pathlib import Path
from zipfile import ZipFile

from civic_ai.processing.export import build_crawl_zip


def test_crawl_zip_contains_only_processed_documents_and_report(tmp_path: Path) -> None:
    document_id = "doc_example"
    version_id = "ver_example"
    document_dir = tmp_path / "data/processed/documents" / document_id
    chunks_dir = tmp_path / "data/processed/chunks" / document_id
    document_dir.mkdir(parents=True)
    chunks_dir.mkdir(parents=True)
    document = {
        "document_id": document_id,
        "version_id": version_id,
        "title": "Example page",
        "source_url": "https://example.org/page",
        "language": "en",
        "category": "website",
    }
    (document_dir / f"{version_id}.json").write_text(json.dumps(document))
    (document_dir / f"{version_id}.md").write_text("# Example page\n")
    (chunks_dir / f"{version_id}.jsonl").write_text('{"text":"Example"}\n')
    report = {
        "sources": ["site-example"],
        "items": [
            {
                "status": "processed",
                "document_id": document_id,
                "version_id": version_id,
            },
            {"status": "failed", "url": "https://example.org/missing"},
        ],
    }

    archive_path = build_crawl_zip(tmp_path, report, "test-run")

    with ZipFile(archive_path) as archive:
        names = set(archive.namelist())
        manifest = json.loads(archive.read("manifest.json"))
        bundled_report = json.loads(archive.read("crawl-report.json"))
    assert "chunks.jsonl" in names
    assert len([name for name in names if name.startswith("documents/")]) == 2
    assert manifest["summary"] == {"documents": 1, "chunks": 1}
    assert bundled_report["items"][1]["status"] == "failed"