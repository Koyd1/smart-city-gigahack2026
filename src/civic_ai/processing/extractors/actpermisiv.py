from __future__ import annotations

import json
import re

from civic_ai.models import Extraction
from civic_ai.processing.normalize import normalize_markdown


def _value(record: dict[str, object], name: str) -> str:
    value = record.get(f"{name}_ro") or record.get(name) or ""
    return str(value).strip()


def _plain_blocks(value: str) -> str:
    lines = [line.strip() for line in value.replace("\r", "").splitlines()]
    rendered: list[str] = []
    for line in lines:
        if not line:
            if rendered and rendered[-1]:
                rendered.append("")
            continue
        if re.match(r"^\d+[.)]\s+", line) or line.startswith(("- ", "* ")):
            rendered.append(line)
        elif rendered and rendered[-1] and not rendered[-1].startswith(("#", "- ", "* ")):
            rendered[-1] = f"{rendered[-1]} {line}"
        else:
            rendered.append(line)
    return "\n".join(rendered).strip()


def _catalog(payload: dict[str, object], url: str) -> Extraction:
    entries = payload.get("entries", [])
    lines = [
        "# Acte permisive disponibile",
        "",
        "Catalogul public al serviciilor și actelor permisive disponibile online.",
        "",
        "## Servicii",
        "",
    ]
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict):
            continue
        identifier = entry.get("ID")
        title = _value(entry, "Title")
        authority = _value(entry, "AuthorityId_ReferenceTitle")
        route = f"https://actpermisiv.gov.md/#/ep/permit/{identifier}"
        suffix = f" — {authority}" if authority else ""
        lines.append(f"- [{title}]({route}){suffix}")
    markdown = normalize_markdown("\n".join(lines))
    return Extraction(
        title="Acte permisive disponibile",
        markdown=markdown,
        language="ro",
        method="actpermisiv-public-api",
        quality=1.0,
        canonical_url=url,
    )


def _permit(payload: dict[str, object], url: str) -> Extraction:
    raw_info = payload.get("info")
    info: dict[str, object] = raw_info if isinstance(raw_info, dict) else {}
    supporting = payload.get("supporting", [])
    legal = payload.get("legal", [])
    title = _value(info, "Title") or str(payload.get("catalog_title") or url)
    lines = [f"# {title}"]
    description = _value(info, "Description")
    if description:
        lines.extend(["", description])

    authority = _value(info, "ServiceProvider") or _value(
        info, "AuthorityId_ReferenceTitle"
    )
    if authority:
        lines.extend(["", "## Autoritatea emitentă", "", authority])

    if isinstance(supporting, list) and supporting:
        lines.extend(["", "## Documente însoțitoare", ""])
        for row in supporting:
            if not isinstance(row, dict):
                continue
            text = _value(row, "SupportingDocumentTypeId_ReferenceTitle")
            if not text:
                continue
            if str(row.get("level", "")) == "0":
                lines.extend([f"### {text}", ""])
            else:
                lines.append(f"- {text}")

    if isinstance(legal, list) and legal:
        lines.extend(["", "## Cadrul legal", ""])
        for row in legal:
            if not isinstance(row, dict):
                continue
            text = _value(row, "Text") or _value(row, "LexTypeId_ReferenceTitle")
            link = _value(row, "Link")
            if text:
                lines.append(f"- [{text}]({link})" if link else f"- {text}")

    process = _plain_blocks(_value(info, "FullDescription"))
    if process:
        lines.extend(["", "## Procesul de eliberare", "", process])
    for heading, field in (
        ("Perioada de valabilitate", "PeriodOfValidityText"),
        ("Taxa", "FeeText"),
        ("Durata de prestare", "TimeToIssueText"),
    ):
        value = _value(info, field)
        if value:
            lines.extend(["", f"## {heading}", "", value])

    markdown = normalize_markdown("\n".join(lines))
    return Extraction(
        title=title,
        markdown=markdown,
        language="ro",
        method="actpermisiv-public-api",
        quality=1.0,
        canonical_url=url,
    )


def extract_actpermisiv(body: bytes, url: str) -> Extraction:
    try:
        payload = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid actpermisiv API payload") from exc
    if not isinstance(payload, dict):
        raise TypeError("Invalid actpermisiv API payload")
    kind = payload.get("kind")
    if kind == "catalog":
        return _catalog(payload, url)
    if kind == "permit":
        return _permit(payload, url)
    raise ValueError(f"Unsupported actpermisiv payload kind: {kind}")
