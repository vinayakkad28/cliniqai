#!/usr/bin/env python3
"""
Seed script: build data/ddi.sqlite with known drug-drug interactions.

Sources (open data):
  - A curated subset of common clinically significant DDIs
  - For production: replace with DrugBank full database or OpenFDA downloads

Usage:
  python scripts/seed_ddi_db.py

The script is idempotent — safe to run multiple times.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "ddi.sqlite"

# (drug_a, drug_b, severity, description)
# severity: major | moderate | minor
INTERACTIONS: list[tuple[str, str, str, str]] = [
    # ── Anticoagulants ───────────────────────────────────────────────────────
    ("warfarin", "aspirin", "major",
     "Concomitant use significantly increases bleeding risk."),
    ("warfarin", "ibuprofen", "major",
     "NSAIDs inhibit platelet aggregation and may displace warfarin from plasma proteins."),
    ("warfarin", "naproxen", "major",
     "NSAIDs inhibit platelet aggregation and increase GI bleeding risk."),
    ("warfarin", "fluconazole", "major",
     "Fluconazole inhibits CYP2C9, markedly increasing warfarin exposure."),
    ("warfarin", "metronidazole", "major",
     "Metronidazole inhibits CYP2C9, increasing warfarin levels."),
    ("warfarin", "ciprofloxacin", "moderate",
     "Some fluoroquinolones may potentiate warfarin anticoagulant effect."),
    ("warfarin", "amiodarone", "major",
     "Amiodarone inhibits CYP2C9 and CYP3A4, dramatically elevating warfarin levels."),

    # ── Serotonin Syndrome ───────────────────────────────────────────────────
    ("sertraline", "tramadol", "major",
     "Both increase serotonergic activity; risk of serotonin syndrome."),
    ("fluoxetine", "tramadol", "major",
     "High risk of serotonin syndrome; fluoxetine also inhibits tramadol metabolism."),
    ("sertraline", "linezolid", "major",
     "Linezolid is a weak MAO inhibitor; combined use risks serotonin syndrome."),
    ("escitalopram", "tramadol", "major",
     "Serotonin syndrome risk; tramadol lowers seizure threshold."),
    ("venlafaxine", "tramadol", "major",
     "Combined serotonergic activity raises risk of serotonin syndrome."),

    # ── QT Prolongation ──────────────────────────────────────────────────────
    ("azithromycin", "amiodarone", "major",
     "Additive QT prolongation; risk of life-threatening arrhythmia."),
    ("haloperidol", "azithromycin", "major",
     "Both prolong QT; concomitant use increases torsades de pointes risk."),
    ("methadone", "azithromycin", "major",
     "Significant additive QT prolongation risk."),
    ("ondansetron", "amiodarone", "major",
     "Both agents prolong QT interval."),
    ("ciprofloxacin", "amiodarone", "major",
     "Additive QT prolongation risk with fluoroquinolone + antiarrhythmic."),

    # ── Statins / CYP3A4 ─────────────────────────────────────────────────────
    ("simvastatin", "clarithromycin", "major",
     "Clarithromycin markedly increases simvastatin levels via CYP3A4 inhibition; myopathy risk."),
    ("atorvastatin", "clarithromycin", "moderate",
     "CYP3A4 inhibition increases atorvastatin exposure; myopathy risk."),
    ("simvastatin", "amiodarone", "major",
     "Amiodarone inhibits simvastatin metabolism; rhabdomyolysis risk."),

    # ── Hypoglycaemia ────────────────────────────────────────────────────────
    ("glibenclamide", "fluconazole", "major",
     "Fluconazole inhibits CYP2C9, substantially increasing sulfonylurea levels; hypoglycaemia."),
    ("glipizide", "fluconazole", "major",
     "Marked increase in glipizide exposure via CYP2C9 inhibition."),
    ("metformin", "contrast_media", "moderate",
     "Hold metformin around iodinated contrast procedures to prevent lactic acidosis."),

    # ── ACE Inhibitors / Hyperkalaemia ───────────────────────────────────────
    ("lisinopril", "potassium_chloride", "moderate",
     "ACE inhibitors raise serum potassium; additional K+ supplementation risks hyperkalaemia."),
    ("enalapril", "spironolactone", "major",
     "Both raise potassium; concurrent use risks life-threatening hyperkalaemia."),
    ("losartan", "spironolactone", "major",
     "ARBs combined with potassium-sparing diuretics risk hyperkalaemia."),

    # ── CNS Depressants ──────────────────────────────────────────────────────
    ("diazepam", "oxycodone", "major",
     "Benzodiazepine + opioid combination increases risk of respiratory depression and death."),
    ("alprazolam", "tramadol", "major",
     "CNS depression potentiation; respiratory depression risk."),
    ("clonazepam", "oxycodone", "major",
     "Additive CNS/respiratory depression; avoid or use with extreme caution."),
    ("zolpidem", "alcohol", "major",
     "Additive CNS depression; respiratory depression risk."),

    # ── Antibiotics ──────────────────────────────────────────────────────────
    ("rifampicin", "warfarin", "major",
     "Rifampicin is a potent CYP inducer and markedly reduces warfarin levels."),
    ("rifampicin", "oral_contraceptives", "major",
     "CYP induction dramatically reduces contraceptive efficacy."),
    ("metronidazole", "alcohol", "major",
     "Disulfiram-like reaction: flushing, nausea, vomiting."),

    # ── Immunosuppressants ───────────────────────────────────────────────────
    ("cyclosporine", "clarithromycin", "major",
     "CYP3A4 inhibition raises cyclosporine to nephrotoxic levels."),
    ("tacrolimus", "fluconazole", "major",
     "Fluconazole inhibits CYP3A4 and CYP2C19, markedly increasing tacrolimus exposure."),

    # ── Digoxin ──────────────────────────────────────────────────────────────
    ("digoxin", "amiodarone", "major",
     "Amiodarone increases digoxin levels; toxicity risk."),
    ("digoxin", "clarithromycin", "major",
     "P-gp inhibition increases digoxin absorption; toxicity risk."),
    ("digoxin", "verapamil", "major",
     "Verapamil increases digoxin levels; bradycardia and toxicity."),

    # ── Antiepileptics ───────────────────────────────────────────────────────
    ("carbamazepine", "warfarin", "major",
     "CYP induction markedly reduces warfarin levels."),
    ("phenytoin", "warfarin", "major",
     "Complex interaction; phenytoin may initially raise then lower warfarin levels."),
    ("valproate", "lamotrigine", "moderate",
     "Valproate inhibits lamotrigine glucuronidation, doubling lamotrigine levels."),

    # ── Miscellaneous Major ───────────────────────────────────────────────────
    ("lithium", "ibuprofen", "major",
     "NSAIDs reduce renal lithium clearance, raising levels to toxic range."),
    ("lithium", "diclofenac", "major",
     "NSAIDs impair renal lithium elimination; toxicity risk."),
    ("methotrexate", "nsaids", "major",
     "NSAIDs reduce renal methotrexate clearance; haematological toxicity."),
    ("ssris", "nsaids", "moderate",
     "Increased risk of GI bleeding when SSRIs combined with NSAIDs."),
]


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS interactions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_a      TEXT NOT NULL,
            drug_b      TEXT NOT NULL,
            severity    TEXT NOT NULL CHECK(severity IN ('major','moderate','minor')),
            description TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_drug_a ON interactions(drug_a);
        CREATE INDEX IF NOT EXISTS idx_drug_b ON interactions(drug_b);
    """)

    # Upsert: delete and re-insert all rows (idempotent for a static seed)
    cur.execute("DELETE FROM interactions")

    cur.executemany(
        "INSERT INTO interactions (drug_a, drug_b, severity, description) VALUES (?, ?, ?, ?)",
        INTERACTIONS,
    )

    conn.commit()
    conn.close()
    print(f"Seeded {len(INTERACTIONS)} interactions into {DB_PATH}")


if __name__ == "__main__":
    main()
