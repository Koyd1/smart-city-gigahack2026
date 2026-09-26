from __future__ import annotations

import json
import logging
from time import perf_counter
from typing import Any

from openai import AsyncOpenAI

from app.core.usage import UsageTelemetry

LOGGER = logging.getLogger(__name__)


class HallucinationJudge:
    def __init__(self, *, api_key: str, model: str) -> None:
        self._model = model
        self._client = AsyncOpenAI(api_key=api_key) if api_key else None

    async def score(self, *, answer: str, context_blocks: list[str]) -> dict[str, Any]:
        if not answer.strip():
            return {
                "hallScore": 1.0,
                "reason": "empty_answer",
                "model": "rule-based",
                "source": "heuristic",
                "latencyMs": 0,
                "usage": None,
            }
        if not context_blocks:
            return {
                "hallScore": 0.65,
                "reason": "no_context",
                "model": "rule-based",
                "source": "heuristic",
                "latencyMs": 0,
                "usage": None,
            }
        if self._client is None:
            return {
                "hallScore": 0.35,
                "reason": "judge_not_configured",
                "model": "rule-based",
                "source": "heuristic",
                "latencyMs": 0,
                "usage": None,
            }

        try:
            context_text = "\n\n".join(context_blocks[:8])[:12000]
            started = perf_counter()
            response = await self._client.chat.completions.create(
                model=self._model,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a nuanced RAG grounding-risk judge. "
                            "Return only JSON: {\"hallScore\": float, \"reason\": string}. "
                            "hallScore must be between 0 and 1 where higher means less supported by the provided context. "
                            "Use low scores for answers that stay materially aligned with context, even if they add harmless wording, summary, or generic guidance. "
                            "Use medium scores for answers that add unsupported but low-risk specifics or stretch the context. "
                            "Use high scores only for direct contradictions, invented concrete facts, or risky unsupported instructions. "
                            "Do not over-penalize reasonable paraphrase."
                        ),
                    },
                    {"role": "system", "content": f"Context:\n{context_text}"},
                    {"role": "user", "content": f"Answer:\n{answer}"},
                ],
            )
            latency_ms = int((perf_counter() - started) * 1000)

            raw = response.choices[0].message.content if response.choices else None
            if not raw:
                return {
                    "hallScore": 0.5,
                    "reason": "empty_judge_output",
                    "model": self._model,
                    "source": "judge",
                    "latencyMs": latency_ms,
                    "usage": _usage_payload(response_usage=getattr(response, "usage", None), model=self._model),
                }

            data = json.loads(raw)
            value = float(data.get("hallScore", 0.5))
            score = max(0.0, min(1.0, value))
            reason = str(data.get("reason", "n/a"))[:500]
            return {
                "hallScore": score,
                "reason": reason,
                "model": self._model,
                "source": "judge",
                "latencyMs": latency_ms,
                "usage": _usage_payload(response_usage=getattr(response, "usage", None), model=self._model),
            }
        except Exception as exc:
            LOGGER.warning("hallucination_judge.failed", extra={"error": str(exc)})
            return {
                "hallScore": 0.5,
                "reason": "judge_error_fallback",
                "model": "rule-based",
                "source": "heuristic",
                "latencyMs": 0,
                "usage": None,
            }


def _usage_payload(*, response_usage: Any, model: str) -> dict[str, Any]:
    telemetry = UsageTelemetry(
        operation="judge",
        model=model,
        prompt_tokens=int(getattr(response_usage, "prompt_tokens", 0) or 0),
        completion_tokens=int(getattr(response_usage, "completion_tokens", 0) or 0),
        total_tokens=int(getattr(response_usage, "total_tokens", 0) or 0),
    )
    return telemetry.as_payload()


def score_hallucination(answer: str, context_blocks: list[str]) -> dict[str, Any]:
    if not answer.strip():
        return {
            "hallScore": 1.0,
            "reason": "empty_answer",
            "source": "heuristic",
        }
    if not context_blocks:
        return {
            "hallScore": 0.65,
            "reason": "no_context",
            "source": "heuristic",
        }
    return {
        "hallScore": 0.12,
        "reason": "context_present_heuristic",
        "source": "heuristic",
    }
