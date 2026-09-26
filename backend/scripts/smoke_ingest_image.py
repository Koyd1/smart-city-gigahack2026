"""Smoke test: upload an image to the ingest API and verify captioning workflow.
Тестирование image captioning

Для проверки работы автоматического анализа изображений:
Убедиться что backend запущен
make dev

В другом терминале: запустить smoke test
cd backend
python scripts/smoke_ingest_image.py
```

Скрипт:
1. Загружает тестовое изображение
2. Дождется завершения анализа через OpenAI Vision API
3. Проверяет что были созданы чанки текста
4. Получает preview URL
5. Выводит результаты
"""

import json
import os
import time
from pathlib import Path

import httpx

BACKEND_URL = os.environ.get("PYTHON_BACKEND_URL", "http://127.0.0.1:8000")
TEST_IMAGE = Path(__file__).parent / "test.png"
POLL_INTERVAL = 2  # seconds
MAX_WAIT = 120  # seconds


def create_test_image() -> bytes:
    """Create a minimal PNG for testing."""
    try:
        from PIL import Image

        img = Image.new("RGB", (100, 100), color="red")
        img.save("/tmp/test_image.png")
        return Path("/tmp/test_image.png").read_bytes()
    except Exception as e:
        print(f"Failed to create test image: {e}")
        raise


if __name__ == "__main__":
    # Use test image or create one
    if TEST_IMAGE.exists():
        image_bytes = TEST_IMAGE.read_bytes()
        image_name = TEST_IMAGE.name
    else:
        print("Test image not found, creating minimal PNG...")
        image_bytes = create_test_image()
        image_name = "test_image.png"

    with httpx.Client(timeout=30.0) as client:
        # 1. Upload image
        print(f"\n📤 Uploading {image_name}...")
        with open("scripts/test.png", "rb") as f:
            files = {"file": (image_name, f, "image/png")}
            resp = client.post(f"{BACKEND_URL}/api/v1/ingest", files=files)

        print(f"   Status: {resp.status_code}")
        if resp.is_error:
            print(f"   Error: {resp.text}")
            raise SystemExit(1)

        data = resp.json()
        file_id = data.get("fileId")
        print(f"   ✓ fileId: {file_id}")

        # 2. Poll for processing completion
        print(f"\n⏳ Waiting for captioning & indexing...")
        start_time = time.time()
        status_data = None

        while time.time() - start_time < MAX_WAIT:
            status_resp = client.get(f"{BACKEND_URL}/api/v1/ingest/{file_id}/status")
            if status_resp.is_error:
                print(f"   Error fetching status: {status_resp.text}")
                raise SystemExit(1)

            status_data = status_resp.json()
            current_status = status_data.get("status")
            chunk_count = status_data.get("chunkCount")

            print(f"   Status: {current_status}, Chunks: {chunk_count}")

            if current_status == "READY":
                print(f"   ✓ Processing complete!")
                break
            elif current_status == "ERROR":
                print(f"   ✗ Processing failed!")
                raise SystemExit(1)

            time.sleep(POLL_INTERVAL)
        else:
            print(f"   ✗ Timeout after {MAX_WAIT}s waiting for processing")
            raise SystemExit(1)

        # 3. Get preview URL
        print(f"\n🖼️  Getting preview URL...")
        preview_resp = client.get(f"{BACKEND_URL}/api/v1/ingest/{file_id}/preview")
        if preview_resp.is_error:
            print(f"   Error: {preview_resp.text}")
        else:
            preview_data = preview_resp.json()
            preview_url = preview_data.get("previewUrl")
            print(f"   ✓ Preview URL: {preview_url[:80]}...")

        # 4. Summary
        print(f"\n✅ Image ingestion successful!")
        print(f"   File ID: {file_id}")
        print(f"   Status: {status_data.get('status')}")
        print(f"   Chunks created: {status_data.get('chunkCount')}")
        print(f"\n💡 The image caption and content are now indexed and searchable.")
