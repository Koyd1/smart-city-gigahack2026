# Operator scripts

Small entrypoints for crawl, extract, normalize, chunk, validate and export jobs.
Core logic belongs under `src/civic_ai/` so it remains testable.

`parse_pilot.sh` crawls the three sources listed in `config/pilot_sources.txt` with
the conservative default limits.
