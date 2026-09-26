import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import settings
from app.core.logging import configure_logging, install_http_logging

configure_logging(
    log_level=settings.log_level,
    log_json=settings.log_json,
    log_to_file=settings.log_to_file,
    log_file_path=settings.log_file_path,
)
LOGGER = logging.getLogger(__name__)

app = FastAPI(title="HR Bot Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
install_http_logging(app)
app.include_router(api_router)


@app.on_event("startup")
async def on_startup() -> None:
    LOGGER.info("app.startup", extra={"service": "backend"})


@app.on_event("shutdown")
async def on_shutdown() -> None:
    LOGGER.info("app.shutdown", extra={"service": "backend"})


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "backend", "status": "ok"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
