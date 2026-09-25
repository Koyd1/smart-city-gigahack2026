from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from civic_ai.models import Resource
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
        seen_sources = {str(row["source_id"]) for row in self.report}
        for source in spider.sources:
            if source.source_id not in seen_sources:
                self.report.append(
                    {
                        "status": "not_processed",
                        "source_id": source.source_id,
                        "url": source.url,
                        "reason": "No response reached the parser; check robots.txt and crawl logs",
                    }
                )
        report_dir = self.root / "data/processed/reports"
        stamp = self.started_at.strftime("%Y%m%dT%H%M%SZ")
        payload = {
            "started_at": self.started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "sources": [source.source_id for source in spider.sources],
            "summary": {
                status: sum(row["status"] == status for row in self.report)
                for status in ("processed", "skipped", "failed", "not_processed")
            },
            "items": self.report,
        }
        atomic_write(
            report_dir / f"crawl-{stamp}.json",
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        )
