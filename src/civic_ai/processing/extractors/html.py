from __future__ import annotations

import re
from urllib.parse import urlsplit

from lxml import etree
from lxml import html as lxml_html

from civic_ai.crawler.policy import canonicalize_url, resolve_content_url
from civic_ai.models import Extraction
from civic_ai.processing.language import detect_language
from civic_ai.processing.normalize import normalize_markdown

HEADING_TAGS = {f"h{level}": level for level in range(1, 7)}
CONTAINER_TAGS = {
    "article",
    "aside",
    "body",
    "dd",
    "details",
    "div",
    "dl",
    "dt",
    "figcaption",
    "figure",
    "header",
    "main",
    "section",
}
BLOCK_TAGS = CONTAINER_TAGS | {
    "blockquote",
    "hr",
    "ol",
    "p",
    "pre",
    "table",
    "ul",
    *HEADING_TAGS,
}
BOILERPLATE_TOKENS = re.compile(
    r"(?:^|[-_\s])(breadcrumb|cookie|footer|header|login|menu|modal|nav|navigation|"
    r"pagination|search|share|sidebar|social|toolbar)(?:$|[-_\s])",
    re.IGNORECASE,
)
TITLE_CLASS = re.compile(
    r"(?:^|[-_\s])(heading|section-title|title)(?:$|[-_\s])", re.IGNORECASE
)


def _tag(node: etree._Element) -> str:
    return node.tag.lower() if isinstance(node.tag, str) else ""


def _clean_text(value: str | None) -> str:
    return " ".join((value or "").split())


def _class_tokens(node: etree._Element) -> str:
    return f"{node.get('id') or ''} {node.get('class') or ''}".strip()


def _is_hidden(node: etree._Element) -> bool:
    style = re.sub(r"\s+", "", (node.get("style") or "").lower())
    return (
        node.get("hidden") is not None
        or (node.get("aria-hidden") or "").lower() == "true"
        or (node.get("type") or "").lower() == "hidden"
        or "display:none" in style
        or "visibility:hidden" in style
    )


def _prune(tree: etree._Element) -> None:
    doomed: list[etree._Element] = []
    for node in tree.iter():
        tag = _tag(node)
        if not tag:
            doomed.append(node)
            continue
        if tag in {"script", "style", "noscript", "template", "svg", "canvas"}:
            doomed.append(node)
            continue
        role = (node.get("role") or "").lower()
        if tag in {"nav", "footer"} or role in {"navigation", "contentinfo"}:
            doomed.append(node)
            continue
        if _is_hidden(node) or BOILERPLATE_TOKENS.search(_class_tokens(node)):
            doomed.append(node)
    for node in reversed(doomed):
        if node.getparent() is not None:
            node.drop_tree()


def _top_level(nodes: list[etree._Element]) -> list[etree._Element]:
    selected = set(nodes)
    return [node for node in nodes if not any(parent in selected for parent in node.iterancestors())]


def _content_roots(tree: etree._Element, url: str) -> list[etree._Element]:
    host = (urlsplit(url).hostname or "").lower()
    if host == "extrascolar.md":
        nodes = tree.xpath(
            "//section[contains(concat(' ', normalize-space(@class), ' '), ' activities ')]"
            " | //section[contains(concat(' ', normalize-space(@class), ' '), ' activity-page ')]"
            " | //section[contains(concat(' ', normalize-space(@class), ' '), ' ad-features ')]"
            " | //section[contains(concat(' ', normalize-space(@class), ' '), ' activity-details ')]"
        )
        if nodes:
            return _top_level(nodes)
    if host == "proiecte.chisinau.md":
        nodes = tree.xpath(
            "//*[@id='content'] | "
            "//section[contains(concat(' ', normalize-space(@class), ' '), ' Blog-list ')]"
        )
        if nodes:
            return _top_level(nodes)
    nodes = tree.xpath("//main | //article | //*[@role='main'] | //*[@id='content']")
    if nodes:
        return _top_level(nodes)
    body = tree.xpath("//body")
    return body or [tree]


