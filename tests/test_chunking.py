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

