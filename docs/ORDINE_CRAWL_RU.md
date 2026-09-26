# Сбор приказов DGETS

Источник `chisinau-education-ordine` начинает обход с
`https://chisinauedu.dgets.md/ordine`. Область `path_prefix` включает страницы
раздела и ссылки на документы того же домена. Приказы и приложения доступны
как PDF; страницы каталога содержат пагинацию.

```bash
.venv/bin/civic-parser crawl \
  --source-id chisinau-education-ordine \
  --max-pages-per-source 200 \
  --depth 5
.venv/bin/civic-parser validate-corpus
.venv/bin/civic-parser export-rag
```

Лимит относится к 200 запланированным адресам контента (HTML и вложения вместе),
а не к числу листов PDF. Ошибки загрузки тоже расходуют лимит; robots.txt и
sitemap являются служебными запросами и в него не входят. PDF обрабатываются
Docling с OCR, при ошибке используется текстовый слой через pypdf.

Результаты сохраняются существующим конвейером:

- `data/raw/chisinau-education-ordine/`: исходные файлы и HTTP-метаданные;
- `data/interim/`: извлечённый текст и нормализованные записи;
- `data/processed/documents/`: Markdown и JSON с идентификаторами версий;
- `data/processed/chunks/`: чанки JSONL;
- `data/processed/reports/`: отчёт обхода с количеством документов и ошибками;
- `data/exports/rag/`: новый файловый экспорт всего корпуса после дедупликации.

Существующий код разделяет сбор (Scrapy), извлечение (HTML/Docling), хранение,
чанкинг и экспорт. В репозитории также есть клиент `upload-peona`, но настройка
импорта в существующую БД и вызовы её API не входят в этот запуск.
Предыдущие файловые экспорты сохраняются.