class MarkdownRenderer:
    def __init__(self, url: str) -> None:
        self.url = url

    def render(self, roots: list[etree._Element]) -> str:
        blocks: list[str] = []
        for root in roots:
            blocks.extend(self._block(root))
        compact: list[str] = []
        for block in blocks:
            block = block.strip()
            if block and (not compact or block != compact[-1]):
                compact.append(block)
        return normalize_markdown("\n\n".join(compact))

    def _heading_level(self, node: etree._Element) -> int | None:
        tag = _tag(node)
        if tag in HEADING_TAGS:
            return HEADING_TAGS[tag]
        if (node.get("role") or "").lower() == "heading":
            try:
                return min(6, max(1, int(node.get("aria-level", "2"))))
            except ValueError:
                return 2
        if tag in {"div", "span", "strong"} and TITLE_CLASS.search(_class_tokens(node)):
            return 2
        return None

    def _block(self, node: etree._Element) -> list[str]:
        if _is_hidden(node):
            return []
        tag = _tag(node)
        level = self._heading_level(node)
        if level is not None:
            text = self._inline(node)
            return [f"{'#' * level} {text}"] if text else []
        if tag == "p":
            text = self._inline(node)
            return [text] if text else []
        if tag in {"ul", "ol"}:
            rendered = self._list(node, ordered=tag == "ol")
            return [rendered] if rendered else []
        if tag == "table":
            rendered = self._table(node)
            return [rendered] if rendered else []
        if tag == "blockquote":
            text = self._inline(node)
            return ["\n".join(f"> {line}" for line in text.splitlines())] if text else []
        if tag == "pre":
            text = "".join(node.itertext()).strip()
            return [f"```\n{text}\n```"] if text else []
        if tag == "hr":
            return ["---"]
        if tag not in CONTAINER_TAGS:
            text = self._standalone_inline(node)
            return [text] if text else []

        blocks: list[str] = []
        pending: list[str] = [_clean_text(node.text)] if _clean_text(node.text) else []

        def flush() -> None:
            text = _clean_text(" ".join(pending))
            if text:
                blocks.append(text)
            pending.clear()

        for child in node:
            child_tag = _tag(child)
            if child_tag in BLOCK_TAGS or self._heading_level(child) is not None:
                flush()
                blocks.extend(self._block(child))
            else:
                rendered = self._standalone_inline(child)
                if rendered:
                    pending.append(rendered)
            tail = _clean_text(child.tail)
            if tail:
                pending.append(tail)
        flush()
        return blocks

    def _inline(self, node: etree._Element) -> str:
        parts: list[str] = []
        if node.text:
            parts.append(node.text)
        for child in node:
            child_tag = _tag(child)
            content = self._inline(child)
            if child_tag == "br":
                rendered = "\n"
            elif child_tag == "a":
                href = resolve_content_url(self.url, child.get("href", ""))
                rendered = f"[{content}]({href})" if content and href else content
            elif child_tag in {"strong", "b"}:
                rendered = f"**{content}**" if content else ""
            elif child_tag in {"em", "i"}:
                rendered = f"*{content}*" if content else ""
            elif child_tag == "code":
                rendered = f"`{content}`" if content else ""
            else:
                rendered = content
            parts.append(rendered)
            if child.tail:
                parts.append(child.tail)
        text = "".join(parts)
        text = re.sub(r"[ \t\f\v]+", " ", text)
        text = re.sub(r" *\n *", "\n", text)
        return text.strip()

    def _standalone_inline(self, node: etree._Element) -> str:
        content = self._inline(node)
        tag = _tag(node)
        if tag == "a":
            href = resolve_content_url(self.url, node.get("href") or "")
            return f"[{content}]({href})" if content and href else content
        if tag in {"strong", "b"}:
            return f"**{content}**" if content else ""
        if tag in {"em", "i"}:
            return f"*{content}*" if content else ""
        if tag == "code":
            return f"`{content}`" if content else ""
        return content

    def _list(self, node: etree._Element, *, ordered: bool, depth: int = 0) -> str:
        rows: list[str] = []
        items = [child for child in node if _tag(child) == "li"]
        for index, item in enumerate(items, start=1):
            inline_parts: list[str] = []
            if _clean_text(item.text):
                inline_parts.append(_clean_text(item.text))
            nested: list[etree._Element] = []
            for child in item:
                if _tag(child) in {"ul", "ol"}:
                    nested.append(child)
                else:
                    text = self._standalone_inline(child)
                    if text:
                        inline_parts.append(text)
                if _clean_text(child.tail):
                    inline_parts.append(_clean_text(child.tail))
            marker = f"{index}." if ordered else "-"
            text = _clean_text(" ".join(inline_parts))
            if text:
                rows.append(f"{'  ' * depth}{marker} {text}")
            for nested_list in nested:
                child_rows = self._list(
                    nested_list, ordered=_tag(nested_list) == "ol", depth=depth + 1
                )
                if child_rows:
                    rows.append(child_rows)
        return "\n".join(rows)

    def _table(self, node: etree._Element) -> str:
        rows: list[list[str]] = []
        header_flags: list[bool] = []
        for row in node.xpath(".//tr"):
            cells = row.xpath("./th | ./td")
            if not cells:
                continue
            rows.append([self._inline(cell).replace("|", "\\|") for cell in cells])
            header_flags.append(any(_tag(cell) == "th" for cell in cells))
        if not rows:
            return ""
        width = max(len(row) for row in rows)
        rows = [row + [""] * (width - len(row)) for row in rows]
        if not header_flags[0]:
            rows.insert(0, [f"Coloană {index}" for index in range(1, width + 1)])
        output = ["| " + " | ".join(rows[0]) + " |"]
        output.append("| " + " | ".join("---" for _ in range(width)) + " |")
        output.extend("| " + " | ".join(row) + " |" for row in rows[1:])
        return "\n".join(output)


