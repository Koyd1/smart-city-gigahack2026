from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any, ClassVar
from urllib.parse import urljoin

import scrapy

from civic_ai.crawler.policy import canonicalize_url, is_allowed
from civic_ai.models import Source


class MunicipalSpider(scrapy.Spider):
    name = "municipal"
    custom_settings: ClassVar[dict[str, Any]] = {
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 1.0,
        "AUTOTHROTTLE_MAX_DELAY": 10.0,
        "AUTOTHROTTLE_TARGET_CONCURRENCY": 0.5,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "DOWNLOAD_DELAY": 1.0,
        "DOWNLOAD_TIMEOUT": 30,
        "ITEM_PIPELINES": {"civic_ai.processing.pipeline.CorpusPipeline": 300},
        "LOG_LEVEL": "INFO",
        "ROBOTSTXT_OBEY": True,
        "TELNETCONSOLE_ENABLED": False,
        "USER_AGENT": "ChisinauCivicParser/0.1 (+public-information research)",
    }

    def __init__(
        self,
        *,
        sources: Iterable[Source],
        project_root: str,
        max_pages_per_source: int = 20,
        depth_limit: int = 2,
        **kwargs: object,
    ) -> None:
        super().__init__(**kwargs)
        self.sources = list(sources)
        self.project_root = project_root
        self.max_pages_per_source = int(max_pages_per_source)
        self.depth_limit = int(depth_limit)
        self.scheduled: dict[str, int] = defaultdict(int)

    async def start(self):  # type: ignore[override]
        for source in self.sources:
            self.scheduled[source.source_id] += 1
            yield scrapy.Request(
                source.url,
                callback=self.parse_resource,
                cb_kwargs={"source": source, "depth": 0},
            )
            sitemap_url = urljoin(source.url, "/sitemap.xml")
            if is_allowed(source, sitemap_url):
                self.scheduled[source.source_id] += 1
                yield scrapy.Request(
                    sitemap_url,
                    callback=self.parse_sitemap,
                    cb_kwargs={"source": source},
                )

    def parse_sitemap(self, response: scrapy.http.Response, source: Source):
        for value in response.xpath("//*[local-name()='loc']/text()").getall():
            if self.scheduled[source.source_id] >= self.max_pages_per_source:
                break
            candidate = canonicalize_url(response.url, value.strip())
            if not candidate or not is_allowed(source, candidate):
                continue
            self.scheduled[source.source_id] += 1
            callback = self.parse_sitemap if candidate.lower().endswith((".xml", ".xml.gz")) else self.parse_resource
            cb_kwargs = {"source": source} if callback is self.parse_sitemap else {"source": source, "depth": 0}
            yield scrapy.Request(candidate, callback=callback, cb_kwargs=cb_kwargs)

    def parse_resource(self, response: scrapy.http.Response, source: Source, depth: int):
        yield {
            "source": source,
            "url": response.request.url,
            "final_url": response.url,
            "status": response.status,
            "headers": {
                key.decode("latin-1"): b", ".join(values).decode("latin-1")
                for key, values in response.headers.items()
            },
            "body": response.body,
            "retrieved_at": datetime.now(UTC).isoformat(),
        }

        content_type = response.headers.get(b"Content-Type", b"").decode("latin-1").lower()
        if "html" not in content_type or depth >= self.depth_limit:
            return

        for href in response.css("a::attr(href)").getall():
            if self.scheduled[source.source_id] >= self.max_pages_per_source:
                break
            candidate = canonicalize_url(response.url, href)
            if not candidate or not is_allowed(source, candidate):
                continue
            self.scheduled[source.source_id] += 1
            yield scrapy.Request(
                candidate,
                callback=self.parse_resource,
                cb_kwargs={"source": source, "depth": depth + 1},
            )
