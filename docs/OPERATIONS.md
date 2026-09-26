# CIVIS operations

## PostgreSQL backups

Documents are stored in `knowledge_files.binary_content`, so database backups contain both
metadata and original files. Enable point-in-time recovery and daily backups in the managed
PostgreSQL provider. Keep at least 30 daily restore points and test a restore quarterly.

Create an additional local custom-format backup:

```bash
make backup
```

Restore into an empty target database:

```bash
docker run --rm -e DATABASE_URL -v "$PWD/backups:/backups" postgres:17-alpine \
  pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" /backups/civis-TIMESTAMP.dump
```

## Ingestion queue

`worker` consumes Redis-backed ARQ jobs. Jobs retry up to three times. The worker startup hook
requeues `PENDING` jobs and `PROCESSING` jobs whose heartbeat is older than 15 minutes.

## Usage controls

Set `DAILY_AI_BUDGET_USD`, `MONTHLY_AI_BUDGET_USD`, and `MAX_CHAT_INPUT_TOKENS` in production.
Public session creation, login, chat, feedback, and concurrent streams are limited through Redis.

## Secret response

If a secret reaches Git history, revoke it at the provider first, replace it, rewrite the remote
history, and rotate any downstream credentials that depended on it. Gitleaks runs on every push
and pull request.
