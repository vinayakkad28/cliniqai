"""
Embedding router — supports query embedding for vector search.

POST /embed/query  → embed a search query (RETRIEVAL_QUERY task type)
POST /embed/text   → embed a document chunk (RETRIEVAL_DOCUMENT task type)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_internal_token
from app.services.embedding_client import embed_query, embed_chunks

router = APIRouter(prefix="/embed", tags=["embeddings"])


class QueryEmbedRequest(BaseModel):
    query: str


class QueryEmbedResponse(BaseModel):
    embedding: list[float]
    dim: int


class TextEmbedRequest(BaseModel):
    texts: list[str]


class TextEmbedResponse(BaseModel):
    embeddings: list[list[float]]
    dim: int


@router.post("/query", response_model=QueryEmbedResponse, dependencies=[Depends(verify_internal_token)])
async def embed_query_endpoint(request: QueryEmbedRequest) -> QueryEmbedResponse:
    """Embed a search query for vector similarity retrieval."""
    embedding = await embed_query(request.query)
    return QueryEmbedResponse(embedding=embedding, dim=len(embedding))


@router.post("/text", response_model=TextEmbedResponse, dependencies=[Depends(verify_internal_token)])
async def embed_texts_endpoint(request: TextEmbedRequest) -> TextEmbedResponse:
    """Embed a batch of text chunks."""
    embeddings = await embed_chunks(request.texts)
    dim = len(embeddings[0]) if embeddings else 768
    return TextEmbedResponse(embeddings=embeddings, dim=dim)
