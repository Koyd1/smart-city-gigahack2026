from __future__ import annotations

from lxml import html as lxml_html
from trafilatura import extract

from civic_ai.crawler.policy import canonicalize_url
from civic_ai.models import Extraction
from civic_ai.processing.language import detect_language
from civic_ai.processing.normalize import normalize_markdown


def extract_html(body: bytes, url: str) -> Extraction:
    markdown = extract(
        body,
        url=url,
        output_format="markdown",
        include_comments=False,
        include_formatting=True,
        include_links=True,
        include_tables=True,
        favor_precision=True,
    )
    if not markdown:
        raise ValueError("Trafilatura did not find main page content")

    tree = lxml_html.fromstring(body, base_url=url)
    heading_nodes = tree.xpath("(//main//h1 | //article//h1 | //h1)[1]")
    heading = (
        " ".join(" ".join(heading_nodes[0].itertext()).split()) if heading_nodes else ""
    )
    title = heading or tree.xpath("string(//title)").strip() or url
    declared_language = tree.get("lang")
    canonical_values = tree.xpath(
        "//link[contains(concat(' ', normalize-space(@rel), ' '), ' canonical ')]/@href"
    )
    canonical_url = (
        canonicalize_url(url, canonical_values[0]) if canonical_values else None
    )
    normalized = normalize_markdown(markdown)
    return Extraction(
        title=title,
        markdown=normalized,
        language=detect_language(normalized, declared_language),
        method="trafilatura",
        quality=1.0,
        canonical_url=canonical_url,
    )
