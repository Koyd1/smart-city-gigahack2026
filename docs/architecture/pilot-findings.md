# Pilot crawl findings

Date: 2026-09-25

The initial smoke crawl used depth 1 and a limit of three scheduled pages per
source. The standard pilot then used depth 2 and a limit of 20 pages per source.
Both runs validate behavior rather than corpus completeness.

## Results

- `chisinau-transparency`: not fetched because the host's current `robots.txt`
  disallows all crawler paths. The parser does not bypass that instruction. A data
  export, explicit permission or another official endpoint is needed for this host.
- `chisinau-projects`: accessible and parsed as Romanian HTML. `/` and `/ro` expose
  the same normalized main text; both URLs are retained and their identical
  `content_sha256` values make the duplication detectable.
- `agsv-tree-works`: accessible, but the Annex URL currently serves a page titled
  `Contacte`, not a tree-work diagram. This is a source-registry issue rather than an
  extraction error and should be reviewed before a larger crawl.

The standard pilot processed 20 web responses with zero extraction failures. One
source was not processed because of `robots.txt`. Together with the two local
reference PDFs, the validated sample contains 22 documents and 98 chunks. One
duplicate-content group (`proiecte.chisinau.md/` and `/ro`) is intentionally retained
and reported by `civic-parser validate-corpus`.

## Verified parser behavior

- raw responses and HTTP metadata are retained;
- tracking parameters, fragments and trailing slashes are canonicalized;
- document versions are based on normalized useful content, not volatile HTML;
- PDF tables and layout are retained in Docling JSON;
- PDF Markdown and chunks retain physical page markers;
- Romanian, Russian and English are detected locally;
- all normalized documents and chunks validate against repository schemas;
- crawl reports distinguish processed, skipped, failed and not-processed sources.
