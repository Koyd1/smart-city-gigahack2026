import json
import zipfile

import pytest

from app.core.civic_bundle import chunks_match, document_filename, load_civic_bundle


def _write_bundle(
    path,
    *,
    markdown_path="documents/doc-1.md",
    chunk_version="version-1",
    manifest_markdown_key="markdown_path",
):
    document = {
        "source_id": "site-a",
        "document_id": "doc-1",
        "version_id": "version-1",
        "title": "Document",
        "source_url": "https://example.test/document",
        "content_sha256": "a" * 64,
        "chunk_count": 1,
    }
    document[manifest_markdown_key] = markdown_path
    manifest = {
        "format": "civic-site-rag-bundle",
        "format_version": 1,
        "documents": [document],
    }
    chunk = {
        "chunk_id": "chunk-1",
        "document_id": "doc-1",
        "version_id": chunk_version,
        "text": "Document text",
    }
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("chunks.jsonl", json.dumps(chunk) + "\n")
        archive.writestr(markdown_path, "# Document\n")


def test_loads_site_bundle_and_filters_by_source(tmp_path):
    bundle_path = tmp_path / "site-bundle.zip"
    _write_bundle(bundle_path)

    bundle = load_civic_bundle(bundle_path, {"site-a"})

    assert list(bundle.documents) == ["doc-1"]
    assert bundle.documents["doc-1"]["source_id"] == "site-a"
    assert bundle.markdown["doc-1"] == b"# Document\n"
    assert bundle.chunks[0]["text"] == "Document text"


def test_loads_crawler_bundle_markdown_path_key(tmp_path):
    bundle_path = tmp_path / "crawl-export.zip"
    _write_bundle(bundle_path, manifest_markdown_key="markdown")

    bundle = load_civic_bundle(bundle_path)

    assert bundle.markdown["doc-1"] == b"# Document\n"
    assert bundle.chunks[0]["text"] == "Document text"


def test_database_filename_uses_unicode_title_slug_and_document_id():
    assert document_filename(
        {"title": "23 Notificare în comerț", "document_id": "doc_bd8024acc5d231124f2b"}
    ) == "23-notificare-în-comerț-doc_bd8024acc5d231124f2b.md"


def test_chunks_match_requires_identical_ids_and_text():
    expected = [
        {"chunk_id": "chunk-a", "text": "First"},
        {"chunk_id": "chunk-b", "text": "Second"},
    ]

    assert chunks_match([("chunk-b", "Second"), ("chunk-a", "First")], expected)
    assert not chunks_match([("chunk-a", "Old text")], expected)


def test_filters_to_one_document_id(tmp_path):
    bundle_path = tmp_path / "site-bundle.zip"
    _write_bundle(bundle_path)

    bundle = load_civic_bundle(bundle_path, document_ids={"doc-1"})

    assert list(bundle.documents) == ["doc-1"]
    assert len(bundle.chunks) == 1


def test_rejects_unknown_document_id(tmp_path):
    bundle_path = tmp_path / "site-bundle.zip"
    _write_bundle(bundle_path)

    with pytest.raises(ValueError, match="not found in selected export"):
        load_civic_bundle(bundle_path, document_ids={"missing-doc"})


def test_rejects_chunk_version_mismatch(tmp_path):
    bundle_path = tmp_path / "site-bundle.zip"
    _write_bundle(bundle_path, chunk_version="old-version")

    with pytest.raises(ValueError, match="unknown document version"):
        load_civic_bundle(bundle_path)


def test_rejects_unsafe_markdown_path(tmp_path):
    bundle_path = tmp_path / "site-bundle.zip"
    _write_bundle(bundle_path, markdown_path="../outside.md")

    with pytest.raises(ValueError, match="Unsafe bundle path"):
        load_civic_bundle(bundle_path)


def test_selects_latest_version_for_document(tmp_path):
    bundle_path = tmp_path / "versions.zip"
    manifest = {
        "format": "civic-site-rag-bundle",
        "format_version": 1,
        "documents": [
            {
                "source_id": "site-a",
                "document_id": "doc-1",
                "version_id": "version-old",
                "retrieved_at": "2026-09-25T10:00:00+00:00",
                "markdown_path": "documents/old.md",
                "chunk_count": 1,
            },
            {
                "source_id": "site-a",
                "document_id": "doc-1",
                "version_id": "version-new",
                "retrieved_at": "2026-09-26T10:00:00+00:00",
                "markdown_path": "documents/new.md",
                "chunk_count": 1,
            },
        ],
    }
    chunks = [
        {
            "chunk_id": f"chunk-{version}",
            "document_id": "doc-1",
            "version_id": version,
            "text": version,
        }
        for version in ("version-old", "version-new")
    ]
    with zipfile.ZipFile(bundle_path, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("chunks.jsonl", "\n".join(map(json.dumps, chunks)) + "\n")
        archive.writestr("documents/old.md", "old")
        archive.writestr("documents/new.md", "new")

    bundle = load_civic_bundle(bundle_path)

    assert bundle.documents["doc-1"]["version_id"] == "version-new"
    assert bundle.markdown["doc-1"] == b"new"
    assert [chunk["version_id"] for chunk in bundle.chunks] == ["version-new"]


def test_loads_legacy_directory_export(tmp_path):
    export_dir = tmp_path / "export"
    documents_dir = export_dir / "documents"
    documents_dir.mkdir(parents=True)
    (documents_dir / "doc-1.md").write_text("# Document\n", encoding="utf-8")
    (export_dir / "manifest.json").write_text(
        json.dumps(
            {
                "documents": [
                    {
                        "document_id": "doc-1",
                        "version_id": "version-1",
                        "file": "documents/doc-1.md",
                        "chunks": 1,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    (export_dir / "chunks.jsonl").write_text(
        json.dumps(
            {
                "chunk_id": "chunk-1",
                "document_id": "doc-1",
                "version_id": "version-1",
                "text": "Document text",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    bundle = load_civic_bundle(export_dir)

    assert bundle.documents["doc-1"]["source_id"] == "legacy-civic-export"
    assert bundle.markdown["doc-1"] == b"# Document\n"