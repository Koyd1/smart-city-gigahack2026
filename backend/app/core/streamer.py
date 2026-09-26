from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from time import perf_counter
from typing import Awaitable, Callable

from openai import AsyncOpenAI

from app.core.chat_prompt import HR_ASSISTANT_SYSTEM_PROMPT
from app.core.usage import UsageTelemetry

LOGGER = logging.getLogger(__name__)


def encode_sse(payload: dict) -> bytes:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


@dataclass(slots=True)
class Source:
    """Source information for context blocks."""
    file_id: str
    content: str
    filename: str | None = None


class ChatStreamer:
    def __init__(self, *, api_key: str, model: str, fallback_models: list[str] | None = None) -> None:
        self._model = model
        self._fallback_models = fallback_models or []
        self._client = AsyncOpenAI(api_key=api_key) if api_key else None

    def _format_context_blocks(self, sources: list[Source]) -> str:
        """Format sources as numbered context blocks with document names."""
        blocks = []
        for i, source in enumerate(sources, 1):
            filename = source.filename or "unknown"
            block = f"[S{i}] Document: {filename}\nContent: {source.content}"
            blocks.append(block)
        return "\n\n".join(blocks)

    async def stream_answer(
        self,
        *,
        user_message: str,
        sources: list[Source],
        usage_callback: Callable[[UsageTelemetry], Awaitable[None] | None] | None = None,
    ) -> AsyncIterator[str]:
        if self._client is None:
            async for token in self._fallback_tokens(user_message, sources):
                yield token
            return

        context_text = self._format_context_blocks(sources) if sources else "No context provided."

        model_candidates = [self._model, *self._fallback_models]

        deduped_models: list[str] = []
        for candidate in model_candidates:
            if candidate and candidate not in deduped_models:
                deduped_models.append(candidate)

        last_error: Exception | None = None

        try:
            for model_name in deduped_models:
                try:
                    started = perf_counter()
                    final_usage: UsageTelemetry | None = None

                    stream = await self._client.chat.completions.create(
                        model=model_name,
                        stream=True,
                        stream_options={"include_usage": True},
                        temperature=0.2,
                        messages=[
                            {"role": "system", "content": HR_ASSISTANT_SYSTEM_PROMPT},
                            {"role": "system", "content": f"Context:\n{context_text}"},
                            {"role": "user", "content": user_message},
                        ],
                    )

                    async for chunk in stream:
                        if getattr(chunk, "usage", None) is not None:
                            usage = chunk.usage
                            final_usage = UsageTelemetry(
                                operation="chat",
                                model=model_name,
                                prompt_tokens=int(getattr(usage, "prompt_tokens", 0) or 0),
                                completion_tokens=int(getattr(usage, "completion_tokens", 0) or 0),
                                total_tokens=int(getattr(usage, "total_tokens", 0) or 0),
                                latency_ms=int((perf_counter() - started) * 1000),
                            )
                        delta = chunk.choices[0].delta.content if chunk.choices else None
                        if delta:
                            yield delta

                    if final_usage is not None and usage_callback is not None:
                        maybe_awaitable = usage_callback(final_usage)
                        if maybe_awaitable is not None:
                            await maybe_awaitable

                    return

                except Exception as exc:
                    last_error = exc
                    LOGGER.warning(
                        "chat_streamer.model_failed",
                        extra={"model": model_name, "error": str(exc)},
                    )

        except Exception as exc:
            last_error = exc

        if last_error is not None:
            LOGGER.error("chat_streamer.all_models_failed", extra={"error": str(last_error)})

            async for token in self._fallback_tokens(user_message, sources):
                yield token

    def _fallback_answer(self, user_message: str, sources: list[Source]) -> str:
        return (
            "Сейчас не удалось сгенерировать ответ моделью. "
            "Попробуйте повторить запрос позже. "
            f"Ваш запрос: {user_message}"
        )

    async def _fallback_tokens(
        self,
        user_message: str,
        sources: list[Source],
    ) -> AsyncIterator[str]:

        fallback = self._fallback_answer(user_message, sources)

        for token in fallback.split(" "):
            yield f"{token} "
    
