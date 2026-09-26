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
)
retriever = Retriever(
    top_k=settings.rag_top_k,
    similarity_threshold=settings.rag_sim_threshold,
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
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
