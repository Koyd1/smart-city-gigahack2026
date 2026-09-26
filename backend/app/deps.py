from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.embedder import Embedder
from app.core.hallucination import HallucinationJudge
from app.core.image_captioner import ImageCaptioner
from app.core.retriever import Retriever
from app.core.rag_pipeline import RAGIngestPipeline
from app.core.streamer import ChatStreamer
from app.db.session import AsyncSessionLocal
embedder = Embedder(
    api_key=settings.openai_api_key,
    model=settings.openai_embedding_model,
    dimensions=settings.openai_embedding_dim,
    allow_fake_embeddings=settings.allow_fake_embeddings,
    timeout_seconds=settings.openai_timeout_seconds,
    max_retries=settings.openai_max_retries,
)
retriever = Retriever(
    top_k=settings.rag_top_k,
    similarity_threshold=settings.rag_sim_threshold,
    probes=settings.rag_retriever_probes,
    exact_scan_max_chunks=settings.rag_retriever_exact_scan_max_chunks,
    primary_document_chunks=settings.rag_primary_document_chunks,
)
chat_fallback_models = [
    item.strip()
    for item in settings.openai_chat_fallback_models.split(",")
    if item.strip()
]
chat_streamer = ChatStreamer(
    api_key=settings.openai_api_key,
    model=settings.openai_chat_model,
    fallback_models=chat_fallback_models,
)
hallucination_judge = HallucinationJudge(
    api_key=settings.openai_api_key,
    model=settings.openai_judge_model,
)
image_captioner = ImageCaptioner(
    api_key=settings.openai_api_key,
    model=settings.openai_chat_model,
)
ingest_pipeline = RAGIngestPipeline(
    session_factory=AsyncSessionLocal,
    embedder=embedder,
    image_captioner=image_captioner,
    tmp_dir=settings.ingest_tmp_dir,
    chunk_size=settings.rag_chunk_size,
    chunk_overlap=settings.rag_chunk_overlap,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
