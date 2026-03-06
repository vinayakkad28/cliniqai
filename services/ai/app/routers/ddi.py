from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_internal_token
from app.services.ddi_fallback import check_interactions_local
from app.services.vertex_client import generate_json_medgemma_4b

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ddi", tags=["ddi"])

DDI_SYSTEM_PROMPT = """You are a clinical pharmacology expert. Given a list of drug names,
identify all clinically significant drug-drug interactions.
Return ONLY a valid JSON object with this exact structure:
{
  "alerts": [
    {
      "drug_a": "DrugName",
      "drug_b": "DrugName",
      "severity": "major|moderate|minor",
      "description": "Brief clinical description of the interaction",
      "recommendation": "What the prescriber should do"
    }
  ]
}
If no interactions exist, return {"alerts": []}. Do not include any text outside the JSON."""


class DDICheckRequest(BaseModel):
    drugs: list[str]
    patient_id: str | None = None


class DDIAlert(BaseModel):
    drug_a: str
    drug_b: str
    severity: str
    description: str
    recommendation: str


class DDICheckResponse(BaseModel):
    alerts: list[DDIAlert]
    checked_pairs: int
    source: str  # "medgemma" or "local_db"


@router.post("/check", response_model=DDICheckResponse, dependencies=[Depends(verify_internal_token)])
async def check_drug_interactions(request: DDICheckRequest) -> DDICheckResponse:
    """
    Check drug-drug interactions. Primary: MedGemma 4B. Fallback: local SQLite DDI DB.
    Mode: Sync (< 2s — blocks prescription save per architecture spec).
    """
    n = len(request.drugs)
    checked_pairs = n * (n - 1) // 2

    if n < 2:
        return DDICheckResponse(alerts=[], checked_pairs=0, source="medgemma")

    # Try MedGemma 4B first
    try:
        prompt = f"Check interactions for these drugs: {', '.join(request.drugs)}"
        result = await generate_json_medgemma_4b(prompt, system_instruction=DDI_SYSTEM_PROMPT)
        raw_alerts = result.get("alerts", [])
        alerts = [DDIAlert(**a) for a in raw_alerts]
        return DDICheckResponse(alerts=alerts, checked_pairs=checked_pairs, source="medgemma")

    except Exception as exc:
        logger.warning("MedGemma DDI check failed (%s), falling back to local DB", exc)

    # Fallback: local SQLite DDI DB
    local_alerts = check_interactions_local(request.drugs)
    alerts = [
        DDIAlert(
            drug_a=a.drug_a,
            drug_b=a.drug_b,
            severity=a.severity,
            description=a.description,
            recommendation=a.recommendation,
        )
        for a in local_alerts
    ]
    return DDICheckResponse(alerts=alerts, checked_pairs=checked_pairs, source="local_db")
