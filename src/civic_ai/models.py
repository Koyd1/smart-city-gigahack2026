from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True, slots=True)
class Source:
    source_id: str
    category: str
    url: str
    crawl_scope: str
    enabled: bool


@dataclass(frozen=True, slots=True)
class Resource:
    source: Source
    url: str
    final_url: str
    status: int
    headers: dict[str, str]
    body: bytes
    retrieved_at: str


@dataclass(slots=True)
class Extraction:
    title: str
    markdown: str
    language: str
    method: str
    quality: float | None = None
    structured: dict[str, Any] | None = None
    page_count: int | None = None
    canonical_url: str | None = None


@dataclass(frozen=True, slots=True)
class ExportedDocument:
    document_id: str
    version_id: str
    raw_path: Path
    markdown_path: Path
    json_path: Path
    chunk_count: int
