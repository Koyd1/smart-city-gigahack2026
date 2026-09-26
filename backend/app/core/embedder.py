from __future__ import annotations

import hashlib
import logging
from time import perf_counter
from typing import Sequence

from openai import AsyncOpenAI

from app.core.usage import UsageTelemetry

LOGGER = logging.getLogger(__name__)


class Embedder:
    def __init__(self, *, api_key: str, model: str, dimensions: int) -> None:
        self._model = model
        self._dimensions = dimensions
        self._client = AsyncOpenAI(api_key=api_key) if api_key else None

    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        embeddings, _ = await self.embed_texts_with_telemetry(texts)
        return embeddings

    async def embed_texts_with_telemetry(
        self, texts: Sequence[str]
    ) -> tuple[list[list[float]], UsageTelemetry | None]:
        if not texts:
            return [], None

        if self._client is None:
            return [self._fake_embedding(text) for text in texts], None

        try:
            started = perf_counter()
            response = await self._client.embeddings.create(
                model=self._model,
                input=list(texts),
                dimensions=self._dimensions,
            )
            usage = getattr(response, "usage", None)
            telemetry = UsageTelemetry(
                operation="embedding",
                model=self._model,
                prompt_tokens=int(getattr(usage, "prompt_tokens", 0) or 0),
                completion_tokens=0,
                total_tokens=int(getattr(usage, "total_tokens", 0) or 0),
                latency_ms=int((perf_counter() - started) * 1000),
            )
            return [item.embedding for item in response.data], telemetry
        except Exception as exc:
            LOGGER.warning(
                "embedder.api_failed",
                extra={"texts_count": len(texts), "error": str(exc)},
            )
            return [self._fake_embedding(text) for text in texts], None

    def _fake_embedding(self, text: str) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        values = []
        for i in range(self._dimensions):
            byte = digest[i % len(digest)]
            values.append((byte / 255.0) * 2.0 - 1.0)
        return values
