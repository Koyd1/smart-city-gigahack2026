from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.deps import hallucination_judge

router = APIRouter(prefix="/evaluate", tags=["evaluate"])


class EvaluateRequest(BaseModel):
    answer: str = Field(min_length=1, max_length=12000)
    contextBlocks: list[str] = Field(default_factory=list, max_length=20)


@router.post("")
async def evaluate(request: EvaluateRequest) -> dict[str, object]:
    return await hallucination_judge.score(
        answer=request.answer,
        context_blocks=request.contextBlocks,
    )
