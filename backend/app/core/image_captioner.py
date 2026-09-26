"""Image captioning using OpenAI Vision API (gpt-4o)."""

from __future__ import annotations

import base64
import logging
from io import BytesIO
from pathlib import Path

from openai import OpenAI

LOGGER = logging.getLogger(__name__)

VISION_SYSTEM_PROMPT = """You are an expert document analyzer specialized in extracting structured information from images for indexing and retrieval.

Your primary goal is to convert visual content into a clear, text-based representation of the underlying data.

When analyzing an image:

1. Extract ALL visible text exactly as it appears (preserve important formatting when relevant).
2. If the image contains diagrams, charts,  tables, or grouped visual elements:
   - DO NOT describe how they look.
   - INSTEAD, interpret them as structured data and relationships.
   - Convert visual groupings into explicit textual relationships.

3. For visual structures:
   - Translate categories, labels, and groupings into sentences.
   - Example:
     If a diagram shows a category "Fruits" connected to "apples", "pears", "bananas",
     interpret it as:
     "The category 'Fruits' includes: apples, pears, bananas."

4. For tables:
   - Convert them into readable structured text (key-value or row-based format).
   - Preserve all data relationships.

5. For charts (bar, pie, line, etc.):
   - Extract the actual meaning of the data (comparisons, trends, proportions).
   - Use values and labels from the image.
   - Avoid describing visual aspects (colors, shapes) unless they define meaning.

6. Describe layout ONLY if it helps understand relationships between data.

Output requirements:
- Focus on DATA and MEANING, not visual appearance.
- Use clear, structured natural language.
- Preserve original wording from the image where possible.
- Make the result suitable for search, indexing, and retrieval.

Avoid:
- Purely visual descriptions (e.g., "a red box on the left")
- Vague summaries without data
- Ignoring relationships between elements

Your output should read as a structured textual representation of the information contained in the image."""

VISION_USER_PROMPT = "Extract and interpret all information from this image as structured textual data. Focus on meaning and relationships, not visual description."

class ImageCaptioner:
    def __init__(self, api_key: str, model: str = "gpt-4o") -> None:
        self._client = OpenAI(api_key=api_key)
        self._model = model

    async def generate_caption(self, image_bytes: bytes) -> str:
        # Determine image format from bytes
        image_format = self._detect_image_format(image_bytes)
        if not image_format:
            raise ValueError("Unable to detect image format")

        # Encode image to base64
        base64_image = base64.standard_b64encode(image_bytes).decode("utf-8")
        media_type = f"image/{image_format.lower()}"

        try:
            response = self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {
                        "role": "system",
                        "content": VISION_SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{media_type};base64,{base64_image}",
                                },
                            },
                            {
                                "type": "text",
                                "text": VISION_USER_PROMPT,
                            },
                        ],
                    },
                ],
                max_tokens=2000,
                temperature=0.7,
            )

            caption = response.choices[0].message.content
            if not caption:
                raise ValueError("Empty response from vision API")

            LOGGER.info("image_caption.generated", extra={"tokens_used": response.usage.total_tokens})
            return caption

        except Exception as exc:
            LOGGER.exception("image_caption.generation_failed", extra={"error": str(exc)})
            raise ValueError(f"Failed to generate image caption: {exc}") from exc

    @staticmethod
    def _detect_image_format(image_bytes: bytes) -> str | None:

        if len(image_bytes) < 12:
            return None

        # PNG: 89 50 4E 47
        if image_bytes.startswith(b"\x89PNG"):
            return "png"

        # JPEG: FF D8 FF
        if image_bytes.startswith(b"\xff\xd8\xff"):
            return "jpg"

        # WebP: RIFF ... WEBP
        if image_bytes.startswith(b"RIFF") and b"WEBP" in image_bytes[:12]:
            return "webp"

        return None
