# Configuration

`sources.csv` is the reviewed crawl allowlist derived from Annex 1. A source row is
an entry point, not permission to crawl the whole internet.

- `path_prefix`: follow only pages below the listed path and explicitly linked files.
- `same_domain`: discovery may stay on the same host, subject to depth, rate and
  document-count limits configured by the crawler.

The crawler must still respect site terms, robots guidance, redirects and request
rate limits. Keep `http://` entries as supplied until redirect behavior is verified.
