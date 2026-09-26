from __future__ import annotations

import json
from dataclasses import dataclass


@dataclass(slots=True)
class ModelPricing:
    input_per_million: float
    output_per_million: float


def parse_model_pricing(raw: str) -> dict[str, ModelPricing]:
    if not raw.strip():
        return {}

    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        return {}

    pricing: dict[str, ModelPricing] = {}
    for model, value in parsed.items():
        if not isinstance(model, str) or not isinstance(value, dict):
            continue
        input_rate = value.get("input")
        output_rate = value.get("output", input_rate)
        if input_rate is None:
            continue
        try:
            pricing[model] = ModelPricing(
                input_per_million=float(input_rate),
                output_per_million=float(output_rate if output_rate is not None else input_rate),
            )
        except (TypeError, ValueError):
            continue

    return pricing


def calculate_costs(
    pricing: dict[str, ModelPricing],
    *,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> dict[str, float | None]:
    rate = pricing.get(model)
    if rate is None:
        return {
            "cost_input_usd": None,
            "cost_output_usd": None,
            "cost_total_usd": None,
        }

    input_cost = (prompt_tokens / 1_000_000) * rate.input_per_million
    output_cost = (completion_tokens / 1_000_000) * rate.output_per_million
    total_cost = input_cost + output_cost

    return {
        "cost_input_usd": round(input_cost, 8),
        "cost_output_usd": round(output_cost, 8),
        "cost_total_usd": round(total_cost, 8),
    }
