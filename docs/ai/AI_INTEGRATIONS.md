# CliniqAI — AI Integrations

This document covers every Google Health AI integration: what it does, how to set it up, and concrete code examples for the AI service (`services/ai`).

---

## Table of Contents

1. [Overview](#1-overview)
2. [MedGemma — Core Medical LLM](#2-medgemma--core-medical-llm)
3. [MedASR — Voice Transcription](#3-medasr--voice-transcription)
4. [CXR Foundation — Chest X-Ray AI](#4-cxr-foundation--chest-x-ray-ai)
5. [MedSigLIP — Medical Image Analysis](#5-medsiglip--medical-image-analysis)
6. [Vertex AI Search for Healthcare](#6-vertex-ai-search-for-healthcare)
7. [Drug-Drug Interaction (DDI) Alerts](#7-drug-drug-interaction-ddi-alerts)
8. [AI Service Architecture](#8-ai-service-architecture)
9. [Error Handling & Fallbacks](#9-error-handling--fallbacks)
10. [Costs & Rate Limits](#10-costs--rate-limits)

---

## 1. Overview

All AI features live in `services/ai` — a Python FastAPI service. The Core API calls this service internally; it is never exposed directly to clients.

```
services/ai/
├── main.py                  # FastAPI app entrypoint
├── routers/
│   ├── voice.py             # MedASR voice transcription
│   ├── prescription.py      # MedGemma prescription assist
│   ├── ddi.py               # Drug-drug interaction alerts
│   ├── diagnosis.py         # Differential diagnosis hints
│   ├── imaging.py           # CXR + MedSigLIP
│   ├── lab.py               # Lab result interpretation
│   ├── notes.py             # Clinical note summarization
│   ├── search.py            # Vertex AI Healthcare Search
│   └── discharge.py         # Discharge summary drafting
├── clients/
│   ├── medgemma.py          # MedGemma Vertex AI client
│   ├── medasr.py            # MedASR client
│   ├── cxr.py               # CXR Foundation client
│   ├── medsiglip.py         # MedSigLIP client
│   └── healthcare_search.py # Vertex AI Search for Healthcare
├── models/
│   ├── prescription.py      # Pydantic request/response models
│   ├── ddi.py
│   └── imaging.py
├── utils/
│   ├── auth.py              # Internal service auth
│   ├── fhir_reader.py       # Read FHIR resources for AI context
│   └── prompt_builder.py    # Build structured prompts
├── config.py                # Settings (pydantic-settings)
└── requirements.txt
```

---

## 2. MedGemma — Core Medical LLM

MedGemma is the backbone AI for prescription assist, clinical decision support, note summarization, and differential diagnosis.

### 2.1 Setup

**Region note:** MedGemma is currently available only in `us-central1`. Set `VERTEX_AI_LOCATION=us-central1` in the AI service env, regardless of your primary GCP region.

```bash
# Ensure MedGemma access is enabled in Vertex AI Model Garden
# Console: https://console.cloud.google.com/vertex-ai/model-garden
# Search "MedGemma" → Enable

# Authenticate locally
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

Install dependencies:
```bash
pip install google-cloud-aiplatform>=1.60.0 vertexai
```

### 2.2 Client Setup (`clients/medgemma.py`)

```python
import vertexai
from vertexai.generative_models import GenerativeModel, Part, SafetySetting, HarmCategory
from google.auth import default
from functools import lru_cache
from config import settings

@lru_cache(maxsize=1)
def get_medgemma_4b() -> GenerativeModel:
    vertexai.init(
        project=settings.GOOGLE_CLOUD_PROJECT_ID,
        location=settings.VERTEX_AI_LOCATION,  # us-central1
    )
    return GenerativeModel(
        model_name="medgemma-4b-it",
        safety_settings=[
            # Medical content — allow clinical information
            SafetySetting(
                category=HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=SafetySetting.HarmBlockThreshold.BLOCK_ONLY_HIGH,
            ),
        ],
        system_instruction="""You are a clinical AI assistant supporting licensed doctors
        in India. You provide structured, evidence-based clinical information.
        You never make final diagnoses — you support the doctor's decision-making.
        Always respond in valid JSON when asked. Be concise and clinically precise."""
    )

@lru_cache(maxsize=1)
def get_medgemma_27b() -> GenerativeModel:
    vertexai.init(
        project=settings.GOOGLE_CLOUD_PROJECT_ID,
        location=settings.VERTEX_AI_LOCATION,
    )
    return GenerativeModel(
        model_name="medgemma-27b-it",
        system_instruction="""You are a senior clinical AI assistant supporting licensed
        doctors. Provide detailed, nuanced clinical reasoning. Always respond in valid JSON.
        Prioritize patient safety in all recommendations."""
    )
```

### 2.3 Prescription Assist (`routers/prescription.py`)

**Input:** Chief complaint, patient history summary, doctor's specialty
**Output:** Structured JSON with suggested diagnoses and medications

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from clients.medgemma import get_medgemma_4b
from utils.auth import verify_internal_token

router = APIRouter(prefix="/prescription", tags=["prescription"])

class PrescriptionAssistRequest(BaseModel):
    chief_complaint: str
    patient_history_summary: Optional[str] = None
    allergies: list[str] = []
    current_medications: list[str] = []
    doctor_specialty: str = "general_physician"
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None

class SuggestedMedication(BaseModel):
    name: str
    generic_name: str
    dosage: str
    frequency: str
    duration: str
    route: str
    instructions: str

class PrescriptionAssistResponse(BaseModel):
    suggested_diagnoses: list[dict]
    suggested_medications: list[SuggestedMedication]
    clinical_notes: str
    follow_up_advice: str
    red_flags: list[str]
    confidence: float

@router.post("/assist", response_model=PrescriptionAssistResponse)
async def prescription_assist(
    req: PrescriptionAssistRequest,
    _: None = Depends(verify_internal_token)
):
    model = get_medgemma_4b()

    prompt = f"""
Patient consultation data:
- Chief Complaint: {req.chief_complaint}
- Age: {req.patient_age or 'Unknown'}, Gender: {req.patient_gender or 'Unknown'}
- Specialty: {req.doctor_specialty}
- Known Allergies: {', '.join(req.allergies) or 'None'}
- Current Medications: {', '.join(req.current_medications) or 'None'}
- Relevant History: {req.patient_history_summary or 'None provided'}

Provide clinical decision support in this exact JSON format:
{{
  "suggested_diagnoses": [
    {{"icd10": "J06.9", "name": "...", "probability": "high|moderate|low", "reasoning": "..."}}
  ],
  "suggested_medications": [
    {{
      "name": "...", "generic_name": "...", "dosage": "...",
      "frequency": "...", "duration": "...", "route": "oral",
      "instructions": "..."
    }}
  ],
  "clinical_notes": "...",
  "follow_up_advice": "...",
  "red_flags": ["..."],
  "confidence": 0.85
}}

Important: Check for contraindications against known allergies and current medications.
The doctor will review and modify all suggestions before prescribing.
"""

    response = await model.generate_content_async(
        prompt,
        generation_config={"temperature": 0.1, "max_output_tokens": 1024}
    )

    import json
    result = json.loads(response.text.strip().strip("```json").strip("```"))
    return PrescriptionAssistResponse(**result)
```

### 2.4 Differential Diagnosis (`routers/diagnosis.py`)

Uses MedGemma 27B for more nuanced reasoning.

```python
class DiagnosisRequest(BaseModel):
    symptoms: list[str]
    duration_days: Optional[int] = None
    vitals: Optional[dict] = None          # {"bp": "128/82", "temp": "99.1F", "spo2": "98%"}
    lab_findings: Optional[str] = None
    patient_age: int
    patient_gender: str
    comorbidities: list[str] = []
    doctor_specialty: str

@router.post("/suggest")
async def suggest_diagnosis(req: DiagnosisRequest, _=Depends(verify_internal_token)):
    model = get_medgemma_27b()
    # Build prompt → returns top 5 differential diagnoses with ICD-10 codes,
    # probability, key distinguishing features, and suggested investigations
    ...
```

### 2.5 Clinical Note Summarization (`routers/notes.py`)

```python
@router.post("/summarize")
async def summarize_notes(
    patient_fhir_id: str,
    context_window_days: int = 90,
    _=Depends(verify_internal_token)
):
    """Fetch last N days of FHIR records and summarize into a pre-consultation brief."""
    from utils.fhir_reader import get_patient_history_bundle

    # 1. Fetch FHIR resources
    history = await get_patient_history_bundle(patient_fhir_id, context_window_days)

    # 2. Summarize with MedGemma 27B
    model = get_medgemma_27b()
    prompt = f"""
Summarize this patient's recent medical history for a doctor's pre-consultation review.
Patient history (FHIR data):
{history}

Provide a structured summary:
{{
  "active_conditions": [...],
  "current_medications": [...],
  "recent_investigations": [...],
  "allergies": [...],
  "key_clinical_points": "...",
  "points_to_address": [...]
}}
"""
    response = await model.generate_content_async(prompt)
    return json.loads(response.text)
```

---

## 3. MedASR — Voice Transcription

MedASR is Google's medical speech recognition model, optimized for clinical terminology.

### 3.1 Setup

```bash
pip install google-cloud-speech
```

MedASR is accessed via the Health AI Developer Foundations API, not standard Cloud Speech-to-Text.

### 3.2 Voice-to-Prescription Flow (`routers/voice.py`)

```python
import asyncio
from fastapi import APIRouter, UploadFile, File
from google.cloud import speech_v1 as speech
from clients.medgemma import get_medgemma_4b

router = APIRouter(prefix="/voice", tags=["voice"])

@router.post("/transcribe")
async def transcribe_and_structure(
    audio: UploadFile = File(...),
    specialty: str = "general_physician",
    language: str = "en-IN",
    _=Depends(verify_internal_token)
):
    """
    1. Transcribe doctor's voice using MedASR
    2. Pass transcript to MedGemma to structure into prescription JSON
    """
    # Step 1: Transcribe with MedASR
    audio_content = await audio.read()
    transcript = await transcribe_audio(audio_content, language)

    # Step 2: Structure with MedGemma 4B
    structured_rx = await structure_transcript(transcript, specialty)

    return {
        "transcript": transcript,
        "structured_prescription": structured_rx
    }

async def transcribe_audio(audio_bytes: bytes, language: str) -> str:
    client = speech.SpeechAsyncClient()

    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        sample_rate_hertz=16000,
        language_code=language,
        # MedASR-specific: enable medical vocabulary boosting
        speech_contexts=[
            speech.SpeechContext(
                phrases=MEDICAL_VOCABULARY_HINTS,  # Pre-loaded drug/condition names
                boost=20.0
            )
        ],
        enable_automatic_punctuation=True,
        model="medical_dictation",   # MedASR medical model variant
    )

    audio = speech.RecognitionAudio(content=audio_bytes)
    response = await client.recognize(config=config, audio=audio)

    return " ".join(
        result.alternatives[0].transcript
        for result in response.results
    )

async def structure_transcript(transcript: str, specialty: str) -> dict:
    model = get_medgemma_4b()
    prompt = f"""
A doctor ({specialty}) dictated this consultation note:
"{transcript}"

Extract and structure this into a prescription JSON:
{{
  "chief_complaint": "...",
  "diagnosis": [{{"name": "...", "icd10": "..."}}],
  "medications": [
    {{
      "name": "...", "dosage": "...", "frequency": "...",
      "duration": "...", "route": "...", "instructions": "..."
    }}
  ],
  "investigations_ordered": [...],
  "follow_up": "...",
  "doctor_notes": "..."
}}
Only include fields that were mentioned. Do not infer information not present.
"""
    response = await model.generate_content_async(
        prompt,
        generation_config={"temperature": 0.05, "max_output_tokens": 1024}
    )
    return json.loads(response.text)
```

### 3.3 Streaming Transcription (WebSocket)

For real-time streaming during consultation, use WebSocket endpoint:

```python
from fastapi import WebSocket
from google.cloud.speech_v1 import SpeechAsyncClient

@router.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """
    Client sends audio chunks, server streams back transcript tokens.
    Used for live voice-to-text during consultation.
    """
    await websocket.accept()
    # Stream audio chunks → Google Streaming Recognition → send transcript back
    ...
```

---

## 4. CXR Foundation — Chest X-Ray AI

### 4.1 What It Does

The Google CXR Foundation Model generates embeddings from chest X-ray images. CliniqAI uses it to:
- Classify common findings (consolidation, effusion, cardiomegaly, etc.)
- Generate a preliminary radiology note
- Serve as a **screening aid** — never a diagnostic replacement

> **Disclaimer displayed to doctors:** "AI-generated screening aid only. Must be reviewed by a qualified radiologist or physician before clinical action."

### 4.2 Setup

CXR Foundation is available via Google Cloud MedLM Embedding API:

```bash
pip install google-cloud-aiplatform requests pillow
```

```bash
# Enable MedLM APIs in your project
gcloud services enable aiplatform.googleapis.com

# CXR endpoint — get from Health AI Developer Foundations console
# https://developers.google.com/health-ai-developer-foundations/cxr-foundation
```

### 4.3 X-Ray Analysis (`routers/imaging.py`)

```python
import base64
from PIL import Image
import io
import numpy as np
from fastapi import APIRouter, UploadFile, File
from google.cloud import aiplatform

router = APIRouter(prefix="/imaging", tags=["imaging"])

CXR_FINDINGS = [
    "Consolidation", "Pleural Effusion", "Pneumothorax",
    "Cardiomegaly", "Atelectasis", "Nodule", "Infiltrate",
    "Pulmonary Edema", "Normal"
]

@router.post("/cxr")
async def analyze_chest_xray(
    image: UploadFile = File(...),
    patient_age: Optional[int] = None,
    clinical_context: Optional[str] = None,
    _=Depends(verify_internal_token)
):
    """
    Analyze a chest X-ray image and return preliminary findings.
    """
    # 1. Load and preprocess image
    img_bytes = await image.read()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img_resized = img.resize((224, 224))

    # 2. Get CXR Foundation embeddings
    embeddings = await get_cxr_embeddings(img_resized)

    # 3. Classify findings using zero-shot text prompts
    findings = await classify_findings(embeddings)

    # 4. Generate narrative report using MedGemma
    report = await generate_cxr_report(findings, patient_age, clinical_context)

    return {
        "findings": findings,
        "preliminary_report": report,
        "disclaimer": "AI-generated screening aid. Must be reviewed by a qualified physician.",
        "confidence_note": "Confidence scores are approximate. Not for standalone diagnosis."
    }

async def get_cxr_embeddings(image: Image.Image) -> np.ndarray:
    """Call CXR Foundation Model API to get image embeddings."""
    # Convert to base64
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    img_b64 = base64.b64encode(buffer.getvalue()).decode()

    endpoint = aiplatform.Endpoint(settings.CXR_MODEL_ENDPOINT)
    response = endpoint.predict(instances=[{"image_bytes": img_b64}])
    return np.array(response.predictions[0]["embedding"])

async def classify_findings(embeddings: np.ndarray) -> list[dict]:
    """Zero-shot classification using text embeddings for each finding."""
    results = []
    for finding in CXR_FINDINGS:
        # Compare image embedding similarity to text embedding for each finding
        # Returns probability score for each finding
        ...
    return sorted(results, key=lambda x: x["confidence"], reverse=True)

async def generate_cxr_report(
    findings: list[dict],
    age: Optional[int],
    context: Optional[str]
) -> str:
    """Use MedGemma 4B to generate a narrative report from findings."""
    model = get_medgemma_4b()
    findings_text = "\n".join(
        f"- {f['finding']}: {f['confidence']:.0%} confidence"
        for f in findings if f["confidence"] > 0.3
    )
    prompt = f"""
Chest X-ray AI analysis findings:
{findings_text}
Patient age: {age or 'Unknown'}
Clinical context: {context or 'None provided'}

Write a brief preliminary radiology observation (2-3 sentences) suitable for a GP clinic.
Note: This is AI-assisted screening only, not a formal radiology report.
"""
    response = await model.generate_content_async(
        prompt,
        generation_config={"temperature": 0.2, "max_output_tokens": 256}
    )
    return response.text
```

---

## 5. MedSigLIP — Medical Image Analysis

Used for dermatology photos, wound images, and other clinical photos (not radiology).

### 5.1 Use Cases

- Dermatology: skin lesion screening (not diagnosis)
- Wound care: wound size estimation, healing assessment documentation
- Eye photos: basic screening

### 5.2 Usage

```python
@router.post("/analyze")
async def analyze_medical_image(
    image: UploadFile = File(...),
    image_type: str = "dermatology",   # dermatology | wound | eye | other
    clinical_notes: Optional[str] = None,
    _=Depends(verify_internal_token)
):
    """
    General medical image analysis using MedSigLIP.
    Returns observations to support the doctor's assessment.
    """
    img_bytes = await image.read()

    # Use MedGemma 4B multimodal with the image
    model = get_medgemma_4b()

    img_part = Part.from_data(data=img_bytes, mime_type=image.content_type)

    prompt = f"""
You are assisting a doctor reviewing a {image_type} image.
Clinical notes: {clinical_notes or 'None provided'}

Describe what you observe in this medical image objectively.
Focus on: location, size (if estimable), color, texture, boundaries, and any notable features.
Do NOT provide a diagnosis. Provide observations only.

Format as JSON:
{{
  "observations": ["..."],
  "notable_features": ["..."],
  "suggested_documentation": "...",
  "recommendation": "refer_specialist | monitor | document_only"
}}
"""
    response = await model.generate_content_async([img_part, prompt])
    return json.loads(response.text)
```

---

## 6. Vertex AI Search for Healthcare

Enables natural language search over the patient's FHIR records.

### 6.1 Setup

```bash
# Enable Vertex AI Search for Healthcare in GCP Console
# This requires allowlisting — submit request at:
# https://cloud.google.com/generative-ai-app-builder/docs/search-hc-data

pip install google-cloud-discoveryengine
```

### 6.2 Patient Record Search (`routers/search.py`)

```python
from google.cloud import discoveryengine_v1 as discoveryengine

@router.post("/records/search")
async def search_patient_records(
    query: str,
    patient_fhir_id: str,
    max_results: int = 5,
    _=Depends(verify_internal_token)
):
    """
    Natural language search over a patient's FHIR records.
    Example queries:
    - "Does this patient have a history of hypertension?"
    - "What was the last HbA1c result?"
    - "List all medications prescribed in the last 6 months"
    """
    client = discoveryengine.SearchServiceAsyncClient()

    # Filter search to specific patient's resources
    filter_expr = f'patient_id: "{patient_fhir_id}"'

    request = discoveryengine.SearchRequest(
        serving_config=settings.VERTEX_HEALTHCARE_SEARCH_CONFIG,
        query=query,
        filter=filter_expr,
        page_size=max_results,
        content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
            extractive_content_spec=discoveryengine.SearchRequest.ContentSearchSpec.ExtractiveContentSpec(
                max_extractive_answer_count=3,
                max_extractive_segment_count=3,
            ),
            summary_spec=discoveryengine.SearchRequest.ContentSearchSpec.SummarySpec(
                summary_result_count=3,
                include_citations=True,
            )
        )
    )

    response = await client.search(request)

    # Use MedGemma to synthesize a plain-language answer from search results
    raw_results = [result.document.derived_struct_data for result in response.results]
    summary = await synthesize_search_results(query, raw_results)

    return {
        "query": query,
        "answer": summary,
        "sources": raw_results[:max_results]
    }

async def synthesize_search_results(query: str, results: list) -> str:
    model = get_medgemma_27b()
    prompt = f"""
Doctor's query: "{query}"
Relevant patient records found:
{json.dumps(results, indent=2)[:3000]}

Answer the doctor's query concisely and accurately based only on the records provided.
If the information is not in the records, state "Not found in available records."
"""
    response = await model.generate_content_async(
        prompt,
        generation_config={"temperature": 0.1, "max_output_tokens": 512}
    )
    return response.text
```

---

## 7. Drug-Drug Interaction (DDI) Alerts

Real-time alerts when a doctor adds a medication that interacts with current medications.

### 7.1 Data Sources

DDI data comes from two layers (in order of preference):
1. **MedGemma 4B** — semantic reasoning about interactions for complex/novel cases
2. **Local DDI database** — pre-loaded from OpenFDA Drug Interaction data, stored in PostgreSQL for speed

### 7.2 DDI Check (`routers/ddi.py`)

```python
class DDICheckRequest(BaseModel):
    new_medication: str
    current_medications: list[str]
    patient_allergies: list[str] = []
    patient_conditions: list[str] = []   # e.g. ["renal impairment", "hepatic dysfunction"]

class DDIAlert(BaseModel):
    severity: str                         # critical | major | moderate | minor
    drug_a: str
    drug_b: str
    interaction: str
    mechanism: str
    clinical_effect: str
    management: str

@router.post("/check")
async def check_drug_interactions(
    req: DDICheckRequest,
    _=Depends(verify_internal_token)
):
    """
    Fast DDI check — DB lookup first (< 100ms), MedGemma fallback for complex cases.
    """
    alerts = []

    # Layer 1: Fast local DB lookup
    db_alerts = await check_ddi_database(req.new_medication, req.current_medications)
    alerts.extend(db_alerts)

    # Layer 2: MedGemma for patient-context-specific risks
    # (Only if patient has comorbidities or complex polypharmacy)
    if req.patient_conditions or len(req.current_medications) > 5:
        ai_alerts = await check_ddi_with_ai(req)
        # Merge, deduplicate
        for alert in ai_alerts:
            if not any(a.drug_b == alert.drug_b for a in alerts):
                alerts.append(alert)

    # Check allergies separately
    allergy_alerts = check_allergy_conflicts(req.new_medication, req.patient_allergies)

    return {
        "new_medication": req.new_medication,
        "ddi_alerts": [a.dict() for a in alerts],
        "allergy_alerts": allergy_alerts,
        "has_critical": any(a.severity == "critical" for a in alerts),
        "safe_to_prescribe": len([a for a in alerts if a.severity == "critical"]) == 0
    }

async def check_ddi_with_ai(req: DDICheckRequest) -> list[DDIAlert]:
    model = get_medgemma_4b()
    prompt = f"""
Check for drug interactions and contraindications:

New medication: {req.new_medication}
Current medications: {', '.join(req.current_medications)}
Patient conditions: {', '.join(req.patient_conditions)}

List any significant interactions as JSON array:
[{{
  "severity": "critical|major|moderate|minor",
  "drug_a": "...",
  "drug_b": "...",
  "interaction": "...",
  "mechanism": "...",
  "clinical_effect": "...",
  "management": "..."
}}]

Only include interactions with moderate severity or higher.
Return empty array [] if no significant interactions found.
"""
    response = await model.generate_content_async(
        prompt,
        generation_config={"temperature": 0.05, "max_output_tokens": 512}
    )
    raw = json.loads(response.text)
    return [DDIAlert(**item) for item in raw]
```

---

## 8. AI Service Architecture

### 8.1 FastAPI App Entrypoint (`main.py`)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routers import voice, prescription, ddi, diagnosis, imaging, lab, notes, search, discharge
from config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up model connections on startup
    from clients.medgemma import get_medgemma_4b, get_medgemma_27b
    get_medgemma_4b()    # Initialize cached client
    get_medgemma_27b()
    yield

app = FastAPI(
    title="CliniqAI — AI Service",
    description="Internal AI service for CliniqAI platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
)

# Only accept requests from Core API (internal network)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://api:3001"],  # Internal only
    allow_methods=["POST"],
)

app.include_router(voice.router)
app.include_router(prescription.router)
app.include_router(ddi.router)
app.include_router(diagnosis.router)
app.include_router(imaging.router)
app.include_router(lab.router)
app.include_router(notes.router)
app.include_router(search.router)
app.include_router(discharge.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 8.2 Internal Auth Middleware (`utils/auth.py`)

```python
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader
from config import settings

api_key_header = APIKeyHeader(name="X-Internal-Token")

async def verify_internal_token(api_key: str = Security(api_key_header)):
    if api_key != settings.INTERNAL_API_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid internal token")
```

### 8.3 FHIR Reader for AI Context (`utils/fhir_reader.py`)

```python
import httpx
from config import settings

async def get_patient_history_bundle(fhir_patient_id: str, days: int = 90) -> dict:
    """
    Fetch recent FHIR resources for a patient to provide context to AI models.
    Returns a structured dict — NOT raw FHIR JSON — for prompt readability.
    """
    async with httpx.AsyncClient() as client:
        # Fetch via Core API (which handles FHIR auth)
        resp = await client.get(
            f"{settings.CORE_API_URL}/internal/fhir/patient-context/{fhir_patient_id}",
            params={"days": days},
            headers={"X-Internal-Token": settings.INTERNAL_API_TOKEN}
        )
        resp.raise_for_status()
        return resp.json()
```

---

## 9. Error Handling & Fallbacks

| Scenario | Fallback Behavior |
|----------|------------------|
| MedGemma times out (> 5s) | Return empty suggestions, let doctor fill manually |
| MedASR transcription fails | Return raw audio transcript from standard Cloud Speech |
| CXR Foundation unavailable | Return "AI analysis unavailable — manual review required" |
| DDI AI call fails | Use local DDI database only; log to Sentry |
| Vertex AI Search unavailable | Fall back to FHIR API direct search with keyword matching |
| MedGemma returns invalid JSON | Retry once with explicit JSON instruction; if fails, return structured error |

All fallbacks are logged with tag `ai.fallback` and include the original error.

```python
# Example fallback pattern
async def safe_prescription_assist(req) -> Optional[PrescriptionAssistResponse]:
    try:
        return await prescription_assist(req)
    except Exception as e:
        sentry_sdk.capture_exception(e, tags={"ai.fallback": "prescription_assist"})
        return None   # Core API handles None → empty template shown to doctor
```

---

## 10. Costs & Rate Limits

### MedGemma Pricing (Vertex AI, approximate)

| Model | Input | Output |
|-------|-------|--------|
| medgemma-4b-it | $0.00015/1K tokens | $0.0006/1K tokens |
| medgemma-27b-it | $0.00075/1K tokens | $0.003/1K tokens |

**Per-consultation AI cost estimate:**
- DDI check (4B): ~500 tokens → ~$0.0004
- Prescription assist (4B): ~1,000 tokens → ~$0.0008
- Diagnosis hints (27B, optional): ~2,000 tokens → ~$0.009
- Notes summary (27B, pre-consultation): ~3,000 tokens → ~$0.011

Estimated total AI cost per consultation: **$0.02–$0.03** (~₹1.7–₹2.5)

### Rate Limits

| Endpoint | Rate Limit | Notes |
|----------|-----------|-------|
| `/prescription/assist` | 60/min per clinic | Covers busy clinic days |
| `/voice/transcribe` | 30/min per doctor | Limited by audio processing |
| `/ddi/check` | 120/min per clinic | Must be fast for real-time use |
| `/imaging/cxr` | 10/min per clinic | Compute-intensive |
| `/records/search` | 60/min per doctor | Vertex AI Search limits |

Rate limiting implemented via Redis in the Core API before requests reach the AI service.

---

*Last updated: Phase 1 setup*
*See [API.md](../api/API.md) for how the Core API calls these AI endpoints.*
