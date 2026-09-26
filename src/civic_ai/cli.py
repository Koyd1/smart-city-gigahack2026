from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote, urlsplit

from jsonschema.exceptions import ValidationError

from civic_ai.crawler.config import load_source_ids, load_sources
from civic_ai.integrations.peona import upload_to_peona
from civic_ai.models import Resource, Source
from civic_ai.processing.export import build_rag_export
from civic_ai.processing.processor import ResourceProcessor
from civic_ai.processing.storage import CorpusStore, utc_now


def project_root(value: str) -> Path:
    root = Path(value).resolve()
    required = (root / "config/sources.csv", root / "schemas/document.schema.json")
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise argparse.ArgumentTypeError(f"Not a parser project root; missing: {missing}")
    return root


def page_limit(value: str) -> int:
    parsed = int(value)
    if not 1 <= parsed <= 500:
        raise argparse.ArgumentTypeError("page limit must be between 1 and 500")
    return parsed


def source_limit(value: str) -> tuple[str, int]:
    source_id, separator, limit = value.partition(":")
    if not separator or not source_id:
        raise argparse.ArgumentTypeError("source must use the format SOURCE_ID:LIMIT")
    try:
        return source_id, page_limit(limit)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def validate_site(url: str, limit: str) -> tuple[str, int]:
    try:
        parsed = urlsplit(url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
        ):
            raise ValueError("site URL must be an http(s) URL without credentials")
        port = parsed.port
        if port is not None and not 1 <= port <= 65535:
            raise ValueError("site URL port must be between 1 and 65535")
        return url, page_limit(limit)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def source_from_site(url: str) -> Source:
    normalized_url = url.rstrip("/") or url
    source_id = f"site-{hashlib.sha256(normalized_url.encode()).hexdigest()[:12]}"
    return Source(
        source_id=source_id,
        category="website",
        url=normalized_url,
        crawl_scope="same_domain",
        enabled=True,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="civic-parser")
    parser.add_argument("--project-root", default=".", type=project_root)
    subparsers = parser.add_subparsers(dest="command", required=True)

    crawl = subparsers.add_parser("crawl", help="Crawl configured municipal sources")
    crawl.add_argument("--profile", choices=("pilot", "all"), default="pilot")
    crawl.add_argument(
        "--source",
        action="append",
        type=source_limit,
        default=[],
        metavar="SOURCE_ID:LIMIT",
        help="crawl a configured source with its own successful-page limit; repeat as needed",
    )
    crawl.add_argument(
        "--site",
        action="append",
        nargs=2,
        default=[],
        metavar=("URL", "LIMIT"),
        help="crawl a URL directly with its own successful-page limit; repeat as needed",
    )
    crawl.add_argument("--source-id", action="append", default=[])
    crawl.add_argument("--max-pages-per-source", type=page_limit, default=20)
    crawl.add_argument("--depth", type=int, default=2)

    local = subparsers.add_parser("parse-file", help="Parse one local document")
    local.add_argument("path", type=Path)
    local.add_argument("--source-url")
    local.add_argument("--source-id", default="local-file")
    local.add_argument("--category", default="local_reference")

    subparsers.add_parser("validate-config", help="Validate source profiles")
    subparsers.add_parser("validate-corpus", help="Validate all processed exports")
    export = subparsers.add_parser("export-rag", help="Build a clean upload package")
    export.add_argument("--include-reference", action="store_true")
    export.add_argument("--keep-duplicates", action="store_true")
    peona = subparsers.add_parser("upload-peona", help="Upload the latest export to Peona")
    peona.add_argument("--api-url", default=os.getenv("PEONA_API_URL", ""))
    peona.add_argument("--token", default=os.getenv("PEONA_API_TOKEN"))
    peona.add_argument("--no-wait", action="store_true")
    peona.add_argument("--poll-interval", type=float, default=2.0)
    peona.add_argument("--max-wait-seconds", type=float, default=600.0)
    peona.add_argument("--dry-run", action="store_true")
    return parser


def selected_sources(root: Path, profile: str, explicit: list[str]) -> list[Source]:
    selected: set[str] | None
    if explicit:
        selected = set(explicit)
    elif profile == "pilot":
        selected = load_source_ids(root / "config/pilot_sources.txt")
    else:
        selected = None
    return load_sources(root / "config/sources.csv", selected)


def run_crawl(args: argparse.Namespace) -> None:
    from scrapy.crawler import CrawlerProcess

    from civic_ai.crawler.spider import MunicipalSpider

    if args.site and (args.source or args.source_id):
        raise SystemExit("Use either --site or configured --source/--source-id options")
    if args.source and args.source_id:
        raise SystemExit("Use either --source or --source-id, not both")
    if args.site:
        try:
            site_specs = [validate_site(url, limit) for url, limit in args.site]
        except argparse.ArgumentTypeError as exc:
            raise SystemExit(str(exc)) from exc
        sources = [source_from_site(url) for url, _ in site_specs]
        if len({source.source_id for source in sources}) != len(sources):
            raise SystemExit("Each site URL may be specified only once")
        source_limits = {
            source.source_id: limit
            for source, (_, limit) in zip(sources, site_specs, strict=True)
        }
    else:
        limits = dict(args.source)
        if len(limits) != len(args.source):
            raise SystemExit("Each source may be specified only once")
        selected_ids = set(limits) if limits else args.source_id
        try:
            sources = selected_sources(args.project_root, args.profile, selected_ids)
        except ValueError as exc:
            raise SystemExit(str(exc)) from exc
        if not sources:
            raise SystemExit("No enabled sources selected")
        source_limits = {
            source.source_id: limits.get(source.source_id, args.max_pages_per_source)
            for source in sources
        }
    if not sources:
        raise SystemExit("No enabled sources selected")
    print("Starting crawl:")
    for source in sources:
        print(f"  {source.source_id}: {source.url} (up to {source_limits[source.source_id]} successful pages)")
    process = CrawlerProcess()
    process.crawl(
        MunicipalSpider,
        sources=sources,
        project_root=str(args.project_root),
        max_pages_per_source=source_limits,
        depth_limit=args.depth,
    )
    process.start()


