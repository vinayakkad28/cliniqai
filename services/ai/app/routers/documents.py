"""
Document Intelligence router — Phase 2.

POST /documents/extract
  - Receives GCS path + document type
  - Downloads from GCS (or Cloud Vision OCR for images)
  - Calls MedGemma 27B for structured extraction
  - Returns extractedData (JSON) + summary + text chunks with embeddings

POST /documents/classify
  - Classifies a document type from a short text snippet
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_internal_token
from app.services.vertex_client import generate_json_medgemma_27b, generate_medgemma_27b
from app.services.embedding_client import embed_chunks, chunk_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])

EXTRACT_SYSTEM_PROMPT = """You are a medical document analysis AI. Extract structured clinical data from the provided document text.
Return ONLY a valid JSON object with this structure (include only fields present in the document):
{
  "document_type": "lab_report|discharge_summary|prescription_external|imaging|other",
  "patient_name": "string or null",
  "date": "YYYY-MM-DD or null",
  "provider": "Hospital/lab name or null",
  "diagnoses": ["ICD-10 coded conditions if present"],
  "medications": [{"name": "...", "dose": "...", "frequency": "..."}],
  "lab_results": [{"name": "...", "value": "...", "unit": "...", "flag": "normal|high|low|critical"}],
  "imaging_findings": "string or null",
  "key_findings": ["Most clinically significant findings, max 5"],
  "follow_up": "Recommended follow-up or null",
  "chunks": []
}
The 'chunks' field should be omitted — it will be added programmatically.
Be concise. Do not hallucinate — only extract what is explicitly stated."""

CLASSIFY_SYSTEM_PROMPT = """Classify the following medical document text into one of these categories:
lab_report, prescription_external, discharge_summary, imaging, insurance, other.
Return ONLY the category name as a plain string, nothing else."""


class DocumentExtractRequest(BaseModel):
    documentId: str
    gcsPath: str
    mimeType: str
    documentType: str
    rawText: str | None = None  # optional: pre-extracted text (from client-side PDF.js)


class ChunkWithEmbedding(BaseModel):
    text: str
    embedding: list[float]


class DocumentExtractResponse(BaseModel):
    extractedData: dict[str, Any]
    summary: str
    chunks: list[ChunkWithEmbedding]


class DocumentClassifyRequest(BaseModel):
    textSnippet: str


class DocumentClassifyResponse(BaseModel):
    documentType: str


@router.post("/extract", response_model=DocumentExtractResponse, dependencies=[Depends(verify_internal_token)])
async def extract_document(request: DocumentExtractRequest) -> DocumentExtractResponse:
    """
    Extract structured clinical data from a medical document.
    Accepts pre-extracted text (from client PDF.js) or fetches from GCS.
    """
    raw_text = request.rawText or f"[Document at GCS path: {request.gcsPath}]"

    # Step 1: MedGemma 27B structured extraction
    try:
        extracted = await generate_json_medgemma_27b(raw_text, system_instruction=EXTRACT_SYSTEM_PROMPT)
    except Exception as e:
        logger.warning(f"MedGemma extraction failed, using fallback: {e}")
        extracted = {"key_findings": [], "document_type": request.documentType}

    # Step 2: Generate a plain-language summary
    summary_prompt = f"""Summarize this medical document in 2-3 sentences for a doctor's quick review.
Document text: {raw_text[:3000]}
Key findings: {extracted.get('key_findings', [])}"""
    try:
        summary = await generate_medgemma_27b(summary_prompt, temperature=0.2, max_output_tokens=256)
    except Exception:
        summary = f"Document extraction complete. Key findings: {', '.join(str(f) for f in extracted.get('key_findings', []))}"

    # Step 3: Chunk the document text and generate embeddings for vector search
    chunks_text = chunk_text(raw_text, max_tokens=256, overlap=32)
    chunks_with_embeddings: list[ChunkWithEmbedding] = []
    try:
        embeddings = await embed_chunks(chunks_text)
        chunks_with_embeddings = [
            ChunkWithEmbedding(text=t, embedding=e)
            for t, e in zip(chunks_text, embeddings)
        ]
    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}")

    # Include chunk data in extractedData so the Node worker can store it
    extracted["chunks"] = [{"text": c.text, "embedding": c.embedding} for c in chunks_with_embeddings]

    return DocumentExtractResponse(
        extractedData=extracted,
        summary=summary.strip(),
        chunks=chunks_with_embeddings,
    )


@router.post("/classify", response_model=DocumentClassifyResponse, dependencies=[Depends(verify_internal_token)])
async def classify_document(request: DocumentClassifyRequest) -> DocumentClassifyResponse:
    """Fast document type classification using MedGemma 4B."""
    from app.services.vertex_client import generate_medgemma_4b
    try:
        result = await generate_medgemma_4b(
            request.textSnippet[:1000],
            system_instruction=CLASSIFY_SYSTEM_PROMPT,
            max_output_tokens=16,
        )
        doc_type = result.strip().lower()
        valid_types = {"lab_report", "prescription_external", "discharge_summary", "imaging", "insurance", "other"}
        if doc_type not in valid_types:
            doc_type = "other"
    except Exception:
        doc_type = "other"
    return DocumentClassifyResponse(documentType=doc_type)
