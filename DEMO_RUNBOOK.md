# Demo Runbook

Инструкция для локального запуска проекта и публикации наружу через tunnel.

## Что должно быть установлено

- Docker Desktop
- Node.js `>= 20.9`
- npm
- `ngrok`

## Что должно быть настроено заранее

В корне проекта должен существовать файл `.env`.

Минимально проверь в `.env`:

```env
DATABASE_URL=...
DATABASE_URL_ASYNC=...
OPENAI_API_KEY=...
MINIO_ROOT_PASSWORD=...
REDIS_PASSWORD=...
NEXTAUTH_SECRET=...
PUBLIC_SESSION_SECRET=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
PYTHON_BACKEND_URL=http://127.0.0.1:8000
WEB_ORIGIN=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

Если `ngrok` еще не привязан к аккаунту:

```bash
ngrok config add-authtoken 3BG9QlEBaKj3ZyigBwAFbXR1vh0_6YGgYgXC8n24n9XVpsDxd
```

## Первый запуск

Установить frontend-зависимости:

```bash
cd frontend
npm ci
cd ..
```

## Запуск для демо

Открой 4 терминала.

### Терминал 1: backend + redis + minio

```bash
cd /Users/alexandrmoroz/Peona-Orange-Systems-2026
make dev
```

### Терминал 2: миграции и seed

Запускать после того, как `make dev` поднялся без ошибок.

```bash
cd /Users/alexandrmoroz/Peona-Orange-Systems-2026
make migrate
make seed
```

`make seed` нужен, если нужен admin-пользователь из `.env`.

### Терминал 3: frontend

```bash
cd /Users/alexandrmoroz/Peona-Orange-Systems-2026/frontend
npm run build
PYTHON_BACKEND_URL=http://127.0.0.1:8000 npm run start -- -H 0.0.0.0 -p 3000
```

Локальная проверка:

- `http://localhost:3000`
- `http://localhost:3000/api/health`

### Терминал 4: tunnel

```bash
ngrok http 3000
```

Скопируй публичный `https://...` URL из `ngrok` и отправь его тем, кому нужен доступ.

## Если логин или редиректы ломаются

Иногда нужно подставить текущий `ngrok` URL в `.env`.

Пример:

```env
NEXTAUTH_URL=https://example.ngrok-free.app
WEB_ORIGIN=https://example.ngrok-free.app
```

После этого перезапусти frontend:

```bash
cd /Users/alexandrmoroz/Peona-Orange-Systems-2026/frontend
PYTHON_BACKEND_URL=http://127.0.0.1:8000 npm run start -- -H 0.0.0.0 -p 3000
```

## Быстрый чеклист перед демо

- `make dev` работает без ошибок
- `make migrate` завершился успешно
- frontend открылся на `localhost:3000`
- `http://localhost:3000/api/health` отвечает
- вход под `ADMIN_EMAIL` / `ADMIN_PASSWORD` работает
- если нужен RAG, тестовый файл загружен заранее
- `ngrok` выдал публичный `https://` URL

## Остановка

Остановить frontend и tunnel: `Ctrl+C` в соответствующих терминалах.

Остановить docker-сервисы:

```bash
cd /Users/alexandrmoroz/Peona-Orange-Systems-2026
make stop
```

## Типовой порядок на каждый следующий запуск

```bash
cd /Users/alexandrmoroz/Peona-Orange-Systems-2026
make dev
```

В новом терминале:

```bash
cd /Users/alexandrmoroz/Peona-Orange-Systems-2026/frontend
PYTHON_BACKEND_URL=http://127.0.0.1:8000 npm run start -- -H 0.0.0.0 -p 3000
```

В новом терминале:

```bash
ngrok http 3000
```

Если схема БД не менялась, обычно `make migrate` и `make seed` каждый раз не нужны.
