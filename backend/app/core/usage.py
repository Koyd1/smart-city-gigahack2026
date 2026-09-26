from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(slots=True)
class UsageTelemetry:
    operation: str
    model: str
    provider: str = "openai"
    usage_source: str = "exact"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: int = 0
    status: str = "ok"
    error_code: str | None = None

    def as_payload(self) -> dict[str, int | str | None]:
        return asdict(self)
