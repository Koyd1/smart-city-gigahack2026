from civic_ai.crawler.policy import canonicalize_url, is_allowed
from civic_ai.crawler.spider import MunicipalSpider
from civic_ai.models import Source


def test_canonicalize_removes_fragment_and_tracking() -> None:
    url = canonicalize_url(
        "https://example.md/start/",
        "../page?utm_source=test&id=4#section",
    )
    assert url == "https://example.md/page?id=4"


def test_canonicalize_normalizes_trailing_slash() -> None:
    assert canonicalize_url("https://example.md/", "/ro/") == "https://example.md/ro"


def test_canonicalize_preserves_spa_route_but_drops_document_anchor() -> None:
    assert (
        canonicalize_url("https://example.md/start", "#/ep/permit/17")
        == "https://example.md/start#/ep/permit/17"
    )
    assert canonicalize_url("https://example.md/start", "#section") == "https://example.md/start"


def test_path_scope_allows_documents_but_not_unrelated_pages() -> None:
    source = Source("source", "category", "https://example.md/public/", "path_prefix", True)

    assert is_allowed(source, "https://example.md/public/page")
    assert is_allowed(source, "https://example.md/files/rule.pdf")
    assert not is_allowed(source, "https://example.md/private/page")
    assert not is_allowed(source, "https://other.md/public/page")


def test_catalog_sources_only_discover_links_from_catalog_page() -> None:
    source = Source(
        "extrascolar-activities",
        "education",
        "https://extrascolar.md/activities",
        "same_domain",
        True,
    )

    assert MunicipalSpider.should_discover_links(source, depth=0, depth_limit=2)
    assert not MunicipalSpider.should_discover_links(source, depth=1, depth_limit=2)
