# Corpus workspace

This directory separates source evidence from derived artifacts.

- `raw/`: immutable downloaded bytes plus a metadata sidecar.
- `interim/extracted/`: extractor output before cleanup.
- `interim/normalized/`: canonical structured content before chunking.
- `processed/documents/`: lightweight per-version Markdown/JSON exports.
- `processed/chunks/`: optional JSONL fragments ready for later import.

Never manually fix `raw/`. Fix the extractor/normalizer and reproduce downstream
outputs. Do not commit bulk municipal data until licensing, size and privacy rules
are agreed.
