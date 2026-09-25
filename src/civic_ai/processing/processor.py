from __future__ import annotations

from pathlib import Path

from civic_ai.models import ExportedDocument, Resource
from civic_ai.processing.extractors import DocumentExtractor, extract_html
from civic_ai.processing.storage import CorpusStore, normalized_content_type, resource_suffix


class ResourceProcessor:
    def __init__(self, project_root: Path) -> None:
        self.store = CorpusStore(project_root)
        self.documents = DocumentExtractor()

    def process(self, resource: Resource) -> ExportedDocument:
        raw_path, raw_digest = self.store.save_raw(resource)
        suffix = resource_suffix(resource)
        content_type = normalized_content_type(resource.headers)
        if suffix in {".html", ".htm"} or "html" in content_type:
            extraction = extract_html(resource.body, resource.final_url)
        elif suffix in {
            ".pdf",
            ".doc",
            ".docx",
            ".rtf",
            ".odt",
            ".xlsx",
            ".csv",
            ".pptx",
            ".txt",
            ".md",
        }:
            extraction = self.documents.extract(raw_path, title_hint=Path(resource.final_url).name)
        else:
            raise ValueError(f"Unsupported content type {content_type or suffix}")
        return self.store.export(
            resource,
            extraction,
            raw_path,
            raw_digest,
        )
