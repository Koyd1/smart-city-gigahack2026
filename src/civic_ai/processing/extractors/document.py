from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from civic_ai.models import Extraction
from civic_ai.processing.language import detect_language
from civic_ai.processing.normalize import normalize_markdown


class DocumentExtractor:
    def __init__(self) -> None:
        self._converter: Any | None = None

    @property
    def converter(self) -> Any:
        if self._converter is None:
            from docling.document_converter import DocumentConverter

            self._converter = DocumentConverter()
        return self._converter

    def extract(self, path: Path, *, title_hint: str) -> Extraction:
        if path.suffix.lower() == ".pdf" and self._is_large_text_pdf(path):
            return self._extract_pdf_text_layer(path, title_hint=title_hint)
        try:
            result = self.converter.convert(path)
            document = result.document
            structured = document.export_to_dict()
            pages = getattr(document, "pages", None)
            if pages:
                markdown = normalize_markdown(
                    "\n\n".join(
                        f"<!-- page: {page_number} -->\n\n"
                        f"{document.export_to_markdown(page_no=page_number).strip()}"
                        for page_number in sorted(pages)
                    )
                )
            else:
                markdown = normalize_markdown(document.export_to_markdown())
            return Extraction(
                title=self._document_title(path, structured, title_hint),
                markdown=markdown,
                language=detect_language(markdown),
                method="docling",
                quality=1.0 if markdown.strip() else 0.0,
                structured=structured,
                page_count=len(pages) if pages is not None else None,
            )
        except Exception as exc:
            if path.suffix.lower() != ".pdf":
                raise RuntimeError(f"Docling extraction failed for {path.name}") from exc
            return self._extract_pdf_fallback(path, title_hint=title_hint, cause=exc)

    @staticmethod
    def _is_large_text_pdf(path: Path, *, page_threshold: int = 50) -> bool:
        """Avoid expensive OCR/layout analysis for long PDFs with a good text layer."""
        try:
            from pypdf import PdfReader

            reader = PdfReader(path)
            if len(reader.pages) <= page_threshold:
                return False
            sample_size = min(5, len(reader.pages))
            lengths = [
                len((reader.pages[index].extract_text() or "").strip())
                for index in range(sample_size)
            ]
            return bool(lengths) and sum(lengths) / len(lengths) >= 500
        except (OSError, ValueError):
            return False

    @staticmethod
    def _extract_pdf_text_layer(path: Path, *, title_hint: str) -> Extraction:
        from pypdf import PdfReader

        reader = PdfReader(path)
        pages = [
            f"<!-- page: {number} -->\n\n{(page.extract_text() or '').strip()}"
            for number, page in enumerate(reader.pages, start=1)
        ]
        markdown = normalize_markdown("\n\n".join(pages))
        if not markdown.strip():
            raise RuntimeError(f"PDF text-layer extraction failed for {path.name}")
        metadata_title = reader.metadata.title if reader.metadata else None
        return Extraction(
            title=metadata_title or title_hint,
            markdown=markdown,
            language=detect_language(markdown),
            method="pypdf-text-layer",
            quality=0.85,
            structured={
                "optimization": "large text-layer PDF; layout OCR skipped",
                "page_count": len(reader.pages),
            },
            page_count=len(reader.pages),
        )

    @staticmethod
    def _title_from_structure(structured: dict[str, Any]) -> str | None:
        for key in ("name", "title"):
            value = structured.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    @classmethod
    def _document_title(
        cls, path: Path, structured: dict[str, Any], title_hint: str
    ) -> str:
        if path.suffix.lower() == ".pdf":
            metadata_title = None
            try:
                from pypdf import PdfReader
                from pypdf.errors import PdfReadError

                metadata = PdfReader(path).metadata
                metadata_title = metadata.title if metadata else None
            except (OSError, PdfReadError, ValueError):
                metadata_title = None
            if metadata_title:
                return metadata_title.strip()
        structured_title = cls._title_from_structure(structured)
        if structured_title and not re.fullmatch(r"[a-f0-9]{32,64}", structured_title):
            return structured_title
        return title_hint

    @staticmethod
    def _extract_pdf_fallback(
        path: Path, *, title_hint: str, cause: Exception
    ) -> Extraction:
        from pypdf import PdfReader

        reader = PdfReader(path)
        pages: list[str] = []
        for number, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            pages.append(f"<!-- page: {number} -->\n\n{text.strip()}")
        markdown = normalize_markdown("\n\n".join(pages))
        if not markdown.strip():
            raise RuntimeError(f"PDF extraction failed for {path.name}") from cause
        metadata_title = reader.metadata.title if reader.metadata else None
        return Extraction(
            title=metadata_title or title_hint,
            markdown=markdown,
            language=detect_language(markdown),
            method="pypdf-fallback",
            quality=0.7,
            structured={"docling_error": str(cause)},
            page_count=len(reader.pages),
        )
