from __future__ import annotations

import re
from functools import lru_cache

from lingua import Language, LanguageDetectorBuilder


@lru_cache(maxsize=1)
def _detector():
    return LanguageDetectorBuilder.from_languages(
        Language.ROMANIAN,
        Language.RUSSIAN,
        Language.ENGLISH,
    ).build()


def detect_language(text: str, declared: str | None = None) -> str:
    declared = (declared or "").lower().split("-")[0]
    if declared in {"ro", "ru"}:
        return declared

    sample = re.sub(r"https?://\S+", " ", text)
    sample = re.sub(r"[^\wăâîșțĂÂÎȘȚа-яА-ЯёЁ]+", " ", sample).strip()
    if not sample:
        return "und"
    detected = _detector().detect_language_of(sample[:20_000])
    return {
        Language.ROMANIAN: "ro",
        Language.RUSSIAN: "ru",
        Language.ENGLISH: "en",
    }.get(detected, "und")
