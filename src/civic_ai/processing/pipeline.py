from __future__ import annotations

import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from civic_ai.models import Resource
from civic_ai.processing.export import build_crawl_zip
from civic_ai.processing.processor import ResourceProcessor
from civic_ai.processing.storage import atomic_write


class CorpusPipeline:
    @classmethod
    def from_crawler(cls, crawler):
        instance = cls()
        instance.crawler = crawler
        return instance

    def open_spider(self) -> None:
        spider = self.crawler.spider
        self.root = Path(spider.project_root).resolve()
        self.processor = ResourceProcessor(self.root)
        self.report: list[dict[str, object]] = []
        self.started_at = datetime.now(UTC)

    def process_item(self, item):
        spider = self.crawler.spider
        resource = Resource(**item)
        try:
            exported = self.processor.process(resource)
            self.report.append(
                {
                    "status": "processed",
                    "source_id": resource.source.source_id,
                    "url": resource.final_url,
                    "document_id": exported.document_id,
                    "version_id": exported.version_id,
                    "chunks": exported.chunk_count,
                }
            )
        except ValueError as exc:
            self.report.append(
                {
                    "status": "skipped",
                    "source_id": resource.source.source_id,
                    "url": resource.final_url,
                    "reason": str(exc),
                }
            )
            spider.logger.info("Skipped %s: %s", resource.final_url, exc)
        except Exception as exc:
            self.report.append(
                {
                    "status": "failed",
                    "source_id": resource.source.source_id,
                    "url": resource.final_url,
                    "reason": f"{type(exc).__name__}: {exc}",
                }
            )
            spider.logger.exception("Failed to process %s", resource.final_url)
        return item

    def close_spider(self) -> None:
        spider = self.crawler.spider
        finished_at = datetime.now(UTC)
        self.report.extend(spider.crawl_issues)
        for source in spider.sources:
            missing = spider.scheduled[source.source_id] - spider.responded[source.source_id]
            reported_urls = {
                str(row["url"])
                for row in self.report
                if row["source_id"] == source.source_id
                and row["status"] in {"failed", "not_processed"}
            }
            for url in sorted(missing - reported_urls):
                self.report.append(
                    {
                        "status": "not_processed",
                        "source_id": source.source_id,
                        "url": url,
                        "reason": "No response reached the parser; check robots.txt and crawl logs",
                    }
                )
        report_dir = self.root / "data/processed/reports"
        stamp = self.started_at.strftime("%Y%m%dT%H%M%SZ")
        per_source: dict[str, object] = {}
        for source in spider.sources:
            source_rows = [row for row in self.report if row["source_id"] == source.source_id]
            statuses = Counter(str(row["status"]) for row in source_rows)
            technical = spider.technical_events[source.source_id]
            per_source[source.source_id] = {
                "limit": spider.page_limits[source.source_id],
                "discovered": len(spider.discovered[source.source_id]),
                "scheduled": len(spider.scheduled[source.source_id]),
                "responded": len(spider.responded[source.source_id]),
                "successful": len(spider.successful[source.source_id]),
                "processed": statuses["processed"],
                "skipped": statuses["skipped"],
                "failed": statuses["failed"],
                "partial": statuses["partial"],
                "not_processed": statuses["not_processed"],
                "technical_requests": {
                    "count": len(technical),
                    "by_kind": dict(Counter(str(item["kind"]) for item in technical)),
                    "items": technical,
                    "note": "Technical requests do not consume the per-source content limit.",
                },
            }
            spider.logger.info(
                "Finished %s: %s successful pages, %s processed, %s failed (limit %s)",
                source.source_id,
                len(spider.successful[source.source_id]),
                statuses["processed"],
                statuses["failed"],
                spider.page_limits[source.source_id],
            )
        payload = {
            "started_at": self.started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "sources": [source.source_id for source in spider.sources],
            "summary": {
                status: sum(row["status"] == status for row in self.report)
                for status in ("processed", "skipped", "failed", "partial", "not_processed")
            },
            "per_source": per_source,
            "crawler_stats": {
                key: value
                for key, value in self.crawler.stats.get_stats().items()
                if isinstance(value, (str, int, float, bool)) or value is None
            },
            "items": self.report,
        }
        report_path = report_dir / f"crawl-{stamp}.json"
        atomic_write(
            report_path,
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        )
        archive_path = build_crawl_zip(self.root, payload, stamp)
        spider.logger.info("Crawl report written to %s", report_path)
        spider.logger.info("Crawl ZIP written to %s", archive_path)
