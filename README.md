# smart-city-gigahack2026

Parser for Chisinau municipal websites and documents.

The repository currently contains only the reproducible data-ingestion pipeline:

```text
official source -> immutable raw file -> extracted content -> normalized document -> lightweight export
```

## Repository layout

```text
config/                     Source registry and pipeline settings
data/
  raw/                      Downloaded originals and HTTP metadata (not committed)
  interim/extracted/        Direct extraction from HTML/PDF/DOCX/OCR
  interim/normalized/       Clean, structure-preserving documents
  processed/documents/      Lightweight Markdown/JSON documents
  processed/chunks/         Optional JSONL fragments for later import
docs/
  reference/                Input and reference PDFs
  architecture/             Parsing decisions and data contracts
schemas/                    Machine-readable document and chunk contracts
src/civic_ai/
  crawler/                  Allowlisted download, HTTP metadata, versioning
  processing/extractors/    HTML, PDF, DOCX and OCR adapters
  processing/               Normalize, classify, chunk, validate and export
scripts/                    Operator entrypoints
tests/fixtures/             Small safe test documents
```

The ingestion design and recommended output formats are described in
[`docs/architecture/ingestion.md`](docs/architecture/ingestion.md). The initial
allowlist from Annex 1 is in [`config/sources.csv`](config/sources.csv).

## Output rule

Every processed file must retain its source URL, retrieval time, content hash,
language and structural coordinates such as headings, page numbers or HTML anchors.
Application, search and chat code will be added only after the corpus pipeline is
stable.

## Setup

Python 3.11 or newer is required. The default installation includes Docling because
PDF/DOCX structure is part of the parser output.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

## Commands

Validate the 42-source registry and the three-source pilot profile:

```bash
civic-parser validate-config
```

Validate all generated JSON and JSONL files and report duplicate content:

```bash
civic-parser validate-corpus
```

Run a deliberately small pilot crawl:

```bash
civic-parser crawl --profile pilot --depth 1 --max-pages-per-source 5
```

Run the standard pilot:

```bash
./scripts/parse_pilot.sh
```

Parse a local PDF or DOCX without crawling:

```bash
civic-parser parse-file docs/reference/List_of_Data_Sources.pdf \
  --source-id annex-1 \
  --category reference
```

Each successful document produces:

- immutable bytes and an HTTP metadata sidecar under `data/raw/`;
- direct extraction and lossless Docling JSON under `data/interim/extracted/`;
- validated normalized JSON under `data/interim/normalized/`;
- portable Markdown and JSON under `data/processed/documents/`;
- per-version JSONL and a combined `data/processed/chunks/chunks.jsonl`.

Every crawl also writes a summary to `data/processed/reports/`.

The first live-run findings are recorded in
[`docs/architecture/pilot-findings.md`](docs/architecture/pilot-findings.md).

## RAG upload package

Do not upload the entire `data/processed/` directory: it includes internal reference
documents and exact duplicates. Build a clean package instead:

```bash
civic-parser validate-corpus
civic-parser export-rag
cat data/exports/rag/latest.json
```

For a managed RAG service, upload only the Markdown files from the generated
`documents/` directory. For a metadata-aware importer, use its `chunks.jsonl`.
Never upload both representations into the same corpus.

Upload the latest package directly to a running Peona backend:

```bash
civic-parser upload-peona --api-url http://localhost:8000
```

The command skips existing filenames and waits until Peona marks newly uploaded
documents as `READY`.

The complete Russian runbook is in [`docs/RUNBOOK_RU.md`](docs/RUNBOOK_RU.md).
