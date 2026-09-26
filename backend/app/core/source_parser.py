from __future__ import annotations

import re


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