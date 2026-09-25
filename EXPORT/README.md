# District Botanica export

Package prepared for handoff.

- `documents/` contains 727 Markdown documents.
- `chunks.jsonl` contains 1,063 chunks for metadata-aware RAG import.
- `manifest.json` contains document metadata and source URLs.
- `coverage.json` records sitemap coverage: 639 of 658 URLs (97.11%). The remaining 19 sitemap entries are legacy URLs returning 404 or unavailable after URL encoding.
- `unprocessed-binary/` contains two PDFs and one DOCX saved from the crawl but excluded from the Markdown export because OCR conversion stalled. Process them separately if binary originals are required.

For managed RAG, upload only `documents/`. For metadata-aware RAG, import `chunks.jsonl` instead of uploading the Markdown files as a second corpus.
