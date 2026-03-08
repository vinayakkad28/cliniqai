"""Shared test fixtures for CliniqAI AI service tests."""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.config import Settings


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
def auth_headers():
    """Valid authentication headers."""
    return {"X-Internal-Token": "test-internal-token"}


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
