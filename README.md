# Civic

Монорепо муниципального ассистента CIVIS (Next.js + FastAPI + RAG + pgvector).

## Состав

- `frontend/` — Next.js 16 (BFF + UI), запускается на хосте
- `backend/` — FastAPI (ingest/chat/health/evaluate), запускается в Docker
- `infra/` — nginx конфиг для production reverse proxy
- `data/exports/rag/` — версия муниципального корпуса и исходные метаданные

## Возможности

- **RAG-пайплайн** с поддержкой текстовых документов (PDF, DOCX, TXT, MD)
- **Поддержка изображений** с автоматическим анализом через OpenAI Vision
  - Извлечение всего видимого текста с изображения
  - Генерация качественного описания (caption) через gpt-4o
  - Индексирование капшенов в векторную базу
  - Полнотекстовый поиск по содержимому изображений

## Prerequisites

- Docker + Docker Compose plugin
- Node.js >= 20.9.0
- npm
- ngrok (опционально, только для публичного доступа через туннель)

T1
cd /Users/alexandrmoroz/Desktop/smart-city-gagahack2026
docker compose up -d backend worker

T2
cd /Users/alexandrmoroz/Desktop/smart-city-gagahack2026/frontend
npm run start -- -H 0.0.0.0 -p 3000


cd /Users/alexandrmoroz/Desktop/smart-city-gagahack2026/frontend
npm i
npm run build
npm run start -- -H 0.0.0.0 -p 3000


T3
ngrok http 3000 --url https://twisting-parade-esquire.ngrok-free.dev

Остановка: ps aux | grep '[n]grok'

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

6. Проверить и импортировать подготовленный сайт-корпус:

```bash
make import-civic EXPORT=/data/exports/site-import/site-bundle-20260926T081707Z.zip
```

По умолчанию это только dry-run: архив и chunks проверяются, БД не меняется.
Чтобы записать/обновить только документы из пакета, явно добавьте `APPLY=1`:

```bash
make import-civic \
  EXPORT=/data/exports/site-import/site-bundle-20260926T081707Z.zip \
  APPLY=1
```

Импорт использует embeddings настроенного провайдера и не очищает остальные
записи БД. Повторный импорт той же версии пропускается. Для импорта одного сайта
с несколькими версиями сохраняется только последняя по `retrieved_at`: в текущей
схеме БД у документа одна активная запись. Сначала используйте тестовую БД:
`APPLY=1` записывает данные в БД из `DATABASE_URL_ASYNC` текущего окружения.
Для импорта одного сайта можно передать `--source-id` напрямую в backend CLI;
без `--apply` CLI также работает только в режиме проверки.

Для теста на одном документе задайте `DOCUMENT_ID`; команда сначала выполнит
dry-run, а запись включается только с `APPLY=1`:

```bash
make import-civic \
  EXPORT=/data/exports/site-import/site-bundle-20260926T081707Z.zip \
  DOCUMENT_ID=doc_21dbd20083f871fc9383
```

```bash
make import-civic \
  EXPORT=/data/exports/site-import/site-bundle-20260926T081707Z.zip \
  DOCUMENT_ID=doc_21dbd20083f871fc9383 \
  APPLY=1
```

Доступ:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/health`

Загруженные документы размером до 15 МБ хранятся в PostgreSQL в колонке
`knowledge_files.binary_content`.

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
- `raganything` вынесен из базового production image (опциональная установка отдельным профилем)

## Публичный доступ через ngrok

Этот вариант подходит для демо и временного общего доступа без отдельного сервера.
ngrok публикует локальный frontend на `localhost:3000` по HTTPS. Backend, Redis и
worker при этом остаются недоступны напрямую из интернета и вызываются через
Next.js/BFF.

Текущий публичный адрес проекта:

```text
https://twisting-parade-esquire.ngrok-free.dev
```

Ссылка работает, только пока включён компьютер и запущены Docker, frontend и
ngrok.

### 1. Установить и авторизовать ngrok

На macOS:

```bash
brew install --cask ngrok
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

Токен берётся в ngrok Dashboard. Не добавляйте его в `.env` и не коммитьте в
репозиторий.

### 2. Запустить HTTPS-туннель

В отдельном терминале из корня проекта:

