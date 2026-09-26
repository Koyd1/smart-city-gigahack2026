#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

parser_bin="${CIVIC_PARSER_BIN:-$project_dir/.venv/bin/civic-parser}"
if [[ ! -x "$parser_bin" ]]; then
  parser_bin="$(command -v civic-parser || true)"
fi
if [[ -z "$parser_bin" ]]; then
  echo "civic-parser is not installed; run the setup commands from README.md" >&2
  exit 1
fi

exec "$parser_bin" --project-root "$project_dir" crawl \
  --profile pilot \
  --depth 2 \
  --max-pages-per-source 500
