"""Shared test fixtures for CliniqAI AI service tests."""

import os
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings

# Set test environment before importing app
os.environ["ENVIRONMENT"] = "test"
os.environ["AI_INTERNAL_TOKEN"] = "test-token"


@pytest.fixture
def mock_settings():
    """Override settings for testing."""
    return Settings(
        environment="test",
        internal_token="test-internal-token",
        gemini_backend="gemini_api",
        gemini_api_key="test-api-key",
        port=8001,
    )


@pytest.fixture
def mock_vertex_client():
    """Mock the Vertex AI client to avoid real API calls."""
    with patch("app.services.vertex_client.generate_content", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = '{"result": "mocked"}'
        yield mock_gen


@pytest.fixture
def mock_embedding_client():
    """Mock the embedding client."""
    with patch("app.services.embedding_client.embed_text", new_callable=AsyncMock) as mock_embed:
        mock_embed.return_value = [0.1] * 768
        yield mock_embed


@pytest.fixture
def mock_medgemma_4b():
    """Mock MedGemma 4B model responses."""
    with patch("app.services.vertex_client.generate_medgemma_4b", new_callable=AsyncMock) as mock:
        yield mock


@pytest.fixture
def mock_medgemma_27b():
    """Mock MedGemma 27B model responses."""
    with patch("app.services.vertex_client.generate_medgemma_27b", new_callable=AsyncMock) as mock:
        yield mock


@pytest.fixture
def mock_json_medgemma_4b():
    """Mock MedGemma 4B JSON responses."""
    with patch("app.services.vertex_client.generate_json_medgemma_4b", new_callable=AsyncMock) as mock:
        yield mock


@pytest.fixture
def mock_json_medgemma_27b():
    """Mock MedGemma 27B JSON responses."""
    with patch("app.services.vertex_client.generate_json_medgemma_27b", new_callable=AsyncMock) as mock:
        yield mock


@pytest.fixture
async def client():
    """Create async test client for the FastAPI app."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def auth_headers():
    """Headers with valid internal auth token."""
    return {"X-Internal-Token": "test-token"}


@pytest.fixture
def sample_vitals():
    """Sample patient vitals for testing."""
    return {
        "blood_pressure_systolic": 120,
        "blood_pressure_diastolic": 80,
        "heart_rate": 72,
        "temperature": 37.0,
        "respiratory_rate": 16,
        "spo2": 98,
    }


@pytest.fixture
def sample_medications():
    """Sample medication list for testing."""
    return [
        {"drug": "Metformin", "dose": "500mg", "frequency": "twice daily"},
        {"drug": "Amlodipine", "dose": "5mg", "frequency": "once daily"},
        {"drug": "Atorvastatin", "dose": "10mg", "frequency": "once daily at night"},
    ]


@pytest.fixture
def sample_lab_results():
    """Sample lab results for testing."""
    return [
        {"name": "Hemoglobin", "value": "14.2", "unit": "g/dL", "reference_range": "13.0-17.0", "flag": "normal"},
        {"name": "Blood Glucose (Fasting)", "value": "142", "unit": "mg/dL", "reference_range": "70-100", "flag": "high"},
        {"name": "Creatinine", "value": "1.1", "unit": "mg/dL", "reference_range": "0.7-1.3", "flag": "normal"},
        {"name": "HbA1c", "value": "7.2", "unit": "%", "reference_range": "4.0-5.6", "flag": "high"},
    ]
