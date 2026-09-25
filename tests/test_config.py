from pathlib import Path

from civic_ai.crawler.config import load_source_ids, load_sources

ROOT = Path(__file__).resolve().parents[1]


def test_registry_and_pilot_are_valid() -> None:
    selected = load_source_ids(ROOT / "config/pilot_sources.txt")
    sources = load_sources(ROOT / "config/sources.csv", selected)

    assert len(sources) == 3
    assert {source.source_id for source in sources} == selected
    assert all(source.enabled for source in sources)

