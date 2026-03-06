from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_internal_token
from app.services.vertex_client import generate_json_medgemma_4b

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prescription", tags=["prescription"])

PRESCRIPTION_SYSTEM_PROMPT = """You are an expert clinical physician in India.
Given a patient's symptoms, chief complaint, and medical history, suggest appropriate medications.
Return ONLY a valid JSON object with this structure:
{
  "suggestions": [
    {
      "drug": "Drug name (generic preferred)",
      "dose": "Dose e.g. 500mg",
      "frequency": "e.g. Twice daily",
      "duration": "e.g. 5 days",
      "route": "Oral/IV/Topical/etc",
      "rationale": "Brief clinical rationale"
    }
  ],
  "warnings": ["Any clinical warnings as strings"],
  "icd10_codes": ["ICD-10 code strings e.g. J06.9"]
}
Adhere to NMC prescription guidelines. Prefer generic names. Maximum 5 suggestions."""


class PrescriptionAssistRequest(BaseModel):
    patient_id: str
    symptoms: list[str]
    chief_complaint: str
    history_summary: str | None = None
    current_medications: list[str] = []


class PrescriptionSuggestion(BaseModel):
    drug: str
    dose: str
    frequency: str
    duration: str
    route: str
    rationale: str


class PrescriptionAssistResponse(BaseModel):
    suggestions: list[PrescriptionSuggestion]
    warnings: list[str]
    icd10_codes: list[str]


@router.post("/assist", response_model=PrescriptionAssistResponse, dependencies=[Depends(verify_internal_token)])
async def prescription_assist(request: PrescriptionAssistRequest) -> PrescriptionAssistResponse:
    """
    AI-assisted prescription suggestions using MedGemma 4B.
    Mode: Sync (< 3s latency budget).
    """
    prompt_parts = [
        f"Chief complaint: {request.chief_complaint}",
        f"Symptoms: {', '.join(request.symptoms)}",
    ]
    if request.history_summary:
        prompt_parts.append(f"Medical history: {request.history_summary}")
    if request.current_medications:
        prompt_parts.append(f"Current medications: {', '.join(request.current_medications)}")

    prompt = "\n".join(prompt_parts)

    result = await generate_json_medgemma_4b(prompt, system_instruction=PRESCRIPTION_SYSTEM_PROMPT)

    return PrescriptionAssistResponse(
        suggestions=[PrescriptionSuggestion(**s) for s in result.get("suggestions", [])],
        warnings=result.get("warnings", []),
        icd10_codes=result.get("icd10_codes", []),
    )