def _first_heading(roots: list[etree._Element]) -> str:
    for root in roots:
        for node in root.iter():
            tag = _tag(node)
            is_primary_heading = tag in {"h1", "h2", "h3"}
            if is_primary_heading or (node.get("role") or "").lower() == "heading":
                text = _clean_text(" ".join(node.itertext()))
                if text:
                    return text
    return ""


def _metadata_title(tree: etree._Element, url: str) -> str:
    values = tree.xpath("//meta[@property='og:title']/@content")
    raw = _clean_text(values[0] if values else tree.xpath("string(//title)"))
    for separator in (" | ", " — ", " - "):
        if separator in raw:
            raw = raw.split(separator, 1)[0].strip()
            break
    return raw or url


def extract_html(body: bytes, url: str) -> Extraction:
    try:
        markup = body.decode("utf-8")
    except UnicodeDecodeError:
        markup = body.decode("latin-1")
    tree = lxml_html.fromstring(markup, base_url=url)
    declared_language = tree.get("lang")
    canonical_values = tree.xpath(
        "//link[contains(concat(' ', normalize-space(@rel), ' '), ' canonical ')]/@href"
    )
    canonical_url = canonicalize_url(url, canonical_values[0]) if canonical_values else None
    _prune(tree)
    roots = _content_roots(tree, url)
    title = _first_heading(roots) or _metadata_title(tree, url)
    markdown = MarkdownRenderer(url).render(roots)
    if not markdown.strip():
        raise ValueError("DOM extractor did not find main page content")
    heading_titles = {
        _clean_text(match.group(2))
        for match in re.finditer(r"^(#{1,6})\s+(.+)$", markdown, re.MULTILINE)
    }
    if title not in heading_titles:
        markdown = normalize_markdown(f"# {title}\n\n{markdown}")
    return Extraction(
        title=title,
        markdown=markdown,
        language=detect_language(markdown, declared_language),
        method="dom-markdown",
        quality=1.0,
        canonical_url=canonical_url,
    )
