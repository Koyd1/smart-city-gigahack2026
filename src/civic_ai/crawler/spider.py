from __future__ import annotations

import json
from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any, ClassVar
from urllib.parse import urlencode, urljoin, urlsplit

import scrapy

from civic_ai.crawler.policy import canonicalize_url, is_allowed
from civic_ai.models import Source


class MunicipalSpider(scrapy.Spider):
    name = "municipal"
    custom_settings: ClassVar[dict[str, Any]] = {
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 0.5,
        "AUTOTHROTTLE_MAX_DELAY": 10.0,
        "AUTOTHROTTLE_TARGET_CONCURRENCY": 1.0,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "DOWNLOAD_DELAY": 0.5,
        "DOWNLOAD_TIMEOUT": 30,
        "HTTPERROR_ALLOW_ALL": True,
        "ITEM_PIPELINES": {"civic_ai.processing.pipeline.CorpusPipeline": 300},
        "LOG_LEVEL": "INFO",
        "ROBOTSTXT_OBEY": True,
        "TELNETCONSOLE_ENABLED": False,
        "USER_AGENT": "ChisinauCivicParser/0.2 (+public-information research)",
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
        self.sources_by_id = {source.source_id: source for source in self.sources}
        self.project_root = project_root
        self.max_pages_per_source = min(500, int(max_pages_per_source))
        self.depth_limit = int(depth_limit)
        self.discovered: dict[str, set[str]] = defaultdict(set)
        self.scheduled: dict[str, set[str]] = defaultdict(set)
        self.responded: dict[str, set[str]] = defaultdict(set)
        self.crawl_issues: list[dict[str, object]] = []
        self.technical_events: dict[str, list[dict[str, object]]] = defaultdict(list)
        self._sitemaps_seen: dict[str, set[str]] = defaultdict(set)

    async def start(self):  # type: ignore[override]
        for source in self.sources:
            self.technical_events[source.source_id].append(
                {
                    "kind": "robots.txt",
                    "url": urljoin(source.url, "/robots.txt"),
                    "status": "delegated_to_scrapy_robotstxt_middleware",
                }
            )
            sitemap_url = urljoin(source.url, "/sitemap.xml")
            self._record_technical(source, "sitemap", sitemap_url)
            yield scrapy.Request(
                sitemap_url,
                callback=self.parse_sitemap,
                errback=self.request_error,
                cb_kwargs={"source": source},
                meta=self._technical_meta(source, "sitemap"),
                dont_filter=True,
            )

            if source.source_id == "actpermisiv":
                self._record_technical(source, "spa_shell", source.url)
                yield scrapy.Request(
                    source.url,
                    callback=self.parse_act_shell,
                    errback=self.request_error,
                    cb_kwargs={"source": source},
                    meta=self._technical_meta(source, "spa_shell"),
                    dont_filter=True,
                )
                continue

            request = self._content_request(source, source.url, depth=0)
            if request is not None:
                yield request

    def _technical_meta(self, source: Source, kind: str) -> dict[str, object]:
        return {"source_id": source.source_id, "technical_kind": kind}

    def _record_technical(self, source: Source, kind: str, url: str) -> None:
        self.technical_events[source.source_id].append(
            {"kind": kind, "url": url, "status": "scheduled"}
        )

    def _complete_technical(self, source: Source, kind: str, url: str, status: int) -> None:
        for event in reversed(self.technical_events[source.source_id]):
            if event["kind"] == kind and event["url"] == url and event["status"] == "scheduled":
                event["status"] = status
                return

    def _relevant_candidate(self, source: Source, url: str) -> bool:
        path = urlsplit(url).path.rstrip("/") or "/"
        if source.source_id == "actpermisiv":
            # Content for this SPA is reserved from the public catalog API below;
            # the sitemap root is only an empty Angular shell.
            return False
        if source.source_id == "chisinau-projects-new":
            return url == canonicalize_url(source.url, source.url) or path.startswith("/ro/pv-")
        if source.source_id == "extrascolar-activities":
            return url == canonicalize_url(source.url, source.url) or path.startswith("/activity/")
        return is_allowed(source, url)

    @staticmethod
    def should_discover_links(source: Source, depth: int, depth_limit: int) -> bool:
        if source.source_id in {"chisinau-projects-new", "extrascolar-activities"}:
            return depth == 0
        return depth < depth_limit

    def _content_request(
        self, source: Source, url: str, *, depth: int
    ) -> scrapy.Request | None:
        normalized = canonicalize_url(source.url, url)
        if not normalized or not self._relevant_candidate(source, normalized):
            return None
        self.discovered[source.source_id].add(normalized)
        if normalized in self.scheduled[source.source_id]:
            return None
        if len(self.scheduled[source.source_id]) >= self.max_pages_per_source:
            return None
        self.scheduled[source.source_id].add(normalized)
        return scrapy.Request(
            normalized,
            callback=self.parse_resource,
            errback=self.request_error,
            cb_kwargs={"source": source, "depth": depth},
            meta={"source_id": source.source_id, "content_url": normalized},
        )

    def _reserve_synthetic_content(self, source: Source, url: str) -> bool:
        normalized = canonicalize_url(source.url, url)
        if not normalized:
            return False
        self.discovered[source.source_id].add(normalized)
        if normalized in self.scheduled[source.source_id]:
            return False
        if len(self.scheduled[source.source_id]) >= self.max_pages_per_source:
            return False
        self.scheduled[source.source_id].add(normalized)
        return True

    def _resource_item(
        self,
        source: Source,
        *,
        requested_url: str,
        final_url: str,
        status: int,
        headers: dict[str, str],
        body: bytes,
    ) -> dict[str, object]:
        return {
            "source": source,
            "url": requested_url,
            "final_url": final_url,
            "status": status,
            "headers": headers,
            "body": body,
            "retrieved_at": datetime.now(UTC).isoformat(),
        }

    def _response_headers(self, response: scrapy.http.Response) -> dict[str, str]:
        return {
            key.decode("latin-1"): b", ".join(values).decode("latin-1")
            for key, values in response.headers.items()
        }

    def parse_sitemap(self, response: scrapy.http.Response, source: Source):
        kind = str(response.meta.get("technical_kind", "sitemap"))
        self._complete_technical(source, kind, response.request.url, response.status)
        if response.status != 200:
            return
        for value in response.xpath("//*[local-name()='loc']/text()").getall():
            candidate = canonicalize_url(response.url, value.strip())
            if not candidate:
                continue
            if candidate.lower().endswith((".xml", ".xml.gz")):
                seen = self._sitemaps_seen[source.source_id]
                if candidate in seen or len(seen) >= 20:
                    continue
                seen.add(candidate)
                self._record_technical(source, "sitemap", candidate)
                yield scrapy.Request(
                    candidate,
                    callback=self.parse_sitemap,
                    errback=self.request_error,
                    cb_kwargs={"source": source},
                    meta=self._technical_meta(source, "sitemap"),
                    dont_filter=True,
                )
                continue
            request = self._content_request(source, candidate, depth=0)
            if request is not None:
                yield request

    def parse_resource(self, response: scrapy.http.Response, source: Source, depth: int):
        content_url = str(response.meta.get("content_url", response.request.url))
        self.responded[source.source_id].add(content_url)
        if response.status < 200 or response.status >= 300:
            self.crawl_issues.append(
                {
                    "status": "failed",
                    "source_id": source.source_id,
                    "url": content_url,
                    "reason": f"HTTP {response.status}",
                }
            )
            return

        yield self._resource_item(
            source,
            requested_url=response.request.url,
            final_url=response.url,
            status=response.status,
            headers=self._response_headers(response),
            body=response.body,
        )

        content_type = response.headers.get(b"Content-Type", b"").decode("latin-1").lower()
        if "html" not in content_type or not self.should_discover_links(
            source, depth, self.depth_limit
        ):
            return
        for href in response.css("a::attr(href)").getall():
            candidate = canonicalize_url(response.url, href)
            if not candidate:
                continue
            request = self._content_request(source, candidate, depth=depth + 1)
            if request is not None:
                yield request

    def parse_act_shell(self, response: scrapy.http.Response, source: Source):
        self._complete_technical(source, "spa_shell", response.request.url, response.status)
        if response.status != 200:
            self.crawl_issues.append(
                {
                    "status": "failed",
                    "source_id": source.source_id,
                    "url": source.url,
                    "reason": f"SPA shell returned HTTP {response.status}",
                }
            )
            return
        catalog_url = (
            "https://actpermisiv.gov.md/api/public/data/AvailablePermits?"
            "page=0&limit=0&start=0&language=ro"
        )
        self._record_technical(source, "api_catalog", catalog_url)
        yield scrapy.Request(
            catalog_url,
            callback=self.parse_act_catalog,
            errback=self.request_error,
            cb_kwargs={"source": source},
            meta=self._technical_meta(source, "api_catalog"),
            dont_filter=True,
        )

    def parse_act_catalog(self, response: scrapy.http.Response, source: Source):
        self._complete_technical(source, "api_catalog", response.request.url, response.status)
        if response.status != 200:
            self.crawl_issues.append(
                {
                    "status": "failed",
                    "source_id": source.source_id,
                    "url": source.url,
                    "reason": f"Catalog API returned HTTP {response.status}",
                }
            )
            return
        try:
            payload = json.loads(response.text)
            entries = payload["data"]
            if not isinstance(entries, list):
                raise TypeError("data is not a list")
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            self.crawl_issues.append(
                {
                    "status": "failed",
                    "source_id": source.source_id,
                    "url": source.url,
                    "reason": f"Invalid catalog API response: {exc}",
                }
            )
            return

        if self._reserve_synthetic_content(source, source.url):
            self.responded[source.source_id].add(canonicalize_url(source.url, source.url) or source.url)
            body = json.dumps(
                {"kind": "catalog", "entries": entries}, ensure_ascii=False
            ).encode()
            yield self._resource_item(
                source,
                requested_url=response.request.url,
                final_url=source.url,
                status=200,
                headers={"Content-Type": "application/vnd.civic-ai.actpermisiv+json"},
                body=body,
            )

        for entry in entries:
            if not isinstance(entry, dict) or "ID" not in entry:
                continue
            route_url = f"https://actpermisiv.gov.md/#/ep/permit/{entry['ID']}"
            if not self._reserve_synthetic_content(source, route_url):
                continue
            info_url = f"https://actpermisiv.gov.md/api/public/data/PermitInfo/{entry['ID']}"
            self._record_technical(source, "api_permit_info", info_url)
            yield scrapy.Request(
                info_url,
                callback=self.parse_act_info,
                errback=self.request_error,
                cb_kwargs={"source": source, "entry": entry, "route_url": route_url},
                meta=self._technical_meta(source, "api_permit_info"),
                dont_filter=True,
            )

    def _act_filter_url(self, endpoint: str, permit_id: object, *, language: bool) -> str:
        params: dict[str, object] = {
            "page": 0,
            "start": 0,
            "limit": 0,
            "filter": json.dumps(
                [{"value": permit_id, "property": "PermitTypeId"}], separators=(",", ":")
            ),
        }
        if language:
            params["language"] = "ro"
        return f"https://actpermisiv.gov.md/api/public/data/{endpoint}?{urlencode(params)}"

    def parse_act_info(
        self,
        response: scrapy.http.Response,
        source: Source,
        entry: dict[str, object],
        route_url: str,
    ):
        self._complete_technical(source, "api_permit_info", response.request.url, response.status)
        info: dict[str, object] = {}
        if response.status == 200:
            try:
                parsed = json.loads(response.text)
                if isinstance(parsed, dict):
                    info = parsed
            except json.JSONDecodeError:
                pass
        else:
            self._record_api_issue(source, route_url, "PermitInfo", response.status)
        supporting_url = self._act_filter_url("PermitSupportingDocuments", entry["ID"], language=True)
        self._record_technical(source, "api_supporting_documents", supporting_url)
        yield scrapy.Request(
            supporting_url,
            callback=self.parse_act_supporting,
            errback=self.request_error,
            cb_kwargs={
                "source": source,
                "entry": entry,
                "route_url": route_url,
                "info": info,
            },
            meta=self._technical_meta(source, "api_supporting_documents"),
            dont_filter=True,
        )

    def parse_act_supporting(
        self,
        response: scrapy.http.Response,
        source: Source,
        entry: dict[str, object],
        route_url: str,
        info: dict[str, object],
    ):
        self._complete_technical(
            source, "api_supporting_documents", response.request.url, response.status
        )
        supporting = self._api_data(response)
        if response.status != 200:
            self._record_api_issue(source, route_url, "PermitSupportingDocuments", response.status)
        legal_url = self._act_filter_url("PermitLex", entry["ID"], language=False)
        self._record_technical(source, "api_legal", legal_url)
        yield scrapy.Request(
            legal_url,
            callback=self.parse_act_legal,
            errback=self.request_error,
            cb_kwargs={
                "source": source,
                "entry": entry,
                "route_url": route_url,
                "info": info,
                "supporting": supporting,
            },
            meta=self._technical_meta(source, "api_legal"),
            dont_filter=True,
        )

    def parse_act_legal(
        self,
        response: scrapy.http.Response,
        source: Source,
        entry: dict[str, object],
        route_url: str,
        info: dict[str, object],
        supporting: list[object],
    ):
        self._complete_technical(source, "api_legal", response.request.url, response.status)
        legal = self._api_data(response)
        if response.status != 200:
            self._record_api_issue(source, route_url, "PermitLex", response.status)
        normalized_route = canonicalize_url(source.url, route_url) or route_url
        self.responded[source.source_id].add(normalized_route)
        body = json.dumps(
            {
                "kind": "permit",
                "catalog_title": entry.get("Title_ro") or entry.get("Title"),
                "info": info,
                "supporting": supporting,
                "legal": legal,
            },
            ensure_ascii=False,
        ).encode()
        yield self._resource_item(
            source,
            requested_url=response.request.url,
            final_url=route_url,
            status=200,
            headers={"Content-Type": "application/vnd.civic-ai.actpermisiv+json"},
            body=body,
        )

    @staticmethod
    def _api_data(response: scrapy.http.Response) -> list[object]:
        if response.status != 200:
            return []
        try:
            payload = json.loads(response.text)
        except json.JSONDecodeError:
            return []
        data = payload.get("data", []) if isinstance(payload, dict) else []
        return data if isinstance(data, list) else []

    def _record_api_issue(self, source: Source, route_url: str, endpoint: str, status: int) -> None:
        self.crawl_issues.append(
            {
                "status": "partial",
                "source_id": source.source_id,
                "url": route_url,
                "reason": f"Optional {endpoint} API returned HTTP {status}",
            }
        )

    def request_error(self, failure):
        request = failure.request
        source_id = str(request.meta.get("source_id", "unknown"))
        url = str(request.meta.get("content_url", request.url))
        technical_kind = request.meta.get("technical_kind")
        if technical_kind:
            source = self.sources_by_id.get(source_id)
            if source is not None:
                for event in reversed(self.technical_events[source_id]):
                    if event["kind"] == technical_kind and event["url"] == request.url:
                        event["status"] = "failed"
                        event["reason"] = failure.getErrorMessage()
                        break
            return
        self.crawl_issues.append(
            {
                "status": "failed",
                "source_id": source_id,
                "url": url,
                "reason": failure.getErrorMessage(),
            }
        )
