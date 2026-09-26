from __future__ import annotations

import asyncio
import logging
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import tiktoken
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.embedder import Embedder
from app.core.image_captioner import ImageCaptioner
from app.db.models import KnowledgeFile, VectorChunk

LOGGER = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"}
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


@dataclass(slots=True)
class IngestResult:
    chunk_count: int


class RAGIngestPipeline:
    def __init__(
        self,
        *,
        session_factory: async_sessionmaker,
        embedder: Embedder,
        image_captioner: ImageCaptioner,
        tmp_dir: str,
        chunk_size: int = 700,
        chunk_overlap: int = 100,
    ) -> None:
        self._session_factory = session_factory
        self._embedder = embedder
        self._image_captioner = image_captioner
        self._tmp_dir = tmp_dir
        self._chunk_size = max(100, chunk_size)
        self._chunk_overlap = min(max(0, chunk_overlap), self._chunk_size - 1)
        self._encoding = tiktoken.get_encoding("cl100k_base")
        Path(self._tmp_dir).mkdir(parents=True, exist_ok=True)

    async def run(self, file_id: str, attempt: int = 1) -> None:
        async with self._session_factory() as session:
            file = await session.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
            if file is None:
                LOGGER.warning("ingest.file_not_found", extra={"file_id": file_id})
                return

            file.status = "PROCESSING"
            file.ingest_attempts = max(file.ingest_attempts, attempt)
            file.ingest_error = None
            file.processing_started_at = datetime.utcnow()
            file.heartbeat_at = datetime.utcnow()
            await session.commit()

        try:
            chunks = await self._extract_chunks(file_id)
            await self._heartbeat(file_id)
            embeddings = await self._embedder.embed_texts(chunks)

            async with self._session_factory() as session:
                file = await session.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
                if file is None:
                    return

                await session.execute(delete(VectorChunk).where(VectorChunk.file_id == file_id))

                session.add_all(
                    [
                        VectorChunk(
                            id=str(uuid4()),
                            file_id=file_id,
                            content=chunk,
                            embedding=embedding,
                            meta={"source": file.id, "filename": file.filename},
                        )
                        for chunk, embedding in zip(chunks, embeddings, strict=False)
                    ]
                )

                file.chunk_count = len(chunks)
                file.status = "READY"
                file.ingest_error = None
                file.heartbeat_at = datetime.utcnow()
                await session.commit()

        except Exception as exc:
            LOGGER.exception("ingest.failed", extra={"file_id": file_id, "attempt": attempt})
            async with self._session_factory() as session:
                file = await session.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
                if file:
                    file.status = "ERROR"
                    file.ingest_error = str(exc)[:2000]
                    file.heartbeat_at = datetime.utcnow()
                    await session.commit()
            raise

    async def _heartbeat(self, file_id: str) -> None:
        async with self._session_factory() as session:
            file = await session.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
            if file:
                file.heartbeat_at = datetime.utcnow()
                await session.commit()

    async def _extract_chunks(self, file_id: str) -> list[str]:
        async with self._session_factory() as session:
            file = await session.scalar(select(KnowledgeFile).where(KnowledgeFile.id == file_id))
            if file is None:
                raise RuntimeError("Knowledge file does not exist")

            blob = file.binary_content
            filename = file.filename

        with tempfile.TemporaryDirectory(prefix="ingest-", dir=self._tmp_dir) as temp_dir:
            local_path = Path(temp_dir) / filename
            local_path.write_bytes(blob)

            # For image files, generate a comprehensive caption using vision AI.
            if local_path.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS:
                try:
                    from PIL import Image

                    with Image.open(local_path) as img:
                        img.verify()
                except Exception as exc:  # pragma: no cover - corrupted image
                    raise RuntimeError("Invalid image file") from exc

                try:
                    caption = await self._image_captioner.generate_caption(blob)
                except Exception as exc:
                    LOGGER.exception("ingest.caption_generation_failed", extra={"file_id": filename})
                    raise RuntimeError(f"Failed to generate image caption: {exc}") from exc

                text = caption
            else:
                text = await asyncio.to_thread(self._extract_text_from_file, local_path)

        chunks = [chunk for chunk in self._split_text(text) if chunk.strip()]
        if not chunks:
            raise RuntimeError("No chunks extracted from document")

        return chunks

    def _extract_text_from_file(self, path: Path) -> str:
        ext = path.suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported extension: {ext}")

        if ext in {".txt", ".md"}:
            return path.read_text(encoding="utf-8", errors="ignore")

        if ext == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(str(path))
            return "\n".join((page.extract_text() or "") for page in reader.pages)

        if ext == ".docx":
            from docx import Document

            doc = Document(str(path))
            return "\n".join(par.text for par in doc.paragraphs)

        raise ValueError(f"Unsupported extension: {ext}")

    def _split_text(self, text: str) -> list[str]:
        # Preserve paragraph boundaries before applying a token limit.
        paragraphs = [" ".join(part.split()) for part in text.split("\n") if part.strip()]
        clean = "\n\n".join(paragraphs)
        if not clean:
            return []

        tokens = self._encoding.encode(clean)
        chunks: list[str] = []
        start = 0
        while start < len(tokens):
            end = min(start + self._chunk_size, len(tokens))
            chunk = self._encoding.decode(tokens[start:end]).strip()
            if chunk:
                chunks.append(chunk)
            if end >= len(tokens):
                break
            start = end - self._chunk_overlap
        return chunks
