# Chisinau Civic Parser

CLI-тул для обхода настроенных публичных сайтов, извлечения страниц и документов и
сохранения результатов в локальный корпус. Интерфейс не нужен: сайты и лимиты задаются
одной командой в терминале.

## Установка

Нужен Python 3.11 или новее. В терминале из папки проекта выполните:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
```

После установки команда `civic-parser` будет доступна в активированном окружении.
В следующих терминалах сначала активируйте его:

```sh
source .venv/bin/activate
```

## Обход сайтов и ZIP-архив

Укажите ссылку и лимит успешных страниц. Параметр `--site` можно повторять для
нескольких сайтов:

```sh
civic-parser crawl --site https://example.org 10 --site https://another.example/news 25
```

Добавлять сайты в CSV для этого режима не нужно. Каждый сайт обходит только свой домен;
учитываются только HTTP-ответы со статусом 2xx. Лимит задаётся отдельно для каждого
сайта и должен быть от 1 до 500. Неудачные ответы и технические запросы к `robots.txt`,
sitemap и API лимит не расходуют. Если доступных страниц меньше лимита, обход закончится
после исчерпания найденных ссылок.

После завершения архив появится в `data/exports/crawl/`. В ZIP лежат извлечённые Markdown
и JSON, `chunks.jsonl`, `manifest.json` и полный отчёт `crawl-report.json`. Во время
работы CLI показывает сайты и лимиты, а в конце печатает путь к архиву.

Существующие источники из [config/sources.csv](config/sources.csv) тоже можно запускать
по ID, если нужны их специальные настройки:

```sh
civic-parser crawl --source chisinau-main:10 --source rtec:25
```

Другие варианты:

```sh
# Обойти стандартный пилот: по 20 успешных страниц на сайт
civic-parser crawl

# Обойти все включённые источники: по 5 страниц на каждый
civic-parser crawl --profile all --max-pages-per-source 5

# Ограничить глубину переходов по ссылкам (по умолчанию 2)
civic-parser crawl --site https://example.org 20 --depth 1
```

## Результаты и логи

Полные данные запуска остаются в локальном корпусе, а ZIP-файл предназначен для удобной
передачи или распаковки результатов. JSON-отчёт также создаётся отдельно в
`data/processed/reports/`.

Другие команды:

```sh
civic-parser crawl --help
civic-parser validate-config
civic-parser validate-corpus
civic-parser parse-file путь/к/документу.pdf
civic-parser export-rag
```
