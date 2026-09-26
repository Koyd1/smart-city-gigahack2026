from __future__ import annotations

from difflib import SequenceMatcher
import re
import unicodedata


def _normalize_source_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = re.sub(r"^\s*\d+[\s._()-]*", "", normalized)
    return " ".join(re.sub(r"[^a-z0-9]+", " ", normalized).split())


def resolve_source_name(value: str, candidates: list[str]) -> str | None:
    if value in candidates:
        return value

    normalized_value = _normalize_source_name(value)
    if not normalized_value:
        return None

    normalized_candidates = {
        candidate: _normalize_source_name(candidate) for candidate in candidates
    }
    for candidate, normalized_candidate in normalized_candidates.items():
        if normalized_value in normalized_candidate or normalized_candidate in normalized_value:
            return candidate

    best_candidate = max(
        candidates,
        key=lambda candidate: SequenceMatcher(
            None,
            normalized_value,
            normalized_candidates[candidate],
        ).ratio(),
        default=None,
    )
    if best_candidate is None:
        return None
    similarity = SequenceMatcher(
        None,
        normalized_value,
        normalized_candidates[best_candidate],
    ).ratio()
    return best_candidate if similarity >= 0.78 else None


def parse_model_sources(answer: str) -> tuple[str, dict[str, str]]:
    """
    Parses model answer and extracts sources.

    Expected format:

    [[SOURCES]]

    Document: X | Citations: A; B; C
    """

    if "[[SOURCES]]" not in answer:
        return answer, {}

    answer_part, sources_part = answer.split("[[SOURCES]]", 1)

    sources: dict[str, str] = {}

    pattern = r"Document:\s*(.*?)\s*\|\s*Citations:\s*(.*)"

    for line in sources_part.splitlines():
        line = line.strip()

        match = re.search(pattern, line)

        if not match:
            continue

        document = match.group(1).strip()
        citations = match.group(2).strip()

        if document in sources:
            sources[document] += "; " + citations
        else:
            sources[document] = citations

    return answer_part.strip(), sources
