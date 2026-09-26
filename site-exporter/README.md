# Site data exporter

This isolated CLI packages already processed website data for a future RAG bulk
import endpoint. It does not crawl, re-extract, split, or create embeddings.

## Run

From the repository root, using its virtual environment:

```bash
.venv/bin/python site-exporter/export_site_bundle.py
```

Limit a package to selected sites with one or more `--source-id` values:

```bash
.venv/bin/python site-exporter/export_site_bundle.py \
  --source-id chisinau-education-ordine
```

The default output is a new timestamped ZIP under
`data/exports/site-import/`. Pass `--output /path/to/package.zip` to choose a
different destination. Older packages are never overwritten unless the same
explicit output path is supplied.

The ZIP contains `manifest.json`, one Markdown file per document under
`documents/`, and `chunks.jsonl`. The manifest maps each document and chunk set
to its `source_id`, URL, stable document/version IDs, language, category, and
content hash. Exact duplicates are removed within a site, not across different
sites, so source attribution remains intact. Reference documents are excluded
unless `--include-reference` is supplied.

The target importer should use `chunks.jsonl` as the text to embed and use each
chunk's `document_id` and `version_id` to join the manifest metadata. Markdown is
included as the original normalized document for object storage and downloads.
Do not embed both the Markdown and chunk records.