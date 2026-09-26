from __future__ import annotations

import asyncio
import logging
import mimetypes
import re
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from PIL import Image
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.rag_pipeline import SUPPORTED_EXTENSIONS, SUPPORTED_IMAGE_EXTENSIONS
from app.db.models import KnowledgeFile, VectorChunk
from app.deps import get_db, ingest_pipeline, storage

router = APIRouter(prefix="/ingest", tags=["ingest"])
LOGGER = logging.getLogger(__name__)

MAX_BYTES = settings.ingest_max_file_size_mb * 1024 * 1024
MAX_IMAGE_BYTES = settings.ingest_image_max_file_size_mb * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {t.strip() for t in settings.ingest_allowed_image_mime_types.split(",") if t.strip()}


def _sanitize_filename(filename: str) -> str:
    name = Path(filename).name
    if not name:
        name = "file"
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    if safe_name.strip(".") == "":
        safe_name = "file"
    if safe_name.startswith("."):
        safe_name = f"file{safe_name}"
    return safe_name


def _guess_mime_type(filename: str, explicit: str | None) -> str:
    if explicit:
        return explicit
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


@router.get("")
async def list_ingested_files(db: AsyncSession = Depends(get_db)) -> dict[str, list[dict[str, str | int | None]]]:
    result = await db.scalars(
        select(KnowledgeFile).order_by(KnowledgeFile.created_at.desc()).limit(200)
    )
    files = list(result)

    return {
        "items": [
            {
                "id": file.id,
                "filename": file.filename,
                "size": file.size,
                "status": file.status,
                "chunkCount": file.chunk_count,
                "createdAt": file.created_at.isoformat(),
                "updatedAt": file.updated_at.isoformat(),
            }
            for file in files
        ]
    }


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_ingest_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    filename = _sanitize_filename(file.filename or "upload.bin")
    extension = Path(filename).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        LOGGER.warning("ingest.unsupported_extension", extra={"file_name": filename, "extension": extension})
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {extension}")

    mime_type = _guess_mime_type(filename, file.content_type)

    # Image validation
    image_meta: dict[str, Any] | None = None
    if extension in SUPPORTED_IMAGE_EXTENSIONS:
        if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise HTTPException(status_code=415, detail=f"Unsupported image MIME type: {mime_type}")

    payload = await file.read()
    if not payload:
        LOGGER.warning("ingest.empty_file", extra={"file_name": filename})
        raise HTTPException(status_code=400, detail="File is empty")

    if len(payload) > MAX_BYTES:
        LOGGER.warning(
            "ingest.file_too_large",
            extra={"file_name": filename, "size_bytes": len(payload), "max_bytes": MAX_BYTES},
        )
        raise HTTPException(status_code=413, detail=f"File is too large (max {MAX_BYTES} bytes)")

    if extension in SUPPORTED_IMAGE_EXTENSIONS and len(payload) > MAX_IMAGE_BYTES:
        LOGGER.warning(
            "ingest.image_too_large",
            extra={"file_name": filename, "size_bytes": len(payload), "max_bytes": MAX_IMAGE_BYTES},
        )
        raise HTTPException(status_code=413, detail=f"Image is too large (max {MAX_IMAGE_BYTES/1024/1024:.2f} MB)")

    file_id = str(uuid4())
    object_key = f"knowledge/{file_id}/{filename}"

    try:
        # Store original bytes in object storage (MinIO)
        await asyncio.to_thread(
            storage.upload_bytes,
            object_name=object_key,
            content=payload,
            content_type=mime_type,
        )
    except Exception as exc:
        LOGGER.exception("ingest.storage_error", extra={"file_name": filename, "error": str(exc)})
        raise HTTPException(status_code=502, detail="Failed to store file in object storage")

    entity = KnowledgeFile(
        id=file_id,
        filename=filename,
        mime_type=mime_type,
        size=len(payload),
        storage_path=object_key,
        binary_content=None,
        status="PENDING",
        uploaded_by="system",
    )

    db.add(entity)
    await db.commit()

    background_tasks.add_task(ingest_pipeline.run, file_id)
    LOGGER.info(
        "ingest.job_created",
        extra={"file_id": file_id, "file_name": filename, "size_bytes": len(payload)},
    )

    return {"fileId": file_id, "status": "PENDING"}


@router.post("/{file_id}/reindex", status_code=status.HTTP_202_ACCEPTED)
async def reindex_knowledge_file(
    file_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    file = await db.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    if file is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    file.status = "PENDING"
    file.chunk_count = None
    await db.commit()

    background_tasks.add_task(ingest_pipeline.run, file_id)
    LOGGER.info("ingest.reindex_requested", extra={"file_id": file_id, "file_name": file.filename})
    return {"fileId": file.id, "status": file.status}


@router.get("/{file_id}/status")
async def get_ingest_status(file_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, str | int | None]:
    file = await db.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    if file is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    return {
        "fileId": file.id,
        "status": file.status,
        "chunkCount": file.chunk_count,
        "updatedAt": file.updated_at.isoformat(),
    }


@router.get("/{file_id}/preview")
async def get_ingest_preview_url(file_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    file = await db.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    if file is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    try:
        url = await asyncio.to_thread(
            storage.generate_presigned_url,
            file.storage_path,
            settings.image_preview_expires_seconds,
        )
    except Exception as exc:
        LOGGER.exception("ingest.preview_url_failed", extra={"file_id": file_id, "error": str(exc)})
        raise HTTPException(status_code=502, detail="Failed to generate preview URL")

    return {"previewUrl": url}


@router.get("/{file_id}/download")
async def download_knowledge_file(file_id: str, db: AsyncSession = Depends(get_db)) -> Response:
    file = await db.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    if file is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    blob = file.binary_content
    if blob is None:
        try:
            blob = await asyncio.to_thread(storage.download_bytes, file.storage_path)
        except Exception:
            raise HTTPException(status_code=404, detail="File content not found")

        file.binary_content = blob
        await db.commit()

    ascii_fallback = file.filename.encode("ascii", errors="ignore").decode("ascii").strip()
    if not ascii_fallback or ascii_fallback.startswith("."):
        suffix = Path(file.filename).suffix or ".bin"
        ascii_fallback = f"download{suffix}"
    safe_fallback = ascii_fallback.replace('"', "_").replace("\\", "_")
    content_disposition = (
        f'attachment; filename="{safe_fallback}"; filename*=UTF-8\'\'{quote(file.filename)}'
    )

    return Response(
        content=blob,
        media_type=file.mime_type or "application/octet-stream",
        headers={"content-disposition": content_disposition},
    )


@router.delete("/{file_id}")
async def delete_knowledge_file(file_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    file = await db.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    if file is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    # Delete file chunks from database
    await db.execute(delete(VectorChunk).where(VectorChunk.file_id == file_id))

    # Delete object from storage (if exists)
    try:
        await asyncio.to_thread(storage.delete_object, file.storage_path)
    except Exception:
        LOGGER.warning(
            "ingest.storage_delete_failed",
            extra={"file_id": file_id, "file_name": file.filename, "storage_path": file.storage_path},
        )

    # Delete file record from database (including binary content)
    await db.delete(file)
    await db.commit()
    LOGGER.info("ingest.deleted", extra={"file_id": file_id, "file_name": file.filename})

    return {"ok": True}
