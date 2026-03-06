from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_internal_token
from app.services.vertex_client import generate_json_medgemma_27b

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])

DIAGNOSIS_SYSTEM_PROMPT = """You are a senior physician providing clinical decision support in India.
Given a patient's symptoms, vitals, and history, generate a differential diagnosis list.
Return ONLY a valid JSON object with this structure:
{
  "differential": [
    {
      "condition": "Condition name",
      "icd10_code": "e.g. J18.9",
      "probability": "high|medium|low",
      "rationale": "Clinical reasoning",
      "suggested_workup": ["Test 1", "Test 2"]
    }
  ],
  "red_flags": ["Any urgent/emergency symptoms requiring immediate attention"]
}
List at most 5 differential diagnoses, ranked by probability. Be concise and clinically precise."""


class DiagnosisSuggestRequest(BaseModel):
    patient_id: str
    symptoms: list[str]
    vitals: dict | None = None
    history_summary: str | None = None
    age: int | None = None
    gender: str | None = None


class DiagnosisCandidate(BaseModel):
    condition: str
    icd10_code: str
    probability: str
    rationale: str
    suggested_workup: list[str]


class DiagnosisSuggestResponse(BaseModel):
    differential: list[DiagnosisCandidate]
    red_flags: list[str]


@router.post("/suggest", response_model=DiagnosisSuggestResponse, dependencies=[Depends(verify_internal_token)])
async def suggest_diagnosis(request: DiagnosisSuggestRequest) -> DiagnosisSuggestResponse:
    """
    Differential diagnosis using MedGemma 27B. Mode: Sync (< 4s latency budget).
    """
    parts = [f"Symptoms: {', '.join(request.symptoms)}"]
    if request.age:
        parts.append(f"Age: {request.age}")
    if request.gender:
        parts.append(f"Gender: {request.gender}")
    if request.vitals:
        vitals_str = ", ".join(f"{k}: {v}" for k, v in request.vitals.items())
        parts.append(f"Vitals: {vitals_str}")
    if request.history_summary:
        parts.append(f"History: {request.history_summary}")

    result = await generate_json_medgemma_27b(
        "\n".join(parts),
        system_instruction=DIAGNOSIS_SYSTEM_PROMPT,
    )

    return DiagnosisSuggestResponse(
        differential=[DiagnosisCandidate(**c) for c in result.get("differential", [])],
        red_flags=result.get("red_flags", []),
    )
