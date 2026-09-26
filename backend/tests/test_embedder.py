import pytest

from app.core.embedder import Embedder, EmbeddingUnavailableError


@pytest.mark.asyncio
async def test_missing_provider_fails_closed() -> None:
    embedder = Embedder(api_key="", model="test", dimensions=8)
    with pytest.raises(EmbeddingUnavailableError):
        await embedder.embed_texts(["document"])


@pytest.mark.asyncio
async def test_fake_embeddings_require_explicit_flag() -> None:
    embedder = Embedder(
        api_key="",
        model="test",
        dimensions=8,
        allow_fake_embeddings=True,
    )
    vectors = await embedder.embed_texts(["document"])
    assert len(vectors) == 1
    assert len(vectors[0]) == 8
