from app.core.rag_pipeline import RAGIngestPipeline


def test_chunking_uses_token_limit_and_overlap(tmp_path) -> None:
    pipeline = RAGIngestPipeline(
        session_factory=None,  # type: ignore[arg-type]
        embedder=None,  # type: ignore[arg-type]
        image_captioner=None,  # type: ignore[arg-type]
        tmp_dir=str(tmp_path),
        chunk_size=100,
        chunk_overlap=20,
    )
    text = "\n\n".join(f"Section {index}: " + ("service " * 30) for index in range(20))
    chunks = pipeline._split_text(text)
    assert len(chunks) > 1
    assert all(len(pipeline._encoding.encode(chunk)) <= 100 for chunk in chunks)
