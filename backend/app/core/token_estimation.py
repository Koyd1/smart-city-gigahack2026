from __future__ import annotations

import json
from typing import Any

import tiktoken

from app.core.chat_prompt import HR_ASSISTANT_SYSTEM_PROMPT


def _encoding_for_model(model: str):
    try:
        return tiktoken.encoding_for_model(model)
    except KeyError:
        return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str, *, model: str) -> int:
    if not text:
        return 0
    encoding = _encoding_for_model(model)
    return len(encoding.encode(text))


def estimate_legacy_chat_usage(
    *,
    model: str,
    user_message: str,
    assistant_message: str,
    sources: Any,
) -> dict[str, int]:
    source_snippets = []
    items: list[Any]

    if isinstance(sources, str):
        try:
            parsed = json.loads(sources)
            items = parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            items = []
    elif isinstance(sources, list):
        items = sources
    else:
        items = []

    for item in items:
        if not isinstance(item, dict):
            continue
        snippet = item.get("snippet")
        if isinstance(snippet, str) and snippet.strip():
            source_snippets.append(snippet.strip())

    prompt_parts = [HR_ASSISTANT_SYSTEM_PROMPT, user_message.strip(), *source_snippets]
    prompt_tokens = count_tokens("\n\n".join(part for part in prompt_parts if part), model=model)
    completion_tokens = count_tokens(assistant_message.strip(), model=model)
    total_tokens = prompt_tokens + completion_tokens

    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
    }