def run_parse_file(args: argparse.Namespace) -> None:
    path = args.path.resolve()
    if not path.is_file():
        raise SystemExit(f"File not found: {path}")
    try:
        relative_path = path.relative_to(args.project_root)
    except ValueError:
        relative_path = Path(path.name)
    source_url = args.source_url or f"urn:local:{quote(relative_path.as_posix())}"
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    source = Source(
        source_id=args.source_id,
        category=args.category,
        url=source_url,
        crawl_scope="path_prefix",
        enabled=True,
    )
    resource = Resource(
        source=source,
        url=source_url,
        final_url=source_url,
        status=200,
        headers={"Content-Type": content_type},
        body=path.read_bytes(),
        retrieved_at=utc_now(),
    )
    exported = ResourceProcessor(args.project_root).process(resource)
    print(f"document_id={exported.document_id}")
    print(f"version_id={exported.version_id}")
    print(f"markdown={exported.markdown_path.relative_to(args.project_root)}")
    print(f"json={exported.json_path.relative_to(args.project_root)}")
    print(f"chunks={exported.chunk_count}")


def run_validate_config(args: argparse.Namespace) -> None:
    sources = load_sources(args.project_root / "config/sources.csv")
    pilot = selected_sources(args.project_root, "pilot", [])
    print(f"enabled_sources={len(sources)}")
    print(f"pilot_sources={','.join(source.source_id for source in pilot)}")


def run_validate_corpus(args: argparse.Namespace) -> None:
    store = CorpusStore(args.project_root)
    document_paths = sorted(store.documents_root.glob("doc_*/*.json"))
    hashes: dict[str, list[str]] = defaultdict(list)
    issues: list[str] = []

    for path in document_paths:
        try:
            document = json.loads(path.read_text(encoding="utf-8"))
            store.document_validator.validate(document)
            hashes[document["content_sha256"]].append(document["source_url"])
            if not path.with_suffix(".md").exists():
                issues.append(f"Missing Markdown sibling for {path}")
        except (OSError, json.JSONDecodeError, ValidationError, KeyError) as exc:
            issues.append(f"{path}: {type(exc).__name__}: {exc}")

    chunk_path = store.chunks_root / "chunks.jsonl"
    chunk_count = 0
    if chunk_path.exists():
        for line_number, line in enumerate(
            chunk_path.read_text(encoding="utf-8").splitlines(), start=1
        ):
            try:
                store.chunk_validator.validate(json.loads(line))
                chunk_count += 1
            except (json.JSONDecodeError, ValidationError) as exc:
                issues.append(f"{chunk_path}:{line_number}: {type(exc).__name__}: {exc}")
    else:
        issues.append(f"Missing combined chunk export: {chunk_path}")

    duplicates = [urls for urls in hashes.values() if len(urls) > 1]
    print(f"documents={len(document_paths)}")
    print(f"chunks={chunk_count}")
    print(f"duplicate_content_groups={len(duplicates)}")
    for urls in duplicates:
        print(f"duplicate_content={','.join(urls)}")
    if issues:
        for issue in issues:
            print(f"ERROR: {issue}")
        raise SystemExit(1)
    print("status=valid")


def run_export_rag(args: argparse.Namespace) -> None:
    result = build_rag_export(
        args.project_root,
        include_reference=args.include_reference,
        keep_duplicates=args.keep_duplicates,
    )
    print(f"export={result.root.relative_to(args.project_root)}")
    print(f"documents={result.documents}")
    print(f"chunks={result.chunks}")
    print(f"excluded={result.excluded}")
    print(f"duplicate_groups_removed={result.duplicates}")


def run_upload_peona(args: argparse.Namespace) -> None:
    if not args.api_url and not args.dry_run:
        raise SystemExit("Set --api-url or PEONA_API_URL (for example http://localhost:8000)")
    try:
        result = upload_to_peona(
            args.project_root,
            api_url=args.api_url,
            token=args.token,
            wait=not args.no_wait,
            poll_interval=args.poll_interval,
            max_wait_seconds=args.max_wait_seconds,
            dry_run=args.dry_run,
        )
    except (FileNotFoundError, RuntimeError) as exc:
        raise SystemExit(str(exc)) from exc
    print(json.dumps(result["summary"], ensure_ascii=False))
    if result.get("report"):
        print(f"report={result['report']}")


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "crawl":
        run_crawl(args)
    elif args.command == "parse-file":
        run_parse_file(args)
    elif args.command == "validate-config":
        run_validate_config(args)
    elif args.command == "validate-corpus":
        run_validate_corpus(args)
    elif args.command == "export-rag":
        run_export_rag(args)
    elif args.command == "upload-peona":
        run_upload_peona(args)
