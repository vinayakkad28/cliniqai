"""
Clinical Alert Engine router — Phase 3.

POST /alerts/evaluate
  - Receives patient context (current medications, vitals, recent lab flags)
  - First applies deterministic rule-based pre-filter (fast, no AI cost)
  - If rules flag anything, calls MedGemma 27B for clinical validation
  - Returns: { hasAlert, severity, message }

Severity levels: critical > high > medium > low
"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_internal_token
from app.services.vertex_client import generate_json_medgemma_27b

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["alerts"])

ALERT_SYSTEM_PROMPT = """You are a patient safety AI evaluating clinical alerts.
Given the patient context, determine if there is a clinically significant alert requiring doctor attention.

Return ONLY a valid JSON object:
{
  "hasAlert": true or false,
  "severity": "low|medium|high|critical",
  "message": "Clear, actionable alert message for the doctor (max 100 words)",
  "reasoning": "Brief clinical reasoning"
}

Critical alerts: imminent patient safety risk (sepsis indicators, critical drug interactions, abnormal vitals)
High alerts: significant concerns needing same-day attention
Medium alerts: concerns needing attention within 48 hours
Low alerts: informational, no urgent action needed

Only flag alerts if there is genuine clinical concern. Avoid over-alerting."""


class AlertEvaluateRequest(BaseModel):
    patientId: str
    consultationId: str | None = None
    vitals: dict | None = None
    medications: list[str] | None = None  # medication IDs or names
    recentResults: dict | None = None


class AlertEvaluateResponse(BaseModel):
    hasAlert: bool
    severity: str  # "low" | "medium" | "high" | "critical"
    message: str


# ─── Deterministic rule-based pre-filter ──────────────────────────────────────

CRITICAL_VITALS = {
    "spo2": (lambda v: float(v) < 90, "SpO2 critically low ({v}%)"),
    "heart_rate": (lambda v: float(v) > 150 or float(v) < 40, "Heart rate abnormal ({v} bpm)"),
    "systolic_bp": (lambda v: float(v) > 180 or float(v) < 80, "Blood pressure critical ({v} mmHg)"),
    "temperature": (lambda v: float(v) > 39.5 or float(v) < 35.0, "Temperature abnormal ({v}°C)"),
    "rr": (lambda v: float(v) > 30 or float(v) < 8, "Respiratory rate abnormal ({v}/min)"),
}


def rule_based_prefilter(request: AlertEvaluateRequest) -> tuple[bool, str]:
    """Fast rule-based check. Returns (shouldEscalateToAI, reason)."""
    if request.vitals:
        for key, (check_fn, msg_template) in CRITICAL_VITALS.items():
            val = request.vitals.get(key)
            if val is not None:
                try:
                    if check_fn(val):
                        return True, msg_template.format(v=val)
                except (ValueError, TypeError):
                    pass

    # If there are medications, always escalate to AI for DDI check
    if request.medications and len(request.medications) >= 3:
        return True, f"Patient on {len(request.medications)} concurrent medications — DDI evaluation needed"

    return False, ""


@router.post("/evaluate", response_model=AlertEvaluateResponse, dependencies=[Depends(verify_internal_token)])
async def evaluate_alert(request: AlertEvaluateRequest) -> AlertEvaluateResponse:
    """
    Two-stage clinical alert: rules first, MedGemma 27B if needed.
    """
    # Stage 1: Deterministic rules
    escalate, rule_reason = rule_based_prefilter(request)

    if not escalate:
        return AlertEvaluateResponse(hasAlert=False, severity="low", message="")

    # Stage 2: MedGemma 27B validation
    context_parts = [f"Patient ID: {request.patientId}"]
    if rule_reason:
        context_parts.append(f"Rule trigger: {rule_reason}")
    if request.vitals:
        vitals_str = ", ".join(f"{k}: {v}" for k, v in request.vitals.items())
        context_parts.append(f"Vitals: {vitals_str}")
    if request.medications:
        context_parts.append(f"Current medications ({len(request.medications)}): {', '.join(request.medications[:10])}")
    if request.recentResults:
        results_str = ", ".join(f"{k}: {v}" for k, v in list(request.recentResults.items())[:10])
        context_parts.append(f"Recent results: {results_str}")

    try:
        result = await generate_json_medgemma_27b(
            "\n".join(context_parts),
            system_instruction=ALERT_SYSTEM_PROMPT,
        )
        return AlertEvaluateResponse(
            hasAlert=bool(result.get("hasAlert", False)),
            severity=result.get("severity", "medium"),
            message=str(result.get("message", rule_reason)),
        )
    except Exception as e:
        logger.warning(f"MedGemma alert evaluation failed, using rule result: {e}")
        # Fall back to rule-based result
        return AlertEvaluateResponse(hasAlert=True, severity="medium", message=rule_reason)
