# Parsing plan for a structure-preserving corpus

## The key correction

Converting everything to plain text loses the evidence chain. The canonical corpus
should retain document versions, hierarchy, page/section coordinates and the exact
original URL. Any later consumer should use an export of that corpus, not become its
only copy.

Keep three representations:

1. **Raw** - the exact downloaded HTML/PDF/DOCX plus HTTP metadata and SHA-256.
2. **Document** - normalized Markdown for people and normalized JSON for machines.
3. **Chunk** - one JSONL record per retrievable fragment, linked to a document version.

Markdown is the easiest lightweight document format. JSONL is the safer canonical
format for filtering, validation and machine import. Do not put embeddings or
search indexes in the parser output; they belong to a later application stage.

## Pipeline

1. Read only enabled URLs from `config/sources.csv`.
2. Fetch politely with per-domain rate limits. Re-check the final URL after redirects.
3. Store response bytes, retrieval time, content type, status, ETag/Last-Modified and
   SHA-256. A failed request never means that an older document was deleted.
4. Discover same-domain documents and attachments within an explicit crawl scope.
5. Extract by type:
   - HTML: remove navigation/cookie/footer boilerplate, retain headings, lists,
     tables, links and the main-content DOM path or anchor.
   - text PDF: extract blocks page by page and retain physical page numbers.
   - scanned PDF/image: OCR per page and record OCR confidence.
   - DOCX: retain headings, paragraphs, tables, footnotes and relationships.
6. Normalize whitespace without rewriting source wording. Detect `ro`, `ru` or
   mixed language, but never replace original text with a translation.
7. Chunk on headings/articles/list boundaries. Start near 400-800 tokens; keep a
   rule and its exceptions together. Use overlap only when a boundary requires it.
8. Validate documents against `schemas/document.schema.json` and optional fragments
   against `schemas/chunk.schema.json`.
9. Export one Markdown file per document version and, when requested, one
   `chunks.jsonl` corpus.

## Stable identifiers

Recommended deterministic keys:

```text
source_id   = normalized origin/domain key
document_id = hash(canonical URL or official document identity)
version_id  = document_id + content SHA-256 prefix
chunk_id    = version_id + structural path + ordinal
```

Changing text creates a new `version_id`; an old citation must never silently point
to new content. Moving the same unchanged file should not create unrelated IDs.

## Portable document export

Each `data/processed/documents/<document_id>/<version_id>.md` should start with YAML
front matter:

```yaml
document_id: doc_...
version_id: ver_...
title: "..."
source_url: "https://..."
retrieved_at: "2026-09-25T10:00:00Z"
content_sha256: "..."
language: ro
document_date: null
effective_from: null
```

The body preserves headings, lists and tables. Add page markers such as
`<!-- page: 14 -->` for PDF-derived text. Keep original links as Markdown links.

## Chunk export

`data/processed/chunks/chunks.jsonl` contains one object per line. Required fields
are defined in `schemas/chunk.schema.json`. Useful metadata includes category,
language, page range, heading path, source URL, retrieval timestamp and extraction
quality. This is an optional parser export; it does not build or require a search
index.

## Exports for future consumers

Use normalized Markdown when a downstream service performs its own chunking. Use
JSONL when it accepts pre-split records and metadata. Always retain originals so a
future consumer can trace exported text back to the exact source artifact.

## Quality gates

- exact quote is present in the referenced normalized version;
- page/section exists and is not inferred by the model;
- empty or low-quality OCR enters a review queue;
- menus and repeated footer text do not dominate chunks;
- tables remain intelligible after linearization;
- deleted/changed pages retain prior versions and retrieval history;
- prompt-like text inside documents is treated strictly as untrusted data.

## Recommended implementation order

Start with 2-3 domains and 30-100 high-value documents. Implement HTML plus text-PDF
extraction first, then OCR/DOCX. Manually compare a sample of every output type with
its original before expanding the crawl. Corpus size is less useful than traceable,
current and structurally correct data.
