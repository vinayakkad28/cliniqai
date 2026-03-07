from __future__ import annotations

import base64
import logging

import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from google.generativeai import types as genai_types
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth import verify_internal_token
from app.services.vertex_client import generate_json_medgemma_4b

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["voice"])

VOICE_STRUCTURE_PROMPT = """You are a clinical AI assistant. The following is a transcription of a doctor's
voice dictation for a prescription. Extract structured medication orders.
Return ONLY a valid JSON object:
{
  "medications": [
    {
      "drug": "Drug name",
      "dose": "e.g. 500mg",
      "frequency": "e.g. Twice daily",
      "duration": "e.g. 5 days",
      "route": "e.g. Oral"
    }
  ],
  "additional_instructions": "Any other instructions mentioned"
}"""


class TranscribeResponse(BaseModel):
    transcript: str
    structured: dict
    confidence: float


class StructureRequest(BaseModel):
    transcript: str


class MedicationItem(BaseModel):
    drug: str
    dose: str
    frequency: str
    duration: str
    route: str = "oral"
    additional_instructions: str = ""


class StructureResponse(BaseModel):
    medications: list[MedicationItem]
    additional_instructions: str = ""


@router.post("/structure", response_model=StructureResponse, dependencies=[Depends(verify_internal_token)])
async def structure_transcript(request: StructureRequest) -> StructureResponse:
    """
    Structure a text transcript (from Web Speech API or manual) into medication objects.
    Uses MedGemma 4B to parse natural language prescription dictation.
    """
    result = await generate_json_medgemma_4b(
        request.transcript,
        system_instruction=VOICE_STRUCTURE_PROMPT,
    )

    medications = [
        MedicationItem(
            drug=m.get("drug", ""),
            dose=m.get("dose", ""),
            frequency=m.get("frequency", ""),
            duration=m.get("duration", ""),
            route=m.get("route", "oral"),
            additional_instructions=m.get("additional_instructions", ""),
        )
        for m in result.get("medications", [])
    ]

    return StructureResponse(
        medications=medications,
        additional_instructions=result.get("additional_instructions", ""),
    )


@router.post("/transcribe", response_model=TranscribeResponse, dependencies=[Depends(verify_internal_token)])
async def transcribe_voice(audio: UploadFile = File(...)) -> TranscribeResponse:
    """
    Transcribe audio → structured prescription JSON.
    Pipeline: audio bytes → Gemini Flash 2.0 multimodal → transcript → MedGemma 4B → structured JSON.
    """
    if not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/webm"

    try:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        audio_part = genai_types.Part(
            inline_data=genai_types.Blob(
                mime_type=mime_type,
                data=base64.b64encode(audio_bytes).decode("utf-8"),
            )
        )
        prompt_part = genai_types.Part(
            text=(
                "Transcribe this medical voice dictation exactly as spoken. "
                "The doctor is dictating a prescription. Return only the transcribed text."
            )
        )
        response = model.generate_content([audio_part, prompt_part])
        transcript = response.text.strip()
    except Exception as exc:
        logger.error("Gemini audio transcription failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Audio transcription failed: {exc}") from exc

    # Pipe transcript through existing structure logic
    structured = await generate_json_medgemma_4b(transcript, system_instruction=VOICE_STRUCTURE_PROMPT)

    return TranscribeResponse(
        transcript=transcript,
        structured=structured,
        confidence=0.9,
    )
