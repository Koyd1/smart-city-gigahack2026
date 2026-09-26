#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
COMPOSE_PROD_FILE="$ROOT_DIR/docker-compose.prod.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERROR] Env file not found: $ENV_FILE"
  exit 1
fi

required_vars=(
  DATABASE_URL
  DATABASE_URL_ASYNC
  OPENAI_API_KEY
  NEXTAUTH_SECRET
  NEXTAUTH_URL
  PUBLIC_SESSION_SECRET
  MINIO_ROOT_USER
  MINIO_ROOT_PASSWORD
  MINIO_BUCKET
  REDIS_PASSWORD
  PYTHON_BACKEND_URL
)

warn_vars=(
  OPENAI_CHAT_MODEL
  OPENAI_JUDGE_MODEL
  HEALTH_OPENAI_WARN_MS
  HEALTH_HALL_WARN_THRESHOLD
  APP_DOMAIN
)

echo "[INFO] Using env file: $ENV_FILE"

missing=0
for key in "${required_vars[@]}"; do
  if ! grep -Eq "^${key}=" "$ENV_FILE"; then
    echo "[ERROR] Missing required var: $key"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

bad_values=$(grep -E "=\s*CHANGE_ME|=\s*sk-CHANGE_ME|=\s*your-" "$ENV_FILE" || true)
if [[ -n "$bad_values" ]]; then
  echo "[ERROR] Placeholder values detected in $ENV_FILE:"
  echo "$bad_values"
  exit 1
fi

for key in "${warn_vars[@]}"; do
  if ! grep -Eq "^${key}=" "$ENV_FILE"; then
    echo "[WARN] Recommended var not set: $key"
  fi
done

cert_file="$ROOT_DIR/infra/certs/cert.pem"
key_file="$ROOT_DIR/infra/certs/key.pem"
if [[ ! -f "$cert_file" || ! -f "$key_file" ]]; then
  echo "[ERROR] TLS files are missing. Expected:"
  echo "  - $cert_file"
  echo "  - $key_file"
  exit 1
fi

if ! grep -Eq '^NEXTAUTH_URL=https?://' "$ENV_FILE"; then
  echo "[ERROR] NEXTAUTH_URL must be an absolute URL"
  exit 1
fi

if ! grep -Eq '^PYTHON_BACKEND_URL=http://127\.0\.0\.1:8000$' "$ENV_FILE"; then
  echo "[WARN] PYTHON_BACKEND_URL is expected as http://127.0.0.1:8000 for host runtime"
fi

if ! docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD_FILE" --env-file "$ENV_FILE" config >/dev/null; then
  echo "[ERROR] docker compose prod config is invalid"
  exit 1
fi

echo "[OK] Production preflight passed"
