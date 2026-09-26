from __future__ import annotations

import os
from logging.config import fileConfig
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from alembic import context
from sqlalchemy import create_engine, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _normalize_database_url(url: str) -> str:
    normalized = url

    if normalized.startswith("postgresql+asyncpg://"):
        normalized = normalized.replace(
            "postgresql+asyncpg://",
            "postgresql+psycopg://",
            1,
        )

    parsed = urlparse(normalized)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))

    if "ssl" in query and "sslmode" not in query:
        query["sslmode"] = query.pop("ssl")

    rebuilt = parsed._replace(query=urlencode(query))
    return urlunparse(rebuilt)


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set for Alembic")

    return _normalize_database_url(url)


def run_migrations_offline() -> None:
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=None,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(get_database_url(), poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=None, compare_type=True)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
