import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

# Set test environment before importing app
os.environ["ENVIRONMENT"] = "test"
os.environ["AI_INTERNAL_TOKEN"] = "test-token"


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
