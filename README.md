# Civic

Монорепо HR-ассистента (Next.js + FastAPI + RAG + pgvector).

## Состав

- `frontend/` — Next.js 16 (BFF + UI), запускается на хосте
- `backend/` — FastAPI (ingest/chat/health/evaluate), запускается в Docker
- `infra/` — nginx конфиг для production reverse proxy
- `tasks/` — декомпозиция и roadmap

## Возможности

- **RAG-пайплайн** с поддержкой текстовых документов (PDF, DOCX, TXT, MD)
- **Поддержка изображений** с автоматическим анализом через OpenAI Vision
  - Извлечение всего видимого текста с изображения
  - Генерация качественного описания (caption) через gpt-4o
  - Индексирование капшенов в векторную базу
  - Полнотекстовый поиск по содержимому изображений
  - Подробнее см. [IMAGE_CAPTIONING.md](IMAGE_CAPTIONING.md)

## Prerequisites

- Docker + Docker Compose plugin
- Node.js >= 20.9.0
- npm

## После обновления проекта

Если вы подтянули последние изменения, обновите frontend-зависимости и проверьте локальную версию Node.js:

```bash
git pull
cd frontend
node -v
npm ci
npm run build
```

Если `node -v` ниже `20.9.0`, сначала обновите Node.js.
Если были локальные изменения в старом `frontend/middleware.ts`, перенесите их в `frontend/proxy.ts` перед запуском.

## Быстрый старт (dev)

1. Подготовка env:

```bash
cp .env.example .env
```

2. Запуск backend/infra в Docker:

```bash
make dev
```

3. Запуск frontend на хосте:

```bash
cd frontend
npm install
npm run dev
```

4. Миграции:

```bash
make migrate
```

5. Seed admin:

```bash
make seed
```

Доступ:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/health`
- MinIO API: `http://localhost:9000`
- MinIO Console (dev only): `http://localhost:9001`

## Production запуск (compose override + host frontend)

Подготовка env:

```bash
cp prod.env.example .env
```

Preflight перед деплоем:

```bash
make prod-preflight
```

Сборка и запуск docker-части:

```bash
make prod-up
```

Запуск frontend на хосте:

```bash
cd frontend
npm ci
npm run build
npm run start -- -H 0.0.0.0 -p 3000
```

Остановка docker-части:

```bash
make prod-down
```

Что меняется в prod-режиме:

- backend собирается с `target: prod`
- backend запускается без `--reload`
- frontend не запускается в Docker (работает как host process)
- nginx в Docker проксирует трафик на frontend на хосте (`host.docker.internal:3000`)
- backend доступен на `127.0.0.1:8000`
- MinIO Console `:9001` скрыт
- `raganything` вынесен из базового production image (опциональная установка отдельным профилем)

## Nginx и TLS

- Конфиг: `infra/nginx.conf`
- Сертификаты: `infra/certs/cert.pem`, `infra/certs/key.pem`
- В репозитории есть self-signed cert для локального smoke-теста.
- Для production замените сертификаты реальными (ACME/Cloud cert).

## ENV matrix

Обязательные:

- `DATABASE_URL`
- `DATABASE_URL_ASYNC`
- `OPENAI_API_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `PUBLIC_SESSION_SECRET`
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`
- `REDIS_PASSWORD`
- `PYTHON_BACKEND_URL` (для host-runtime: `http://127.0.0.1:8000`)

Рекомендуемые:

- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_EMBEDDING_DIM`
- `OPENAI_CHAT_MODEL`
- `OPENAI_CHAT_FALLBACK_MODELS`
- `OPENAI_JUDGE_MODEL`
- `OPENAI_MODEL_PRICING_JSON`
- `RAG_TOP_K`, `RAG_SIM_THRESHOLD`
- `HEALTH_OPENAI_WARN_MS`, `HEALTH_HALL_WARN_THRESHOLD`
- `LOG_LEVEL`, `LOG_JSON`, `LOG_TO_FILE`, `LOG_FILE_PATH`
- `APP_DOMAIN`

## CI

Workflow: `.github/workflows/ci.yml`

Пайплайн:

1. `quality`:
- frontend typecheck
- frontend production build
- backend compile check

2. `migrations-smoke`:
- PostgreSQL + pgvector service
- `prisma migrate deploy`
- `alembic upgrade head`

3. `docker-build`:
- сборка production образов (`backend`, `nginx`)

## Optional dependencies

`raganything` не входит в базовый `backend/requirements.txt`, чтобы production build оставался предсказуемым по времени и размеру.
Если нужен экспериментальный режим с `raganything`, устанавливайте его отдельным слоем/образом.

## Health/Quality контроль

- `GET /api/health` (frontend proxy)
- `GET /api/v1/health/detailed` (backend)
- `POST /api/v1/evaluate` (hallucination judge)
- Admin UI: `/admin/health`
- Dashboard включает service health, usage/cost по моделям, legacy estimates, hallucination analytics и coverage warnings

## Runbook деплоя

1. Обновить `.env` production-секретами.
2. Проверить, что нет `CHANGE_ME` значений.
3. Выполнить `make prod-up`.
4. Запустить frontend на хосте (`npm ci && npm run build && npm run start -- -H 0.0.0.0 -p 3000`).
5. Проверить:
- `https://<domain>/healthz`
- `https://<domain>/api/health`
- login + chat smoke-flow

## Rollback checklist

1. Вернуть предыдущий commit/tag.
2. Выполнить `make prod-up` для пересборки предыдущего релиза backend/nginx.
3. Перезапустить frontend на хосте с версией из rollback.
4. Проверить health endpoints.
5. Проверить login/chat/admin smoke.

## Reindex runbook after embedding migration

После перехода на новую embedding размерность (например, `3072`) выполните:

1. `make migrate`
2. Перезапустить backend с актуальными `OPENAI_EMBEDDING_MODEL`/`OPENAI_EMBEDDING_DIM`
3. Получить список файлов: `GET /api/v1/ingest`
4. Для каждого `fileId` вызвать `POST /api/v1/ingest/{file_id}/reindex`
5. Дождаться `READY` по `GET /api/v1/ingest/{file_id}/status` для всех файлов

## Полезные команды

```bash
make logs
make logs-backend
make shell-backend
make prod-build
```
