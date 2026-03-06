"""
Text embedding client using Google's text-embedding-004 model via Vertex AI.
768-dimensional multilingual embeddings — supports English, Hindi, Tamil, etc.

Used for:
- Document chunk embeddings → stored in pgvector for semantic search
- Query embedding → vector similarity search at retrieval time
"""
from __future__ import annotations

import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

_embedding_model = None

MAX_CHUNK_CHARS = 1500  # ~350 tokens, well within 2048 token limit
EMBEDDING_DIM = 768


def _get_model():
    global _embedding_model
    if _embedding_model is None:
        import vertexai
        from vertexai.language_models import TextEmbeddingModel
        vertexai.init(
            project=settings.google_cloud_project_id,
            location=settings.vertex_ai_location,
        )
        _embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-004")
    return _embedding_model


def chunk_text(text: str, max_tokens: int = 256, overlap: int = 32) -> list[str]:
    """
    Split text into overlapping chunks for embedding.
    Uses character-based approximation (1 token ≈ 4 chars for medical text).
    """
    max_chars = max_tokens * 4
    overlap_chars = overlap * 4

    if len(text) <= max_chars:
        return [text.strip()] if text.strip() else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        if end < len(text):
            # Try to break at sentence boundary
            break_at = text.rfind(". ", start, end)
            if break_at == -1:
                break_at = text.rfind(" ", start, end)
            if break_at != -1:
                end = break_at + 1
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap_chars
        if start >= len(text):
            break

    return chunks


async def embed_chunks(texts: list[str]) -> list[list[float]]:
    """
    Embed a list of text chunks using text-embedding-004.
    Returns a list of 768-dimensional float vectors.
    Falls back to zero vectors if the embedding service is unavailable.
    """
    if not texts:
        return []

    try:
        model = _get_model()
        # text-embedding-004 supports batch embedding
        from vertexai.language_models import TextEmbeddingInput
        inputs = [TextEmbeddingInput(text=t, task_type="RETRIEVAL_DOCUMENT") for t in texts]
        embeddings = model.get_embeddings(inputs)
        return [e.values for e in embeddings]
    except Exception as e:
        logger.warning(f"Embedding failed, returning zero vectors: {e}")
        return [[0.0] * EMBEDDING_DIM for _ in texts]


async def embed_query(query: str) -> list[float]:
    """Embed a search query for vector similarity retrieval."""
    try:
        model = _get_model()
        from vertexai.language_models import TextEmbeddingInput
        inputs = [TextEmbeddingInput(text=query, task_type="RETRIEVAL_QUERY")]
        embeddings = model.get_embeddings(inputs)
        return embeddings[0].values
    except Exception as e:
        logger.warning(f"Query embedding failed: {e}")
        return [0.0] * EMBEDDING_DIM
