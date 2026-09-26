from civic_ai.processing.chunking import split_markdown


def test_chunking_retains_headings_and_pages() -> None:
    markdown = """# Titlu

<!-- page: 1 -->

Primul paragraf.

## Secțiune

<!-- page: 2 -->

Al doilea paragraf.
"""
    chunks = split_markdown(markdown, max_tokens=10)

    assert chunks
    assert chunks[0].heading_path == ["Titlu"]
    assert any(chunk.page_start == 2 for chunk in chunks)
    assert any("Secțiune" in chunk.heading_path for chunk in chunks)


def test_long_section_keeps_heading_path_after_splitting() -> None:
    markdown = "# Catalog\n\n## Secțiune lungă\n\n" + " ".join(
        f"cuvânt-{number}" for number in range(180)
    )

    section_chunks = [
        chunk for chunk in split_markdown(markdown, max_tokens=30) if "Secțiune lungă" in chunk.heading_path
    ]

    assert len(section_chunks) > 1
    assert all(chunk.heading_path == ["Catalog", "Secțiune lungă"] for chunk in section_chunks)
    assert all(chunk.token_count <= 30 for chunk in section_chunks)


def test_heading_path_handles_skipped_source_levels() -> None:
    markdown = """# Activitate

###### Subtitlu

Introducere.

##### Orar

Luni, 10:00.
"""

    chunks = split_markdown(markdown)
    schedule = next(chunk for chunk in chunks if "Luni" in chunk.text)

    assert schedule.heading_path == ["Activitate", "Orar"]