```bash
ngrok http 3000 --url https://twisting-parade-esquire.ngrok-free.dev
```

Если статический домен не настроен в аккаунте ngrok, запустите:

```bash
ngrok http 3000
```

и скопируйте HTTPS-адрес из строки `Forwarding`. В таком случае подставьте этот
адрес вместо примера во всех следующих командах и настройках.

### 3. Настроить публичный origin

В корневом `.env` укажите публичный URL без завершающего `/`:

```dotenv
NEXTAUTH_URL=https://twisting-parade-esquire.ngrok-free.dev
WEB_ORIGIN=https://twisting-parade-esquire.ngrok-free.dev
APP_DOMAIN=twisting-parade-esquire.ngrok-free.dev
PYTHON_BACKEND_URL=http://127.0.0.1:8000
```

`NEXTAUTH_URL` и `WEB_ORIGIN` обязательны: без них авторизация и создание
публичной сессии могут перенаправить посетителя на `127.0.0.1`.

### 4. Запустить или перезапустить приложение

Backend и worker из корня проекта:

```bash
docker compose up -d --force-recreate backend worker
```

Frontend в отдельном терминале:

```bash
cd frontend
npm ci
npm run build
npm run start -- -H 0.0.0.0 -p 3000
```

Если frontend уже запущен, обязательно остановите его и запустите заново после
изменения `.env`. Пересборка нужна после изменений исходного кода; при изменении
только runtime-переменных достаточно перезапуска `npm run start`.

### 5. Проверить доступность

Откройте публичный адрес в браузере и проверьте health endpoint:

```bash
curl -sS https://twisting-parade-esquire.ngrok-free.dev/api/health
```

Ожидается HTTP `200`. На бесплатном тарифе ngrok новый посетитель может один раз
увидеть промежуточную страницу-предупреждение — после подтверждения откроется
приложение.

Для остановки публичного доступа нажмите `Ctrl+C` в терминале с ngrok. Локальное
приложение продолжит работать. После перезагрузки компьютера туннель, Docker и
frontend нужно запустить снова.

Перед публичной демонстрацией проверьте лимиты `DAILY_AI_BUDGET_USD`,
`MONTHLY_AI_BUDGET_USD`, не публикуйте admin-пароль и не отключайте rate limits.

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
- `REDIS_PASSWORD`
- `PYTHON_BACKEND_URL` (для host-runtime: `http://127.0.0.1:8000`)

Рекомендуемые:

- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_EMBEDDING_DIM`
- `OPENAI_CHAT_MODEL`
- `OPENAI_CHAT_FALLBACK_MODELS`
- `OPENAI_JUDGE_MODEL`
- `OPENAI_MODEL_PRICING_JSON`
- `RAG_TOP_K`, `RAG_SIM_THRESHOLD`, `RAG_CHUNK_SIZE`, `RAG_CHUNK_OVERLAP`, `RAG_PRIMARY_DOCUMENT_CHUNKS`
- `DAILY_AI_BUDGET_USD`, `MONTHLY_AI_BUDGET_USD`, `MAX_CHAT_INPUT_TOKENS`
- `HEALTH_OPENAI_WARN_MS`, `HEALTH_HALL_WARN_THRESHOLD`, `HEALTH_CACHE_SECONDS`
- `LOG_LEVEL`, `LOG_JSON`, `LOG_TO_FILE`, `LOG_FILE_PATH`
- `APP_DOMAIN`

## CI

Workflow: `.github/workflows/ci.yml`

Пайплайн проверяет секреты полной историей Gitleaks, frontend audit/typecheck/tests/build,
backend compile/tests и корректность Docker Compose.

## Optional dependencies

`raganything` не входит в базовый `backend/requirements.txt`, чтобы production build оставался предсказуемым по времени и размеру.
Если нужен экспериментальный режим с `raganything`, устанавливайте его отдельным слоем/образом.

## Health/Quality контроль

- `GET /api/health` (frontend proxy)
- `GET /api/v1/health/live` (liveness)
- `GET /api/v1/health/ready` (PostgreSQL + Redis readiness)
- `GET /api/v1/health/metrics` (кэшированные admin-метрики)
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

Резервное копирование и восстановление описаны в [docs/OPERATIONS.md](docs/OPERATIONS.md).

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
