import json
from pathlib import Path

from civic_ai.models import Resource, Source
from civic_ai.processing.export import build_rag_export
from civic_ai.processing.processor import ResourceProcessor


def test_rag_export_preserves_versions_with_same_title_and_canonical(tmp_path: Path) -> None:
    (tmp_path / "schemas").mkdir()
    project_root = Path(__file__).resolve().parents[1]
    for schema in ("document.schema.json", "chunk.schema.json"):
        (tmp_path / "schemas" / schema).write_bytes((project_root / "schemas" / schema).read_bytes())
    source = Source("orders", "education", "https://example.md/ordine", "path_prefix", True)
    processor = ResourceProcessor(tmp_path)
    for page in (1, 2):
        processor.process(Resource(
            source=source,
            url=f"{source.url}?page={page}",
            final_url=f"{source.url}?page={page}",
            status=200,
            headers={"Content-Type": "text/html"},
            body=(f'<html><head><link rel="canonical" href="{source.url}"></head>'
                  f'<body><main><h1>Ordine</h1><p>Order number {page}</p></main></body></html>').encode(),
            retrieved_at="2026-09-26T06:00:00+00:00",
        ))
    result = build_rag_export(tmp_path)
    manifest = json.loads((result.root / "manifest.json").read_text())
    files = [entry["file"] for entry in manifest["documents"]]
    assert result.documents == 2
    assert len(set(files)) == 2
    contents = [(result.root / name).read_text() for name in files]
    assert any("Order number 1" in content for content in contents)
    assert any("Order number 2" in content for content in contents)


def test_html_pipeline_exports_traceable_files(tmp_path: Path) -> None:
    (tmp_path / "schemas").mkdir()
    project_root = Path(__file__).resolve().parents[1]
    for schema in ("document.schema.json", "chunk.schema.json"):
        (tmp_path / "schemas" / schema).write_text(
            (project_root / "schemas" / schema).read_text(encoding="utf-8"),
            encoding="utf-8",
        )

    body = b"""<!doctype html><html lang="ro"><head><title>Serviciu municipal</title>
    <link rel="canonical" href="https://example.md/service/"></head>
    <body><nav>Meniu</nav><main><h1>Depunerea cererii</h1>
    <p>Pentru acest serviciu, depune cererea la Primaria Chisinau.</p>
    <h2>Acte necesare</h2><ul><li>Formular</li><li>Act de identitate</li></ul>
    </main><input type="hidden" value="volatile-token-1"><footer>Copyright</footer>
    </body></html>"""
    source = Source("fixture", "services", "https://example.md/service", "path_prefix", True)
    resource = Resource(
        source=source,
        url=source.url,
        final_url=source.url,
        status=200,
        headers={"Content-Type": "text/html; charset=utf-8"},
        body=body,
        retrieved_at="2026-09-25T10:00:00+00:00",
    )

    exported = ResourceProcessor(tmp_path).process(resource)
    record = json.loads(exported.json_path.read_text(encoding="utf-8"))

    assert record["source_url"] == source.url
    assert record["title"] == "Depunerea cererii"
    assert record["language"] == "ro"
    assert "Depunerea cererii" in record["content"]
    assert exported.raw_path.exists()
    assert exported.chunk_count >= 1
    assert (tmp_path / "data/processed/chunks/chunks.jsonl").exists()

    updated_resource = Resource(
        source=source,
        url=source.url,
        final_url=source.url,
        status=200,
        headers={"Content-Type": "text/html; charset=utf-8"},
        body=body.replace(b"volatile-token-1", b"volatile-token-2"),
        retrieved_at="2026-09-25T11:00:00+00:00",
    )
    repeated = ResourceProcessor(tmp_path).process(updated_resource)
    assert repeated.document_id == exported.document_id
    assert repeated.version_id == exported.version_id

    duplicate_source = Source(
        "fixture-alias",
        "services",
        "https://example.md/service-alias",
        "path_prefix",
        True,
    )
    ResourceProcessor(tmp_path).process(
        Resource(
            source=duplicate_source,
            url=duplicate_source.url,
            final_url=duplicate_source.url,
            status=200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            body=body.replace(
                b'https://example.md/service/', b'https://example.md/service-alias'
            ),
            retrieved_at="2026-09-25T12:00:00+00:00",
        )
    )
    reference_source = Source(
        "reference", "reference", "https://example.md/internal", "path_prefix", True
    )
    ResourceProcessor(tmp_path).process(
        Resource(
            source=reference_source,
            url=reference_source.url,
            final_url=reference_source.url,
            status=200,
            headers={"Content-Type": "text/html; charset=utf-8"},
            body=b"<html lang='en'><main><h1>Internal plan</h1><p>Not municipal evidence.</p></main></html>",
            retrieved_at="2026-09-25T12:00:00+00:00",
        )
    )

    rag_export = build_rag_export(tmp_path)
    manifest = json.loads((rag_export.root / "manifest.json").read_text(encoding="utf-8"))
    assert rag_export.documents == 1
    assert rag_export.excluded == 1
    assert rag_export.duplicates == 1
    assert manifest["summary"]["documents"] == 1
