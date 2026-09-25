from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from civic_ai.processing.storage import atomic_write, json_text


def _ingest_url(api_url: str) -> str:
    base = api_url.rstrip("/")
    if base.endswith("/api/v1"):
        return f"{base}/ingest"
    if base.endswith("/api/v1/ingest"):
        return base
    return f"{base}/api/v1/ingest"


def _latest_export(project_root: Path) -> Path:
    pointer = project_root / "data/exports/rag/latest.json"
    if not pointer.is_file():
        raise FileNotFoundError("RAG export not found; run `civic-parser export-rag` first")
    data = json.loads(pointer.read_text(encoding="utf-8"))
    export_root = project_root / data["path"]
    if not export_root.is_dir():
        raise FileNotFoundError(f"Export directory does not exist: {export_root}")
    return export_root


def upload_to_peona(
    project_root: Path,
    *,
    api_url: str,
    token: str | None = None,
    wait: bool = True,
    poll_interval: float = 2.0,
    max_wait_seconds: float = 600.0,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Upload the latest Markdown export to Peona and optionally wait for indexing."""
    export_root = _latest_export(project_root)
    document_root = export_root / "documents"
    documents = sorted(document_root.glob("*.md"))
    if not documents:
        raise FileNotFoundError(f"No Markdown documents found in {document_root}")

    result: dict[str, Any] = {
        "api_url": api_url,
        "export": str(export_root.relative_to(project_root)),
        "started_at": datetime.now(UTC).isoformat(),
        "dry_run": dry_run,
        "documents": [],
    }
    if dry_run:
        result["documents"] = [
            {"filename": path.name, "status": "DRY_RUN", "size": path.stat().st_size}
            for path in documents
        ]
        result["summary"] = {"total": len(documents), "uploaded": 0, "ready": 0, "failed": 0}
        return result

    ingest_url = _ingest_url(api_url)
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    timeout = httpx.Timeout(60.0, connect=15.0)
    try:
        with httpx.Client(headers=headers, timeout=timeout) as client:
            listing = client.get(ingest_url)
            listing.raise_for_status()
            existing = {
                item.get("filename")
                for item in listing.json().get("items", [])
                if isinstance(item, dict)
            }

            uploaded: list[dict[str, Any]] = []
            for path in documents:
                if path.name in existing:
                    result["documents"].append(
                        {
                            "filename": path.name,
                            "status": "SKIPPED_EXISTING",
                            "size": path.stat().st_size,
                        }
                    )
                    continue
                try:
                    with path.open("rb") as handle:
                        response = client.post(
                            ingest_url,
                            files={"file": (path.name, handle, "text/markdown")},
                        )
                    response.raise_for_status()
                    payload = response.json()
                    item = {
                        "filename": path.name,
                        "file_id": payload["fileId"],
                        "status": payload.get("status", "PENDING"),
                        "size": path.stat().st_size,
                    }
                    result["documents"].append(item)
                    uploaded.append(item)
                except (httpx.HTTPError, KeyError, ValueError) as exc:
                    result["documents"].append(
                        {"filename": path.name, "status": "UPLOAD_ERROR", "error": str(exc)}
                    )

            if wait and uploaded:
                deadline = time.monotonic() + max_wait_seconds
                pending = {item["file_id"]: item for item in uploaded}
                while pending and time.monotonic() < deadline:
                    for file_id, item in list(pending.items()):
                        try:
                            response = client.get(f"{ingest_url}/{file_id}/status")
                            response.raise_for_status()
                            payload = response.json()
                            item["status"] = payload.get("status", item["status"])
                            item["chunk_count"] = payload.get("chunkCount")
                            if item["status"] in {"READY", "ERROR"}:
                                pending.pop(file_id)
                        except (httpx.HTTPError, ValueError) as exc:
                            item["status"] = "STATUS_ERROR"
                            item["error"] = str(exc)
                            pending.pop(file_id)
                    if pending:
                        time.sleep(poll_interval)
                for item in pending.values():
                    item["status"] = "TIMEOUT"
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Cannot connect to Peona ingest API at {ingest_url}: {exc}") from exc

    statuses = [item["status"] for item in result["documents"]]
    result["finished_at"] = datetime.now(UTC).isoformat()
    result["summary"] = {
        "total": len(documents),
        "uploaded": sum(status not in {"SKIPPED_EXISTING", "UPLOAD_ERROR"} for status in statuses),
        "ready": statuses.count("READY"),
        "skipped_existing": statuses.count("SKIPPED_EXISTING"),
        "failed": sum(
            status in {"ERROR", "UPLOAD_ERROR", "STATUS_ERROR", "TIMEOUT"}
            for status in statuses
        ),
    }
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    report_path = export_root / f"peona-upload-{timestamp}.json"
    atomic_write(report_path, json_text(result))
    result["report"] = str(report_path.relative_to(project_root))
    return result
