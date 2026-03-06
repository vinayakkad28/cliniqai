from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_internal_token
from app.services.vertex_client import generate_json_medgemma_4b

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lab", tags=["lab"])

LAB_SYSTEM_PROMPT = """You are a clinical pathologist providing lab result interpretation.
Given lab values with reference ranges and flags, explain the results in plain language for a physician.
Return ONLY a valid JSON object:
{
  "plain_language_summary": "2-3 sentence plain English summary of all results",
  "abnormal_findings": ["List of abnormal values as strings e.g. 'Hemoglobin 8.2 g/dL (Low)'"],
  "clinical_significance": "What these results mean clinically",
  "suggested_follow_up": ["Suggested next steps e.g. 'Repeat CBC in 4 weeks'"]
}"""


class LabValue(BaseModel):
    name: str
    value: float | str
    unit: str
    reference_range: str | None = None
    flag: str | None = None


class LabInterpretRequest(BaseModel):
    patient_id: str
    lab_order_id: str
    results: list[LabValue]
    patient_age: int | None = None
    patient_gender: str | None = None


class LabInterpretResponse(BaseModel):
    plain_language_summary: str
    abnormal_findings: list[str]
    clinical_significance: str
    suggested_follow_up: list[str]


@router.post("/interpret", response_model=LabInterpretResponse, dependencies=[Depends(verify_internal_token)])
async def interpret_lab_results(request: LabInterpretRequest) -> LabInterpretResponse:
    """
    Plain-language lab interpretation using MedGemma 4B.
    Mode: Async job (< 10s latency budget).
    """
    results_text = "\n".join(
        f"- {r.name}: {r.value} {r.unit}"
        + (f" [Ref: {r.reference_range}]" if r.reference_range else "")
        + (f" [{r.flag}]" if r.flag else "")
        for r in request.results
    )

    context_parts = ["Lab results:"]
    if request.patient_age:
        context_parts.append(f"Patient age: {request.patient_age}")
    if request.patient_gender:
        context_parts.append(f"Gender: {request.patient_gender}")
    context_parts.append(results_text)

    result = await generate_json_medgemma_4b(
        "\n".join(context_parts),
        system_instruction=LAB_SYSTEM_PROMPT,
    )

    return LabInterpretResponse(
        plain_language_summary=result.get("plain_language_summary", ""),
        abnormal_findings=result.get("abnormal_findings", []),
        clinical_significance=result.get("clinical_significance", ""),
        suggested_follow_up=result.get("suggested_follow_up", []),
    )
