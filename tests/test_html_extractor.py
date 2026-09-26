from pathlib import Path

from civic_ai.processing.extractors.html import extract_html

FIXTURES = Path(__file__).parent / "fixtures/html"


def test_html_preserves_heading_levels_order_inline_text_links_lists_and_tables() -> None:
    extraction = extract_html(
        (FIXTURES / "structure_and_links.html").read_bytes(),
        "https://example.md/ro/activities/current",
    )
    markdown = extraction.markdown

    expected = [
        "# Program pentru comunitate",
        "## Înscriere",
        "### Pașii necesari",
        "#### Date",
    ]
    positions = [markdown.index(value) for value in expected]
    assert positions == sorted(positions)
    assert "Introducere cu **text important**." in markdown
    assert (
        "[regulamentul complet](https://example.md/ro/documente/regulament.pdf)"
        in markdown
    )
    assert "[Vezi actul permisiv](https://example.md/ro/activities/current#/ep/permit/17)" in markdown
    assert "1. Completați formularul." in markdown
    assert "2. Trimiteți documentele." in markdown
    assert "| Zi | Ora |" in markdown
    assert "| Luni | 10:00 |" in markdown


def test_heading_without_h1_is_kept_once_in_body() -> None:
    extraction = extract_html(
        (FIXTURES / "heading_without_h1.html").read_bytes(),
        "https://example.md/activity/1",
    )

    assert extraction.title == "Activitate pentru tineri"
    assert extraction.markdown.count("Activitate pentru tineri") == 1
    assert "### Activitate pentru tineri" in extraction.markdown


def test_navigation_and_footer_do_not_pollute_main_content() -> None:
    extraction = extract_html(
        (FIXTURES / "structure_and_links.html").read_bytes(),
        "https://example.md/ro/activities/current",
    )

    assert "Toate activitățile" not in extraction.markdown
    assert "Contacte" not in extraction.markdown
    assert "Copyright" not in extraction.markdown
    assert "regulamentul complet" in extraction.markdown
