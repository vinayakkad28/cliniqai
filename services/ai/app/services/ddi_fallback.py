"""
Local DDI (Drug-Drug Interaction) fallback database using SQLite.
Used when Vertex AI is unavailable or times out.

Data sourced from OpenFDA drug interaction data — populate via
`scripts/seed_ddi_db.py` which downloads and normalises the DrugBank
open-access dataset.
"""
from __future__ import annotations

import logging
import sqlite3
from pathlib import Path
from typing import NamedTuple

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent.parent.parent / "data" / "ddi.sqlite"


class DdiAlert(NamedTuple):
    drug_a: str
    drug_b: str
    severity: str  # "major", "moderate", "minor"
    description: str
    recommendation: str


def _get_connection() -> sqlite3.Connection:
    if not DB_PATH.exists():
        logger.warning("DDI SQLite DB not found at %s — no fallback alerts will be generated", DB_PATH)
        return None  # type: ignore[return-value]
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def check_interactions_local(drugs: list[str]) -> list[DdiAlert]:
    """
    Check all pairs of drugs against the local SQLite DDI database.
    Returns a list of DdiAlert namedtuples. Empty list if DB unavailable.
    """
    conn = _get_connection()
    if conn is None:
        return []

    alerts: list[DdiAlert] = []
    normalized = [d.lower().strip() for d in drugs]

    try:
        with conn:
            cursor = conn.cursor()
            for i, drug_a in enumerate(normalized):
                for drug_b in normalized[i + 1 :]:
                    rows = cursor.execute(
                        """
                        SELECT drug_a, drug_b, severity, description, recommendation
                        FROM interactions
                        WHERE (LOWER(drug_a) = ? AND LOWER(drug_b) = ?)
                           OR (LOWER(drug_a) = ? AND LOWER(drug_b) = ?)
                        """,
                        (drug_a, drug_b, drug_b, drug_a),
                    ).fetchall()

                    for row in rows:
                        alerts.append(
                            DdiAlert(
                                drug_a=row["drug_a"],
                                drug_b=row["drug_b"],
                                severity=row["severity"],
                                description=row["description"],
                                recommendation=row["recommendation"],
                            )
                        )
    except sqlite3.Error as e:
        logger.error("DDI SQLite error: %s", e)
    finally:
        conn.close()

    return alerts
