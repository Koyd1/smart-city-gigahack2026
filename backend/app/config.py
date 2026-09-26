from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    web_origin: str = "http://localhost:3000"
    log_level: str = "INFO"
    log_json: bool = False
    log_to_file: bool = False
    log_file_path: str = "logs/backend.log"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-large"
    openai_embedding_dim: int = 3072
    openai_timeout_seconds: float = 20.0
    openai_max_retries: int = 2
    allow_fake_embeddings: bool = False
    ingest_tmp_dir: str = "/tmp/rag"
    ingest_max_file_size_mb: int = 15
    ingest_image_max_file_size_mb: int = 5
    ingest_allowed_image_mime_types: str = "image/png,image/jpeg,image/webp"
    openai_chat_model: str = "gpt-4o"
    openai_chat_fallback_models: str = "gpt-4o"
    openai_judge_model: str = "gpt-4o"
    openai_model_pricing_json: str = ""
    rag_top_k: int = 5
    rag_sim_threshold: float = 0.05
    rag_chunk_size: int = 700
    rag_chunk_overlap: int = 100
    rag_retriever_probes: int = 20
    rag_retriever_exact_scan_max_chunks: int = 1000
    rag_primary_document_chunks: int = 12
    max_chat_input_tokens: int = 12000
    health_openai_warn_ms: int = 1800
    health_hall_warn_threshold: float = 0.45
    health_cache_seconds: int = 120

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
