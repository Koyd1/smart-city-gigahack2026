from __future__ import annotations

import csv
from pathlib import Path

from civic_ai.models import Source


def load_source_ids(path: Path) -> set[str]:
    return {
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }


def load_sources(registry: Path, selected_ids: set[str] | None = None) -> list[Source]:
    with registry.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    sources = [
        Source(
            source_id=row["source_id"],
            category=row["category"],
            url=row["url"],
            crawl_scope=row["crawl_scope"],
            enabled=row["enabled"].strip().lower() == "true",
        )
        for row in rows
    ]
    enabled = [source for source in sources if source.enabled]
    if selected_ids is None:
        return enabled

    known = {source.source_id for source in sources}
    missing = selected_ids - known
    if missing:
        raise ValueError(f"Unknown source_id values: {', '.join(sorted(missing))}")
    return [source for source in enabled if source.source_id in selected_ids]

