from __future__ import annotations

import contextvars
import json
import logging
from pathlib import Path
import sys
import time
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from starlette.responses import Response

LOGGER = logging.getLogger(__name__)
REQUEST_ID_CTX: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

_RESERVED_RECORD_FIELDS = set(
    logging.LogRecord(
        name="",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="",
        args=(),
        exc_info=None,
    ).__dict__.keys()
) | {"asctime", "message", "request_id"}


def _to_log_value(value: Any) -> str:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return str(value)
    return json.dumps(value, ensure_ascii=False, default=str)


def _extra_fields(record: logging.LogRecord) -> dict[str, Any]:
    return {
        key: value
        for key, value in record.__dict__.items()
        if key not in _RESERVED_RECORD_FIELDS and not key.startswith("_")
    }


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = REQUEST_ID_CTX.get("-")
        return True


class PlainFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.now(timezone.utc).isoformat()
        message = (
            f"{timestamp} level={record.levelname} logger={record.name} "
            f"request_id={getattr(record, 'request_id', '-')} msg={record.getMessage()}"
        )
        extras = _extra_fields(record)
        if extras:
            extra_line = " ".join(f"{key}={_to_log_value(value)}" for key, value in extras.items())
            message = f"{message} {extra_line}"
        if record.exc_info:
            message = f"{message}\n{self.formatException(record.exc_info)}"
        return message


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        payload.update(_extra_fields(record))
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(
    *,
    log_level: str = "INFO",
    log_json: bool = False,
    log_to_file: bool = False,
    log_file_path: str = "logs/backend.log",
) -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)
    formatter = JsonFormatter() if log_json else PlainFormatter()
    handlers: list[logging.Handler] = []

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.addFilter(RequestContextFilter())
    stream_handler.setFormatter(formatter)
    handlers.append(stream_handler)

    file_error: str | None = None
    if log_to_file:
        try:
            file_path = Path(log_file_path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = logging.FileHandler(file_path, encoding="utf-8")
            file_handler.addFilter(RequestContextFilter())
            file_handler.setFormatter(formatter)
            handlers.append(file_handler)
        except Exception as exc:
            file_error = str(exc)

    root_logger = logging.getLogger()
    root_logger.handlers = handlers
    root_logger.setLevel(level)

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.setLevel(level)
        logger.propagate = True

    logging.captureWarnings(True)

    if log_to_file and file_error:
        root_logger.warning(
            "logging.file_handler_failed",
            extra={"path": log_file_path, "error": file_error},
        )
    elif log_to_file:
        root_logger.info("logging.file_handler_enabled", extra={"path": log_file_path})


def install_http_logging(app: FastAPI) -> None:
    @app.middleware("http")
    async def _http_logging_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid4())
        token = REQUEST_ID_CTX.set(request_id)
        started = time.perf_counter()
        client_ip = request.client.host if request.client else "-"
        path = request.url.path
        query = request.url.query

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = int((time.perf_counter() - started) * 1000)
            LOGGER.exception(
                "http.request",
                extra={
                    "method": request.method,
                    "path": path,
                    "query": query,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                },
            )
            raise
        else:
            duration_ms = int((time.perf_counter() - started) * 1000)
            LOGGER.info(
                "http.request",
                extra={
                    "method": request.method,
                    "path": path,
                    "query": query,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                },
            )
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            REQUEST_ID_CTX.reset(token)
