from __future__ import annotations

import logging
import mimetypes
import re
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from app.config import settings
from app.core.rag_pipeline import SUPPORTED_EXTENSIONS, SUPPORTED_IMAGE_EXTENSIONS
from app.db.models import KnowledgeFile, VectorChunk
from app.deps import get_db
from app.queue import IngestQueueUnavailable, enqueue_ingest

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
        select(KnowledgeFile)
        .options(
            load_only(
                KnowledgeFile.id,
                KnowledgeFile.filename,
                KnowledgeFile.size,
                KnowledgeFile.status,
                KnowledgeFile.chunk_count,
                KnowledgeFile.created_at,
                KnowledgeFile.updated_at,
                KnowledgeFile.ingest_attempts,
                KnowledgeFile.ingest_error,
            )
        )
        .order_by(KnowledgeFile.created_at.desc())
        .limit(200)
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
                "ingestAttempts": file.ingest_attempts,
                "ingestError": file.ingest_error,
            }
            for file in files
        ]
    }


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_ingest_job(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    filename = _sanitize_filename(file.filename or "upload.bin")
    extension = Path(filename).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        LOGGER.warning("ingest.unsupported_extension", extra={"file_name": filename, "extension": extension})
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {extension}")

    mime_type = _guess_mime_type(filename, file.content_type)

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
    entity = KnowledgeFile(
        id=file_id,
        filename=filename,
        mime_type=mime_type,
        size=len(payload),
        binary_content=payload,
        status="PENDING",
        uploaded_by="system",
    )

    db.add(entity)
    await db.commit()

    try:
        await enqueue_ingest(file_id)
    except IngestQueueUnavailable as exc:
        entity.status = "ERROR"
        entity.ingest_error = str(exc)
        await db.commit()
        raise HTTPException(status_code=503, detail="Document was saved but indexing queue is unavailable") from exc
    LOGGER.info(
        "ingest.job_created",
        extra={"file_id": file_id, "file_name": filename, "size_bytes": len(payload)},
    )

    return {"fileId": file_id, "status": "PENDING"}


@router.post("/{file_id}/reindex", status_code=status.HTTP_202_ACCEPTED)
async def reindex_knowledge_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    file = await db.scalar(
        select(KnowledgeFile)
        .options(
            load_only(
                KnowledgeFile.id,
                KnowledgeFile.filename,
                KnowledgeFile.status,
                KnowledgeFile.chunk_count,
            )
        )
        .where(KnowledgeFile.id == file_id)
    )
    if file is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    file.status = "PENDING"
    file.chunk_count = None
    file.ingest_error = None
    await db.commit()

    try:
        await enqueue_ingest(file_id)
    except IngestQueueUnavailable as exc:
        file.status = "ERROR"
        file.ingest_error = str(exc)
        await db.commit()
        raise HTTPException(status_code=503, detail="Indexing queue is unavailable") from exc
    LOGGER.info("ingest.reindex_requested", extra={"file_id": file_id, "file_name": file.filename})
    return {"fileId": file.id, "status": file.status}


@router.get("/{file_id}/status")
async def get_ingest_status(file_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, str | int | None]:
    file = await db.scalar(
        select(KnowledgeFile)
        .options(
            load_only(
                KnowledgeFile.id,
                KnowledgeFile.status,
                KnowledgeFile.chunk_count,
                KnowledgeFile.updated_at,
                KnowledgeFile.ingest_attempts,
                KnowledgeFile.ingest_error,
            )
        )
        .where(KnowledgeFile.id == file_id)
    )
    if file is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    return {
        "fileId": file.id,
        "status": file.status,
        "chunkCount": file.chunk_count,
        "updatedAt": file.updated_at.isoformat(),
        "ingestAttempts": file.ingest_attempts,
        "ingestError": file.ingest_error,
    }


@router.get("/{file_id}/preview")
async def preview_knowledge_file(file_id: str, db: AsyncSession = Depends(get_db)) -> Response:
    file = await db.scalar(
        select(KnowledgeFile)
        .options(
            load_only(
                KnowledgeFile.id,
                KnowledgeFile.filename,
                KnowledgeFile.mime_type,
                KnowledgeFile.binary_content,
            )
        )
        .where(KnowledgeFile.id == file_id)
    )
    if file is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    return Response(
        content=file.binary_content,
        media_type=file.mime_type or "application/octet-stream",
        headers={"content-disposition": f"inline; filename*=UTF-8''{quote(file.filename)}"},
    )


@router.get("/{file_id}/download")
async def download_knowledge_file(file_id: str, db: AsyncSession = Depends(get_db)) -> Response:
    file = await db.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
    if file is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    ascii_fallback = file.filename.encode("ascii", errors="ignore").decode("ascii").strip()
    if not ascii_fallback or ascii_fallback.startswith("."):
        suffix = Path(file.filename).suffix or ".bin"
        ascii_fallback = f"download{suffix}"
    safe_fallback = ascii_fallback.replace('"', "_").replace("\\", "_")
    content_disposition = (
        f'attachment; filename="{safe_fallback}"; filename*=UTF-8\'\'{quote(file.filename)}'
    )

    return Response(
        content=file.binary_content,
        media_type=file.mime_type or "application/octet-stream",
        headers={"content-disposition": content_disposition},
    )


@router.delete("/{file_id}")
async def delete_knowledge_file(file_id: str, db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    file = await db.scalar(
        select(KnowledgeFile)
        .options(load_only(KnowledgeFile.id, KnowledgeFile.filename))
        .where(KnowledgeFile.id == file_id)
    )
    if file is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    # Delete file chunks from database
    await db.execute(delete(VectorChunk).where(VectorChunk.file_id == file_id))

    # Deleting the record also deletes its binary content.
    await db.delete(file)
    await db.commit()
    LOGGER.info("ingest.deleted", extra={"file_id": file_id, "file_name": file.filename})

    return {"ok": True}
