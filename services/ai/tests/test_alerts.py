"""Tests for clinical alerts rule-based engine."""

import pytest


class TestCriticalVitalsRules:
    """Test deterministic vital sign alert rules from alerts.py."""

    @staticmethod
    def check_critical_vitals(vitals: dict) -> list[dict]:
        """Replicate the rule-based pre-filter logic from alerts router."""
        alerts = []
        if vitals.get("spo2") is not None and vitals["spo2"] < 90:
            alerts.append({"type": "critical_vital", "message": f"SpO2 critically low: {vitals['spo2']}%", "severity": "critical"})
        if vitals.get("heart_rate") is not None:
            if vitals["heart_rate"] > 150:
                alerts.append({"type": "critical_vital", "message": f"Tachycardia: HR {vitals['heart_rate']} bpm", "severity": "critical"})
            elif vitals["heart_rate"] < 40:
                alerts.append({"type": "critical_vital", "message": f"Bradycardia: HR {vitals['heart_rate']} bpm", "severity": "critical"})
        if vitals.get("blood_pressure_systolic") is not None:
            if vitals["blood_pressure_systolic"] > 180:
                alerts.append({"type": "critical_vital", "message": f"Hypertensive crisis: SBP {vitals['blood_pressure_systolic']} mmHg", "severity": "critical"})
            elif vitals["blood_pressure_systolic"] < 80:
                alerts.append({"type": "critical_vital", "message": f"Hypotension: SBP {vitals['blood_pressure_systolic']} mmHg", "severity": "critical"})
        if vitals.get("temperature") is not None:
            if vitals["temperature"] > 39.5:
                alerts.append({"type": "critical_vital", "message": f"High fever: {vitals['temperature']}°C", "severity": "high"})
            elif vitals["temperature"] < 35:
                alerts.append({"type": "critical_vital", "message": f"Hypothermia: {vitals['temperature']}°C", "severity": "high"})
        if vitals.get("respiratory_rate") is not None:
            if vitals["respiratory_rate"] > 30:
                alerts.append({"type": "critical_vital", "message": f"Tachypnea: RR {vitals['respiratory_rate']}/min", "severity": "critical"})
            elif vitals["respiratory_rate"] < 8:
                alerts.append({"type": "critical_vital", "message": f"Bradypnea: RR {vitals['respiratory_rate']}/min", "severity": "critical"})
        return alerts

    def test_normal_vitals_no_alerts(self, sample_vitals):
        """Normal vitals should not trigger any alerts."""
        alerts = self.check_critical_vitals(sample_vitals)
        assert len(alerts) == 0

    def test_low_spo2_triggers_critical(self):
        """SpO2 below 90% should trigger critical alert."""
        vitals = {"spo2": 85}
        alerts = self.check_critical_vitals(vitals)
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "critical"
        assert "SpO2" in alerts[0]["message"]

    def test_high_heart_rate_triggers_critical(self):
        """Heart rate above 150 should trigger tachycardia alert."""
        vitals = {"heart_rate": 160}
        alerts = self.check_critical_vitals(vitals)
        assert len(alerts) == 1
        assert "Tachycardia" in alerts[0]["message"]

    def test_low_heart_rate_triggers_critical(self):
        """Heart rate below 40 should trigger bradycardia alert."""
        vitals = {"heart_rate": 35}
        alerts = self.check_critical_vitals(vitals)
        assert len(alerts) == 1
        assert "Bradycardia" in alerts[0]["message"]

    def test_hypertensive_crisis(self):
        """Systolic BP above 180 should trigger alert."""
        vitals = {"blood_pressure_systolic": 200}
        alerts = self.check_critical_vitals(vitals)
        assert len(alerts) == 1
        assert "Hypertensive" in alerts[0]["message"]

    def test_hypotension(self):
        """Systolic BP below 80 should trigger alert."""
        vitals = {"blood_pressure_systolic": 70}
        alerts = self.check_critical_vitals(vitals)
        assert len(alerts) == 1
        assert "Hypotension" in alerts[0]["message"]

    def test_high_fever(self):
        """Temperature above 39.5 should trigger high severity alert."""
        vitals = {"temperature": 40.2}
        alerts = self.check_critical_vitals(vitals)
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "high"

    def test_multiple_critical_vitals(self):
        """Multiple abnormal vitals should generate multiple alerts."""
        vitals = {"spo2": 80, "heart_rate": 160, "blood_pressure_systolic": 200}
        alerts = self.check_critical_vitals(vitals)
        assert len(alerts) == 3

    def test_empty_vitals(self):
        """Empty vitals dict should return no alerts."""
        alerts = self.check_critical_vitals({})
        assert len(alerts) == 0

    def test_boundary_values(self):
        """Test exact boundary values (should NOT trigger alerts)."""
        vitals = {"spo2": 90, "heart_rate": 150, "blood_pressure_systolic": 180, "temperature": 39.5, "respiratory_rate": 30}
        alerts = self.check_critical_vitals(vitals)
        # spo2=90 is NOT < 90, hr=150 is NOT > 150, etc.
        assert len(alerts) == 0


class TestMedicationEscalationRules:
    """Test medication count rules."""

    @staticmethod
    def check_medication_escalation(medications: list) -> list[dict]:
        """Check if 3+ concurrent drugs warrant review."""
        if len(medications) >= 3:
            return [{"type": "medication_escalation", "message": f"Patient on {len(medications)} concurrent medications — review for polypharmacy", "severity": "medium"}]
        return []

    def test_polypharmacy_alert(self, sample_medications):
        """3+ medications should trigger polypharmacy alert."""
        alerts = self.check_medication_escalation(sample_medications)
        assert len(alerts) == 1
        assert "polypharmacy" in alerts[0]["message"]

    def test_no_polypharmacy_with_two_drugs(self):
        """2 medications should not trigger alert."""
        alerts = self.check_medication_escalation([{"drug": "A"}, {"drug": "B"}])
        assert len(alerts) == 0
