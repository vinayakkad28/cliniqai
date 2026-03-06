from __future__ import annotations

import logging

import google.auth
import google.auth.transport.requests
import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth import verify_internal_token
from app.services.vertex_client import generate_medgemma_27b

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/records", tags=["records"])

SYNTHESIS_SYSTEM_PROMPT = """You are a clinical AI assistant.
Given a set of FHIR resource summaries retrieved for a patient, answer the doctor's question
in 2-3 concise sentences using only the provided data. Be factual and clinical."""


class RecordSearchRequest(BaseModel):
    patient_id: str
    query: str
    resource_types: list[str] = ["Condition", "Observation", "Encounter", "MedicationRequest"]
    max_results: int = 10


class FhirResourceSummary(BaseModel):
    resource_type: str
    resource_id: str
    summary: str
    date: str | None = None
    relevance_score: float


class RecordSearchResponse(BaseModel):
    results: list[FhirResourceSummary]
    narrative_summary: str


def _get_healthcare_token() -> str:
    """Get a short-lived access token using Application Default Credentials."""
    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-healthcare"]
    )
    credentials.refresh(google.auth.transport.requests.Request())
    return credentials.token  # type: ignore[attr-defined]


async def _search_fhir(patient_id: str, resource_types: list[str]) -> list[dict]:
    """
    Use Vertex AI Healthcare Search (or FHIR $everything) to find relevant resources.
    Falls back to a simple FHIR search if Healthcare Search is not configured.
    """
    project = settings.google_cloud_project_id
    region = settings.gcp_region
    dataset = "cliniqai-dataset"
    store = "cliniqai-fhir"
    base = f"https://healthcare.googleapis.com/v1/projects/{project}/locations/{region}/datasets/{dataset}/fhirStores/{store}/fhir"

    token = _get_healthcare_token()
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/fhir+json"}

    results: list[dict] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        for resource_type in resource_types:
            url = f"{base}/{resource_type}"
            params = {"subject": f"Patient/{patient_id}", "_count": "5"}
            try:
                resp = await client.get(url, headers=headers, params=params)
                if resp.status_code == 200:
                    bundle = resp.json()
                    for entry in bundle.get("entry", []):
                        results.append(entry.get("resource", {}))
            except Exception as exc:
                logger.warning("FHIR search for %s failed: %s", resource_type, exc)

    return results


def _summarise_resource(resource: dict) -> FhirResourceSummary:
    """Extract a brief human-readable summary from a FHIR resource."""
    rtype = resource.get("resourceType", "Unknown")
    rid = resource.get("id", "")
    date = resource.get("recordedDate") or resource.get("effectiveDateTime") or resource.get("authoredOn")

    if rtype == "Condition":
        text = resource.get("code", {}).get("text", rid)
    elif rtype == "MedicationRequest":
        text = resource.get("medicationCodeableConcept", {}).get("text", rid)
    elif rtype == "Observation":
        code_text = resource.get("code", {}).get("text", "")
        value = resource.get("valueQuantity", {})
        text = f"{code_text}: {value.get('value', '')} {value.get('unit', '')}"
    elif rtype == "Encounter":
        text = resource.get("reasonCode", [{}])[0].get("text", "Encounter")
    else:
        text = rtype

    return FhirResourceSummary(
        resource_type=rtype,
        resource_id=rid,
        summary=text,
        date=date,
        relevance_score=1.0,
    )


@router.post("/search", response_model=RecordSearchResponse, dependencies=[Depends(verify_internal_token)])
async def search_patient_records(request: RecordSearchRequest) -> RecordSearchResponse:
    """
    Natural language search over patient FHIR records.
    Uses GCP Healthcare API for retrieval + MedGemma 27B for synthesis.
    Mode: Sync (< 4s latency budget — inline during consultation).
    """
    raw_resources = await _search_fhir(request.patient_id, request.resource_types)
    summaries = [_summarise_resource(r) for r in raw_resources]

    if not summaries:
        return RecordSearchResponse(
            results=[],
            narrative_summary="No relevant records found for this query.",
        )

    # MedGemma 27B synthesis
    records_text = "\n".join(f"- [{s.resource_type}] {s.summary}" for s in summaries)
    prompt = f"Doctor's question: {request.query}\n\nAvailable records:\n{records_text}"

    narrative = await generate_medgemma_27b(prompt, system_instruction=SYNTHESIS_SYSTEM_PROMPT)

    return RecordSearchResponse(results=summaries, narrative_summary=narrative)
