from __future__ import annotations

from pathlib import PurePosixPath
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

from civic_ai.models import Source

DOCUMENT_SUFFIXES = {
    ".pdf",
    ".doc",
    ".docx",
    ".rtf",
    ".odt",
    ".xls",
    ".xlsx",
    ".csv",
    ".pptx",
    ".txt",
    ".md",
}
IGNORED_SUFFIXES = {
    ".7z",
    ".avi",
    ".css",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".mp3",
    ".mp4",
    ".png",
    ".rar",
    ".svg",
    ".webp",
    ".woff",
    ".woff2",
    ".zip",
}
TRACKING_PARAMETERS = {"fbclid", "gclid", "mc_cid", "mc_eid"}


def canonicalize_url(base_url: str, candidate: str) -> str | None:
    absolute = urljoin(base_url, candidate.strip())
    parts = urlsplit(absolute)
    if parts.scheme not in {"http", "https"} or not parts.hostname:
        return None
    query = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in TRACKING_PARAMETERS
    ]
    path = parts.path.rstrip("/") or "/"
    return urlunsplit(
        (parts.scheme.lower(), parts.netloc.lower(), path, urlencode(query, doseq=True), "")
    )


def suffix_for_url(url: str) -> str:
    return PurePosixPath(urlsplit(url).path).suffix.lower()


def is_allowed(source: Source, candidate_url: str) -> bool:
    root = urlsplit(source.url)
    candidate = urlsplit(candidate_url)
    if candidate.hostname != root.hostname:
        return False

    suffix = suffix_for_url(candidate_url)
    if suffix in IGNORED_SUFFIXES:
        return False
    if suffix in DOCUMENT_SUFFIXES:
        return True
    if source.crawl_scope == "same_domain":
        return True
    if source.crawl_scope == "path_prefix":
        prefix = root.path.rstrip("/") or "/"
        return candidate.path.rstrip("/").startswith(prefix)
    return False
