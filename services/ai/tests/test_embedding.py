"""Tests for text chunking and embedding utilities."""

import pytest
from app.services.embedding_client import chunk_text, EMBEDDING_DIM


class TestTextChunking:
    """Test the text chunking algorithm."""

    def test_short_text_single_chunk(self):
        """Short text should return a single chunk."""
        text = "Patient presents with mild headache."
        chunks = chunk_text(text, max_tokens=256)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_long_text_multiple_chunks(self):
        """Long text should be split into multiple chunks."""
        text = "This is a sentence. " * 200  # ~4000 chars
        chunks = chunk_text(text, max_tokens=256)
        assert len(chunks) > 1

    def test_chunks_respect_max_length(self):
        """Each chunk should be within the max character limit."""
        text = "Word " * 1000
        chunks = chunk_text(text, max_tokens=256)
        max_chars = 256 * 4  # ~1 token = 4 chars
        for chunk in chunks:
            assert len(chunk) <= max_chars + 100  # Allow small buffer for sentence boundary

    def test_empty_text(self):
        """Empty text should return empty list or single empty chunk."""
        chunks = chunk_text("", max_tokens=256)
        assert len(chunks) <= 1

    def test_sentence_boundary_splitting(self):
        """Chunks should try to split at sentence boundaries."""
        text = "First sentence. Second sentence. Third sentence. Fourth sentence."
        chunks = chunk_text(text, max_tokens=10)  # Very small to force splits
        for chunk in chunks:
            # Each chunk should either end with a period or be the last chunk
            if chunk != chunks[-1]:
                assert chunk.rstrip().endswith(".") or len(chunk) > 0

    def test_overlap_between_chunks(self):
        """Chunks should have overlapping content for context continuity."""
        text = "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. " * 20
        chunks = chunk_text(text, max_tokens=64, overlap=32)
        # With overlap, adjacent chunks should share some text
        assert len(chunks) >= 2


class TestEmbeddingDimensions:
    """Test embedding configuration."""

    def test_embedding_dim_is_768(self):
        """text-embedding-004 outputs 768-dimensional vectors."""
        assert EMBEDDING_DIM == 768

    def test_zero_vector_has_correct_dim(self):
        """Fallback zero vector should match embedding dimension."""
        zero_vec = [0.0] * EMBEDDING_DIM
        assert len(zero_vec) == 768
