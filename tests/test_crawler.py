from __future__ import annotations

from pathlib import Path

from scrapy.http import HtmlResponse

from civic_ai.cli import build_parser, source_from_site, validate_site
from civic_ai.crawler.spider import MunicipalSpider
from civic_ai.models import Source


def test_direct_site_argument_needs_no_registry_entry() -> None:
    args = build_parser().parse_args(
        [
            "crawl",
            "--site",
            "https://example.org/search?q=one&lang=ro",
            "7",
            "--site",
            "https://other.test",
            "12",
        ]
    )
    site_specs = [validate_site(url, limit) for url, limit in args.site]
    sources = [source_from_site(url) for url, _ in site_specs]

    assert [limit for _, limit in site_specs] == [7, 12]
    assert [source.url for source in sources] == [
        "https://example.org/search?q=one&lang=ro",
        "https://other.test",
    ]
    assert all(source.crawl_scope == "same_domain" for source in sources)


def test_failed_response_does_not_consume_successful_page_limit(tmp_path: Path) -> None:
    source = Source("fixture", "services", "https://example.md/", "same_domain", True)
    spider = MunicipalSpider(
        sources=[source],
        project_root=str(tmp_path),
        max_pages_per_source={source.source_id: 1},
    )

    first_request = spider._content_request(source, source.url, depth=0)
    next_url = "https://example.md/next"
    assert first_request is not None
    assert spider._content_request(source, next_url, depth=1) is None

    failed_response = HtmlResponse(first_request.url, status=503, request=first_request)
    retry_requests = list(spider.parse_resource(failed_response, source, depth=0))
    assert len(retry_requests) == 1
    retry_request = retry_requests[0]
    assert retry_request.url == next_url
    assert not spider.successful[source.source_id]

    success_response = HtmlResponse(
        retry_request.url,
        status=200,
        headers={b"Content-Type": b"text/html"},
        body=b"<html><body><main><h1>Page</h1></main></body></html>",
        request=retry_request,
    )
    list(spider.parse_resource(success_response, source, depth=1))

    assert spider.successful[source.source_id] == {next_url}
    assert spider._content_request(
        source, "https://example.md/extra", depth=1
    ) is None