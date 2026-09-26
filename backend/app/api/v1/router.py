from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.chat import router as chat_router
from app.api.v1.evaluate import router as evaluate_router
from app.api.v1.health import router as health_router
from app.api.v1.ingest import router as ingest_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(ingest_router)
api_router.include_router(chat_router)
api_router.include_router(health_router)
api_router.include_router(evaluate_router)
