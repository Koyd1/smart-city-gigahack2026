from civic_ai.crawler.policy import canonicalize_url, is_allowed
from civic_ai.models import Source


def test_canonicalize_removes_fragment_and_tracking() -> None:
    url = canonicalize_url(
        "https://example.md/start/",
        "../page?utm_source=test&id=4#section",
    )
    assert url == "https://example.md/page?id=4"


def test_canonicalize_normalizes_trailing_slash() -> None:
    assert canonicalize_url("https://example.md/", "/ro/") == "https://example.md/ro"


def test_path_scope_allows_documents_but_not_unrelated_pages() -> None:
    source = Source("source", "category", "https://example.md/public/", "path_prefix", True)

    assert is_allowed(source, "https://example.md/public/page")
    assert is_allowed(source, "https://example.md/files/rule.pdf")
    assert not is_allowed(source, "https://example.md/private/page")
    assert not is_allowed(source, "https://other.md/public/page")
