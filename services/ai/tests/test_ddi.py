"""Tests for Drug-Drug Interaction checking."""

import pytest
from app.services.ddi_fallback import check_interactions_local


class TestDDIFallback:
    """Test local SQLite DDI fallback database."""

    def test_known_major_interaction(self):
        """Warfarin + Aspirin should flag as major interaction."""
        alerts = check_interactions_local(["warfarin", "aspirin"])
        major_alerts = [a for a in alerts if a.severity == "major"]
        assert len(major_alerts) >= 1
        assert any("warfarin" in a.drug_a.lower() or "warfarin" in a.drug_b.lower() for a in alerts)

    def test_no_interaction(self):
        """Paracetamol + Amoxicillin should not flag (not in DB)."""
        alerts = check_interactions_local(["paracetamol", "amoxicillin"])
        assert len(alerts) == 0

    def test_case_insensitive(self):
        """Drug names should be matched case-insensitively."""
        alerts_lower = check_interactions_local(["warfarin", "aspirin"])
        alerts_upper = check_interactions_local(["WARFARIN", "ASPIRIN"])
        assert len(alerts_lower) == len(alerts_upper)

    def test_single_drug_no_interaction(self):
        """Single drug should have no interactions."""
        alerts = check_interactions_local(["metformin"])
        assert len(alerts) == 0

    def test_empty_drug_list(self):
        """Empty drug list should return empty alerts."""
        alerts = check_interactions_local([])
        assert len(alerts) == 0

    def test_multiple_interactions(self):
        """Multiple interacting drugs should return all alerts."""
        alerts = check_interactions_local(["warfarin", "aspirin", "fluconazole"])
        assert len(alerts) >= 2  # warfarin-aspirin + warfarin-fluconazole

    def test_bidirectional_check(self):
        """Order of drugs should not matter."""
        alerts_ab = check_interactions_local(["warfarin", "aspirin"])
        alerts_ba = check_interactions_local(["aspirin", "warfarin"])
        assert len(alerts_ab) == len(alerts_ba)


class TestDDIAlertSeverity:
    """Test severity classification of DDI alerts."""

    def test_severity_values(self):
        """All alerts should have valid severity levels."""
        alerts = check_interactions_local(["warfarin", "aspirin", "fluconazole", "sertraline", "tramadol"])
        for alert in alerts:
            assert alert.severity in ("major", "moderate", "minor")

    def test_alert_has_recommendation(self):
        """All alerts should include a recommendation."""
        alerts = check_interactions_local(["warfarin", "aspirin"])
        for alert in alerts:
            assert alert.recommendation is not None or alert.description != ""
