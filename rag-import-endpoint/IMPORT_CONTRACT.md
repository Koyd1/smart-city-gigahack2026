# Proposed site bundle import contract

This contract describes the importer to add to the existing RAG application. It
does not require database schema changes. The implementation must be wired into
the actual RAG app's authentication, dependency providers, and durable task
runner before deployment.

## Request

`POST /api/v1/ingest/site-bundle`, authenticated the same way as the existing
ingest routes. Accept one multipart field named `package` containing a ZIP made
by `site-exporter/export_site_bundle.py`.

The ZIP has `manifest.json`, `chunks.jsonl`, and the Markdown files referenced by
the manifest. Validate the format/version, file paths, hashes, declared sizes,
document/chunk identities, and configured compressed and uncompressed size
limits before scheduling work. Reject unknown format versions and malformed
packages; never extract archive paths directly onto the filesystem.

## Accepted response

Return `202 Accepted` after validation and durable scheduling:

```json
{
  "importId": "...",
  "status": "PENDING",
  "documentsAccepted": 10,
  "chunksAccepted": 125,
  "items": [
    {"sourceId": "...", "documentId": "...", "fileId": "...", "status": "PENDING"}
  ]
}
```

The returned `fileId` values should work with existing `GET /api/v1/ingest/{fileId}/status`.
The endpoint must not report acceptance until the package is validated and a
durable queue has accepted the job. If the service has no durable queue, return a
synchronous per-document result instead of claiming durable background work.

## Per-document processing

1. Derive the stable key from `(source_id, document_id)`. Use it to upsert one
   `KnowledgeFile` row without adding columns. Re-importing the same version is a
   no-op; importing a new version replaces that file's chunks and metadata while
   retaining the same `fileId`.
2. Store the Markdown bytes in MinIO under a deterministic, versioned object key;
   set `filename`, `mime_type`, `size`, and `storage_path` on `KnowledgeFile`.
3. Mark the file `PROCESSING`. Embed the supplied chunk text through the existing
   real embedding provider, in bounded batches. Require exactly 3072 finite
   numeric values per embedding. Embedding errors must fail the document; do not
   accept the current development fallback's fake vectors.
4. Replace that file's `VectorChunk` rows transactionally. Preserve the supplied
   chunk text and put `source_id`, `document_id`, `version_id`, `source_url`,
   title, category, language, heading path, page range, retrieval time, and
   `chunk_id` in the existing `metadata` JSON column. Set `chunk_count` and
   `READY` only after all rows commit. On failure, roll back partial vector rows
   and mark the file `ERROR`.
5. Process documents independently so one bad document does not discard the
   other valid documents. Keep per-file status available through the existing
   status endpoint; the import response should include a summary when complete.

## Why use prepared chunks

The website parser has already extracted and structurally chunked the pages and
documents. Sending those chunks avoids reparsing Markdown and preserves page and
heading metadata. The RAG service still creates embeddings with its configured
model, so no vectors or model-specific values are exported from this project.

The database remains unchanged: `KnowledgeFile` tracks the original Markdown and
ingest status; `VectorChunk.file_id` links the rows; `VectorChunk.metadata`
retains site provenance and parser metadata.

## Required host integration details

Before turning this contract into deployable route/worker files, confirm the RAG
service's authentication dependencies, settings/provider construction, task
queue, transaction/session lifecycle, and intended behavior for old versions.
The code snippets supplied so far establish the models and current ingest path,
but not those integration boundaries.