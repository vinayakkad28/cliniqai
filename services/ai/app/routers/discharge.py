from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_internal_token
from app.services.vertex_client import generate_json_medgemma_27b

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/discharge", tags=["discharge"])

DISCHARGE_SYSTEM_PROMPT = """You are a hospital physician drafting a discharge summary.
Given the encounter details, produce a complete discharge summary.
Return ONLY a valid JSON object:
{
  "draft_summary": "Full formal discharge summary text suitable for a medical record",
  "sections": {
    "diagnosis": "Primary and secondary diagnoses",
    "treatment": "Summary of treatment provided during admission",
    "medications": "Discharge medications with doses",
    "instructions": "Patient instructions for home care",
    "follow_up": "Follow-up appointments and monitoring required"
  }
}
Follow NMC and standard hospital discharge summary format."""


class DischargeDraftRequest(BaseModel):
    patient_id: str
    encounter_id: str
    admission_date: str
    discharge_date: str
    diagnosis: list[str]
    procedures: list[str] = []
    discharge_medications: list[str] = []
    follow_up_instructions: str | None = None


class DischargeDraftResponse(BaseModel):
    draft_summary: str
    sections: dict[str, Any]


@router.post("/draft", response_model=DischargeDraftResponse, dependencies=[Depends(verify_internal_token)])
async def draft_discharge_summary(request: DischargeDraftRequest) -> DischargeDraftResponse:
    """
    Discharge summary draft using MedGemma 27B.
    Mode: Async job (< 20s latency budget). Doctor reviews before saving.
    """
    parts = [
        f"Admission: {request.admission_date} — Discharge: {request.discharge_date}",
        f"Diagnoses: {', '.join(request.diagnosis)}",
    ]
    if request.procedures:
        parts.append(f"Procedures: {', '.join(request.procedures)}")
    if request.discharge_medications:
        parts.append(f"Discharge medications: {', '.join(request.discharge_medications)}")
    if request.follow_up_instructions:
        parts.append(f"Follow-up: {request.follow_up_instructions}")

    result = await generate_json_medgemma_27b(
        "\n".join(parts),
        system_instruction=DISCHARGE_SYSTEM_PROMPT,
    )

    return DischargeDraftResponse(
        draft_summary=result.get("draft_summary", ""),
        sections=result.get("sections", {}),
    )
