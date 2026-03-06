"""
Longitudinal Patient Intelligence router — Phase 3.

POST /longitudinal/summary
  - Takes patient consultation history + approved AI insights
  - Generates a comprehensive longitudinal health narrative using MedGemma 27B
  - Identifies trends, chronic conditions, risk factors

POST /explain/patient
  - Translates clinical notes/findings into plain language for patients
  - Supports multiple Indian languages (Hindi, Tamil, Telugu, etc.)
"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_internal_token
from app.services.vertex_client import generate_medgemma_27b

logger = logging.getLogger(__name__)

router = APIRouter(tags=["longitudinal"])

LONGITUDINAL_SYSTEM_PROMPT = """You are a senior physician reviewing a patient's complete medical history.
Analyze the consultation history and approved AI insights to produce a longitudinal health summary.

Your summary should:
1. Identify chronic conditions and ongoing health concerns
2. Note significant clinical trends (improving, worsening, stable)
3. Highlight medication patterns and potential long-term risks
4. Flag any recurring symptoms that warrant investigation
5. Provide a risk stratification (low/medium/high) for the next 6 months

Format your response as a structured narrative with clear sections. Be concise (max 400 words).
Write for a physician audience — use appropriate clinical terminology."""

EXPLAIN_SYSTEM_PROMPT = """You are a medical interpreter helping explain health information to patients.
Translate the following clinical information into simple, clear language that a patient with no medical background can understand.
Avoid jargon. Use short sentences. Be reassuring but accurate.
Do NOT add information not present in the original text."""


class ConsultationItem(BaseModel):
    id: str
    startedAt: datetime
    chiefComplaint: str | None
    notes: str | None
    status: str


class InsightItem(BaseModel):
    type: str
    content: str
    createdAt: datetime


class LongitudinalSummaryRequest(BaseModel):
    patientId: str
    consultations: list[ConsultationItem]
    approvedInsights: list[InsightItem]


class LongitudinalSummaryResponse(BaseModel):
    summary: str


class ExplainRequest(BaseModel):
    content: str
    language: str = "english"  # english, hindi, tamil, telugu, kannada, marathi, bengali


class ExplainResponse(BaseModel):
    explanation: str


@router.post("/longitudinal/summary", response_model=LongitudinalSummaryResponse, dependencies=[Depends(verify_internal_token)])
async def longitudinal_summary(request: LongitudinalSummaryRequest) -> LongitudinalSummaryResponse:
    """Generate a longitudinal health narrative from consultation history."""
    if not request.consultations:
        return LongitudinalSummaryResponse(summary="No consultation history available for this patient.")

    # Build prompt from history
    history_parts = []
    for c in sorted(request.consultations, key=lambda x: x.startedAt):
        parts = [f"[{c.startedAt.strftime('%Y-%m-%d')}]"]
        if c.chiefComplaint:
            parts.append(f"Chief complaint: {c.chiefComplaint}")
        if c.notes:
            parts.append(f"Notes: {c.notes[:300]}")
        history_parts.append(" | ".join(parts))

    insights_parts = []
    for insight in request.approvedInsights[-10:]:  # limit to 10 most recent approved
        insights_parts.append(f"[{insight.type}] {insight.content[:200]}")

    prompt = f"""Patient ID: {request.patientId}

CONSULTATION HISTORY ({len(request.consultations)} visits):
{chr(10).join(history_parts)}

APPROVED CLINICAL INSIGHTS:
{chr(10).join(insights_parts) if insights_parts else "None"}

Generate a longitudinal health summary:"""

    try:
        summary = await generate_medgemma_27b(
            prompt,
            system_instruction=LONGITUDINAL_SYSTEM_PROMPT,
            temperature=0.3,
            max_output_tokens=600,
        )
    except Exception as e:
        logger.error(f"Longitudinal summary failed: {e}")
        summary = f"Unable to generate summary. Patient has {len(request.consultations)} recorded consultations."

    return LongitudinalSummaryResponse(summary=summary.strip())


@router.post("/explain/patient", response_model=ExplainResponse, dependencies=[Depends(verify_internal_token)])
async def explain_for_patient(request: ExplainRequest) -> ExplainResponse:
    """Translate clinical content into plain patient-friendly language."""
    lang_instruction = ""
    if request.language.lower() != "english":
        lang_instruction = f"\n\nIMPORTANT: Respond in {request.language.capitalize()}."

    prompt = f"""Clinical content to explain:
{request.content[:2000]}

Provide a simple patient explanation:{lang_instruction}"""

    try:
        explanation = await generate_medgemma_27b(
            prompt,
            system_instruction=EXPLAIN_SYSTEM_PROMPT + lang_instruction,
            temperature=0.4,
            max_output_tokens=400,
        )
    except Exception as e:
        logger.error(f"Patient explanation failed: {e}")
        explanation = request.content  # fallback: return original

    return ExplainResponse(explanation=explanation.strip())
