from __future__ import annotations

import logging
import math
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.source_parser import parse_model_sources
from app.core.hallucination import score_hallucination
from app.core.streamer import encode_sse, Source
from app.db.models import KnowledgeFile
from app.deps import chat_streamer, embedder, get_db, retriever

router = APIRouter(prefix="/chat", tags=["chat"])
LOGGER = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=6000)


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=3, max_length=128)
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)


@router.post("")
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    last_user = next((msg for msg in reversed(request.messages) if msg.role == "user"), None)
    if last_user is None:
        raise HTTPException(status_code=400, detail="At least one user message is required")

    LOGGER.info(
        "chat.request_received",
        extra={"session_id": request.session_id, "messages_count": len(request.messages)},
    )

    query_embeddings, embedding_telemetry = await embedder.embed_texts_with_telemetry([last_user.content])
    query_embedding = query_embeddings[0]
    sources = await retriever.retrieve(db, query_embedding)
#     sources = sorted(
#     sources,
#     key=lambda s: (
#         s.similarity,
#         query_overlap_score(s.content, last_user.content)
#     ),
#     reverse=True
# )
    LOGGER.info(
        "chat.sources_retrieved",
        extra={"session_id": request.session_id, "sources_count": len(sources)},
    )

    async def event_generator(sources=sources):
        pending_telemetry: list[dict[str, object]] = []
        files_map: dict[str, str] = {}
        if embedding_telemetry is not None:
            pending_telemetry.append(embedding_telemetry.as_payload())
        if sources:
            file_ids = list({source.file_id for source in sources})
            from sqlalchemy import select
            deduped_sources = {}
            for source in sources:
                key = (source.file_id, source.content[:80])
                if key not in deduped_sources:
                    deduped_sources[key] = source
            sources = list(deduped_sources.values())
            result = await db.execute(
                select(KnowledgeFile.id, KnowledgeFile.filename).where(KnowledgeFile.id.in_(file_ids))
            )
            files_map = {str(row[0]): str(row[1]) for row in result.all()}
            
            for source in sources:
                source.filename = files_map.get(source.file_id, "unknown")
            filename_to_similarity: dict[str, float] = {}
            filename_to_fileid: dict[str, str] = {}
            for source in sources:
                fname = source.filename or "unknown"
                sim = source.similarity
                if sim is None:
                    continue
                if fname not in filename_to_similarity or sim > filename_to_similarity[fname]:
                    filename_to_similarity[fname] = sim
                    filename_to_fileid[fname] = source.file_id

        # We used to send the retrieved chunks as sources here (from the DB).
        #
        # sources_payload = [
        #     {
        #         "fileId": source.file_id,
        #         "filename": getattr(source, 'filename', files_map.get(source.file_id, "unknown")),
        #         "similarity": round(source.similarity, 4)
        #         if isinstance(source.similarity, float) and math.isfinite(source.similarity)
        #         else 0.0,
        #         "snippet": source.content[:220],
        #     }
        #     for source in sources
        # ]
        # yield encode_sse({"type": "sources", "data": sources_payload})
        for telemetry in pending_telemetry:
            yield encode_sse({"type": "telemetry", "data": telemetry})

        if not sources:
            LOGGER.info("chat.no_context", extra={"session_id": request.session_id})
            answer = (
                "В базе знаний пока нет релевантной информация по этому вопросу. "
                "Загрузите HR-документы в раздел Knowledge и повторите запрос."
            )
            heuristic = score_hallucination(answer, [])
            yield encode_sse(
                {
                    "type": "done",
                    "data": {
                        "answer": answer,
                        "session_id": request.session_id,
                        "hallScore": heuristic["hallScore"],
                        "hallReason": heuristic["reason"],
                        "hallScoreSource": heuristic["source"],
                    },
                }
            )
            return

        # Convert sources to Source objects for streamer
        sources_for_streamer = [
            Source(
                file_id=source.file_id,
                content=source.content,
                filename=getattr(source, 'filename', files_map.get(source.file_id, "unknown"))
            )
            for source in sources
        ]

        full_answer_parts: list[str] = []

        async def emit_usage(telemetry):
            pending_telemetry.append(telemetry.as_payload())

        async for token in chat_streamer.stream_answer(
            user_message=last_user.content,
            sources=sources_for_streamer,
            usage_callback=emit_usage,
        ):
            full_answer_parts.append(token)
            yield encode_sse({"type": "token", "data": token})

        final_answer = "".join(full_answer_parts).strip()

        answer_text, parsed_sources = parse_model_sources(final_answer)

        filename_to_max_similarity: dict[str, float] = {}
        filename_to_fileid: dict[str, str] = {}
        for source in sources:
            filename = getattr(source, 'filename', files_map.get(source.file_id, "unknown"))
            sim = source.similarity or 0.0
            current_max = filename_to_max_similarity.get(filename, 0.0)
            if sim > current_max:
                filename_to_max_similarity[filename] = sim
                filename_to_fileid[filename] = source.file_id
        
        # Build sources from model answer with fileId included
        model_sources_payload = []
        for doc_name, citations in parsed_sources.items():
            if not citations or not citations.strip():
                LOGGER.info(
                    "chat.source_without_citations_skipped",
                    extra={"session_id": request.session_id, "document": doc_name}
                )
                continue
            
            max_similarity = filename_to_max_similarity.get(doc_name, 0.0)
            payload: dict[str, object] = {
                "filename": doc_name,
                "similarity": round(max_similarity, 4) if isinstance(max_similarity, float) and math.isfinite(max_similarity) else 0.0,
                "snippet": citations,  # Citations from model
            }
            file_id = filename_to_fileid.get(doc_name)
            if file_id:
                payload["fileId"] = file_id
            model_sources_payload.append(payload)
        
        if model_sources_payload:
            yield encode_sse(
                {
                    "type": "updated_sources",
                    "data": model_sources_payload,
                }
            )
        
        context_blocks = [source.content for source in sources_for_streamer]
        heuristic = score_hallucination(answer_text, context_blocks)
        LOGGER.info(
            "chat.completed",
            extra={
                "session_id": request.session_id,
                "answer_len": len(answer_text),
                "hall_score": round(float(heuristic["hallScore"]), 4),
            },
        )
        if len(pending_telemetry) > 1:
            for telemetry in pending_telemetry[1:]:
                yield encode_sse({"type": "telemetry", "data": telemetry})
        yield encode_sse(
            {
                "type": "done",
                "data": {
                    "answer": answer_text,
                    "session_id": request.session_id,
                    "hallScore": heuristic["hallScore"],
                    "hallReason": heuristic["reason"],
                    "hallScoreSource": heuristic["source"],
                },
            }
        )

    return StreamingResponse(event_generator(), media_type="text/event-stream")
 
