from pathlib import Path

from civic_ai.crawler.policy import DOCUMENT_SUFFIXES
from civic_ai.models import Resource, Source
from civic_ai.processing.processor import SUPPORTED_DOCUMENT_SUFFIXES, ResourceProcessor
from civic_ai.processing.storage import CONTENT_TYPE_SUFFIXES


def test_mime_extensions_and_processor_formats_are_consistent() -> None:
    mapped_documents = {
        suffix
        for mime, suffix in CONTENT_TYPE_SUFFIXES.items()
        if suffix not in {".html", ".htm"} and not mime.startswith("application/vnd.civic-ai.")
    }

    assert DOCUMENT_SUFFIXES == SUPPORTED_DOCUMENT_SUFFIXES
    assert mapped_documents <= SUPPORTED_DOCUMENT_SUFFIXES
    assert ".xls" in SUPPORTED_DOCUMENT_SUFFIXES
    assert ".odt" in SUPPORTED_DOCUMENT_SUFFIXES


def test_unsupported_resource_has_explicit_reason(tmp_path: Path) -> None:
    project_root = Path(__file__).resolve().parents[1]
    (tmp_path / "schemas").mkdir()
    for schema in ("document.schema.json", "chunk.schema.json"):
        (tmp_path / "schemas" / schema).write_text(
            (project_root / "schemas" / schema).read_text(encoding="utf-8"),
            encoding="utf-8",
        )
    source = Source("fixture", "test", "https://example.md/file.zip", "path_prefix", True)
    resource = Resource(
        source=source,
        url=source.url,
        final_url=source.url,
        status=200,
        headers={"Content-Type": "application/zip"},
        body=b"not a supported archive",
        retrieved_at="2026-09-26T00:00:00+00:00",
    )

    try:
        ResourceProcessor(tmp_path).process(resource)
    except ValueError as exc:
        assert str(exc) == "Unsupported content type application/zip (.zip)"
    else:
        raise AssertionError("unsupported resource was unexpectedly processed")
