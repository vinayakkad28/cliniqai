from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_internal_token
from app.services.vertex_client import generate_json_medgemma_27b

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notes", tags=["notes"])

NOTES_SYSTEM_PROMPT = """You are a clinical documentation specialist.
Convert the provided unstructured clinical notes into a structured SOAP summary.
Return ONLY a valid JSON object:
{
  "structured_summary": {
    "subjective": "Patient's complaints and history in their own words",
    "objective": "Examination findings, vitals, investigations",
    "assessment": "Diagnosis or impression",
    "plan": "Treatment plan, medications, follow-up"
  },
  "plain_text": "A concise readable paragraph summarising the encounter"
}"""


class NotesSummarizeRequest(BaseModel):
    patient_id: str
    raw_notes: str
    note_type: str = "consultation"


class NotesSummarizeResponse(BaseModel):
    structured_summary: dict[str, Any]
    plain_text: str


@router.post("/summarize", response_model=NotesSummarizeResponse, dependencies=[Depends(verify_internal_token)])
async def summarize_notes(request: NotesSummarizeRequest) -> NotesSummarizeResponse:
    """
    SOAP structuring of unstructured clinical notes using MedGemma 27B.
    Mode: Async job (< 15s latency budget).
    """
    result = await generate_json_medgemma_27b(
        f"Note type: {request.note_type}\n\nNotes:\n{request.raw_notes}",
        system_instruction=NOTES_SYSTEM_PROMPT,
    )

    return NotesSummarizeResponse(
        structured_summary=result.get("structured_summary", {}),
        plain_text=result.get("plain_text", ""),
    )
