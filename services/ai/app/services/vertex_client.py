"""
AI inference client — dual backend.

GEMINI_BACKEND=gemini_api  → Google AI Studio (free tier, no GCP needed) [DEFAULT]
GEMINI_BACKEND=vertex_ai   → Vertex AI MedGemma (switch when you have 50+ doctors)

Zero code changes needed elsewhere — same function signatures throughout.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

# ─── Gemini API backend (cheap/free) ─────────────────────────────────────────

_gemini_genai = None


def _get_genai():
    global _gemini_genai
    if _gemini_genai is None:
        import google.generativeai as genai  # type: ignore[import]
        genai.configure(api_key=settings.gemini_api_key)
        _gemini_genai = genai
    return _gemini_genai


async def _call_gemini(
    prompt: str,
    system_instruction: str | None,
    temperature: float,
    max_output_tokens: int,
    model_name: str,
) -> str:
    genai = _get_genai()
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_instruction,
        generation_config=genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        ),
    )
    response = model.generate_content(prompt)
    return response.text


# ─── Vertex AI backend (upgrade path to MedGemma) ────────────────────────────

_vertex_initialized = False


def _init_vertex() -> None:
    global _vertex_initialized
    if not _vertex_initialized:
        import vertexai  # type: ignore[import]
        vertexai.init(project=settings.google_cloud_project_id, location=settings.vertex_ai_location)
        _vertex_initialized = True


async def _call_vertex(
    prompt: str,
    system_instruction: str | None,
    temperature: float,
    max_output_tokens: int,
    model_endpoint: str,
) -> str:
    from vertexai.generative_models import GenerativeModel, GenerationConfig  # type: ignore[import]
    _init_vertex()
    model = GenerativeModel(model_endpoint)
    config = GenerationConfig(temperature=temperature, max_output_tokens=max_output_tokens)
    full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
    response = model.generate_content(full_prompt, generation_config=config)
    return response.text


def _use_vertex() -> bool:
    return settings.gemini_backend == "vertex_ai"


# ─── Public API — identical signatures, zero changes to callers ───────────────

async def generate_medgemma_4b(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = 0.2,
    max_output_tokens: int = 2048,
) -> str:
    if _use_vertex():
        return await _call_vertex(prompt, system_instruction, temperature, max_output_tokens, settings.medgemma_4b_endpoint)
    return await _call_gemini(prompt, system_instruction, temperature, max_output_tokens, "gemini-1.5-flash")


async def generate_medgemma_27b(
    prompt: str,
    system_instruction: str | None = None,
    temperature: float = 0.3,
    max_output_tokens: int = 4096,
) -> str:
    if _use_vertex():
        return await _call_vertex(prompt, system_instruction, temperature, max_output_tokens, settings.medgemma_27b_endpoint)
    return await _call_gemini(prompt, system_instruction, temperature, max_output_tokens, "gemini-1.5-pro")


async def generate_json_medgemma_4b(
    prompt: str,
    system_instruction: str | None = None,
) -> dict[str, Any]:
    raw = await generate_medgemma_4b(prompt, system_instruction)
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:-1])
    return json.loads(cleaned)


async def generate_json_medgemma_27b(
    prompt: str,
    system_instruction: str | None = None,
) -> dict[str, Any]:
    raw = await generate_medgemma_27b(prompt, system_instruction)
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:-1])
    return json.loads(cleaned)
