# Инструкция по запуску парсера

Все команды выполняются из корня репозитория:

```bash
cd /Users/alexandrmoroz/Desktop/smart-city-gagahack2026
```

## 1. Установка

Нужен Python 3.11 или новее. Зависимости устанавливаются в локальную `.venv`:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
```

При первом разборе PDF Docling скачает локальные модели. Последующие запуски
используют кеш. Для публичных сайтов API-ключи не нужны.

В новом окне терминала сначала активируйте окружение:

```bash
source .venv/bin/activate
```

## 2. Конфигурация источников

Основной реестр находится в `config/sources.csv`.

Поля:

- `source_id` - стабильное имя источника;
- `category` - категория документов;
- `url` - стартовая страница;
- `crawl_scope` - `same_domain` или `path_prefix`;
- `enabled` - участвует ли источник в обходе.

Три источника пилота перечислены в `config/pilot_sources.txt`.

Проверка конфигурации:

```bash
civic-parser validate-config
```

## 3. Запуск парсинга сайтов

Стандартный пилот, до 20 страниц на источник и глубина до 2:

```bash
./scripts/parse_pilot.sh
```

Короткая проверка на небольшом количестве страниц:

```bash
civic-parser crawl \
  --profile pilot \
  --depth 1 \
  --max-pages-per-source 3
```

Один конкретный источник:

```bash
civic-parser crawl \
  --source-id chisinau-projects \
  --depth 2 \
  --max-pages-per-source 50
```

Несколько конкретных источников:

```bash
civic-parser crawl \
  --source-id chisinau-projects \
  --source-id agsv-tree-works \
  --depth 2 \
  --max-pages-per-source 50
```

Все включённые источники:

```bash
civic-parser crawl \
  --profile all \
  --depth 2 \
  --max-pages-per-source 100
```

Полный запуск делайте только после проверки пилота: 42 домена могут иметь разные
правила, структуру, объём и ограничения `robots.txt`.

## 4. Разбор локального файла

PDF или DOCX можно обработать без crawler:

```bash
civic-parser parse-file docs/reference/List_of_Data_Sources.pdf \
  --source-id annex-1 \
  --category reference
```

Если файл был скачан с официального сайта, передайте исходный URL:

```bash
civic-parser parse-file path/to/document.pdf \
  --source-id chisinau-document \
  --category transparency_projects \
  --source-url 'https://example.md/document.pdf'
```

## 5. Проверка результата

После crawl или разбора файлов выполните:

```bash
civic-parser validate-corpus
```

Команда проверяет JSON Schema, наличие Markdown, каждый JSONL-фрагмент и показывает
группы документов с одинаковым содержимым. Успешный результат заканчивается строкой:

```text
status=valid
```

Тесты и статический анализ кода:

```bash
pytest -q
ruff check .
```

## 6. Подготовка файлов для RAG

После успешной валидации создайте отдельный чистый пакет:

```bash
civic-parser export-rag
```

По умолчанию команда:

- исключает документы категории `reference`;
- удаляет точные дубликаты по `content_sha256`;
- не добавляет оригинальные PDF/HTML и служебные отчёты;
- создаёт новую версию экспорта и не удаляет предыдущую.

Команда выводит путь вида:

```text
export=data/exports/rag/export-YYYYMMDDTHHMMSSZ
```

Последний путь также записывается в:

```text
data/exports/rag/latest.json
```

### Если RAG сам разбивает документы

Загрузите только все `.md` из:

```text
data/exports/rag/<export-id>/documents/
```

Это наиболее универсальный вариант для готовых RAG-сервисов и чатов с загрузкой
файлов.

### Если RAG принимает готовые chunks и metadata

Импортируйте один файл:

```text
data/exports/rag/<export-id>/chunks.jsonl
```

Каждая строка содержит текст, язык, категорию, исходный URL, `document_id`,
`version_id`, `chunk_id`, заголовки и номера страниц.

Не загружайте одновременно Markdown и `chunks.jsonl` в один корпус: это создаст
дубликаты текста.

Перед загрузкой посмотрите:

```text
data/exports/rag/<export-id>/manifest.json
```

Manifest содержит список включённых документов, исключения и удалённые дубликаты.

Для специального корпуса, куда действительно нужны внутренние reference-документы:

```bash
civic-parser export-rag --include-reference
```

Для диагностического экспорта без удаления дубликатов:

```bash
civic-parser export-rag --keep-duplicates
```

## 7. Загрузка в Peona

Peona принимает документы по одному через `POST /api/v1/ingest`. Поэтому итоговый
пакет — это не один огромный файл, а отдельный `.md` на каждую страницу или
официальный документ. Так RAG точнее разделяет источники и показывает понятные
имена файлов в ссылках.

Сначала обязательно создайте свежий экспорт:

```bash
civic-parser validate-corpus
civic-parser export-rag
```

Проверить, какие файлы будут отправлены, без подключения к платформе:

```bash
civic-parser upload-peona --dry-run
```

Если backend Peona запущен локально на стандартном порту:

```bash
civic-parser upload-peona --api-url http://localhost:8000
```

Для удалённого backend:

```bash
export PEONA_API_URL='https://backend.example.com'
civic-parser upload-peona
```

Если на API настроен Bearer-токен:

```bash
export PEONA_API_TOKEN='ваш-токен'
civic-parser upload-peona
```

Команда пропускает уже существующие файлы с тем же именем, загружает новые и
ждёт статуса `READY`. Детальный отчёт сохраняется рядом с экспортом:

```text
data/exports/rag/<export-id>/peona-upload-<timestamp>.json
```

Чтобы только поставить файлы в очередь, не ожидая индексации:

```bash
civic-parser upload-peona --api-url http://localhost:8000 --no-wait
```

## 8. Что находится в каталогах

| Каталог | Назначение | Загружать в RAG |
|---|---|---|
| `data/raw/` | Точные скачанные HTML/PDF/DOCX и HTTP metadata | Нет |
| `data/interim/extracted/` | Прямое извлечение и полный Docling JSON | Нет |
| `data/interim/normalized/` | Нормализованные внутренние записи | Нет |
| `data/processed/documents/` | Полный корпус, включая reference | Не целиком |
| `data/processed/chunks/` | Полный JSONL, включая reference и дубликаты | Не напрямую |
| `data/processed/reports/` | Отчёты crawl и ошибки | Нет |
| `data/exports/rag/` | Очищенные пакеты для загрузки | Да |

## 9. Обычный рабочий цикл

```bash
source .venv/bin/activate
./scripts/parse_pilot.sh
civic-parser validate-corpus
civic-parser export-rag
cat data/exports/rag/latest.json
civic-parser upload-peona --api-url http://localhost:8000
```

Для Peona используйте команду `upload-peona`: она отправляет все файлы из
`documents/`. Для другой RAG-платформы загрузите либо каталог `documents/`, либо
`chunks.jsonl` из указанного экспорта.
