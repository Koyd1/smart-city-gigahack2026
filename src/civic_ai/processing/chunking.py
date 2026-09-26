from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
PAGE_MARKER = re.compile(r"^<!--\s*page:\s*(\d+)\s*-->$")


@dataclass(slots=True)
class TextChunk:
    ordinal: int
    text: str
    heading_path: list[str]
    page_start: int | None
    page_end: int | None
    token_count: int


def approximate_tokens(text: str) -> int:
    return max(1, round(len(re.findall(r"\S+", text)) * 1.35))


def split_markdown(markdown: str, max_tokens: int = 700) -> list[TextChunk]:
    chunks: list[TextChunk] = []
    heading_stack: list[tuple[int, str]] = []
    current_parts: list[str] = []
    current_pages: list[int] = []

    def flush() -> None:
        nonlocal current_parts, current_pages
        text = "\n\n".join(part for part in current_parts if part.strip()).strip()
        if text:
            chunks.append(
                TextChunk(
                    ordinal=len(chunks),
                    text=text,
                    heading_path=[title for _, title in heading_stack],
                    page_start=min(current_pages) if current_pages else None,
                    page_end=max(current_pages) if current_pages else None,
                    token_count=approximate_tokens(text),
                )
            )
        current_parts = []
        current_pages = []

    for block in re.split(r"\n\s*\n", markdown):
        block = block.strip()
        if not block:
            continue
        page_match = PAGE_MARKER.match(block)
        if page_match:
            current_pages.append(int(page_match.group(1)))
            continue
        heading_match = HEADING.match(block)
        if heading_match:
            if current_parts:
                flush()
            level = len(heading_match.group(1))
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, heading_match.group(2)))
            current_parts.append(block)
            continue
        candidate = "\n\n".join([*current_parts, block])
        if current_parts and approximate_tokens(candidate) > max_tokens:
            flush()
        if approximate_tokens(block) <= max_tokens:
            current_parts.append(block)
            continue
        words = block.split()
        window: list[str] = []
        for word in words:
            candidate_window = " ".join([*window, word])
            if window and approximate_tokens(candidate_window) > max_tokens:
                current_parts.append(" ".join(window))
                flush()
                window = []
            window.append(word)
        if window:
            current_parts.append(" ".join(window))
    flush()
    return chunks


def chunk_id(version_id: str, chunk: TextChunk) -> str:
    payload = f"{version_id}\0{chunk.ordinal}\0{chunk.text}".encode()
    return f"chunk_{hashlib.sha256(payload).hexdigest()[:20]}"
