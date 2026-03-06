import { Router } from "express";
import { fhirCreate, fhirRead } from "../lib/healthcareClient.js";

const router = Router();

interface MedicationItem {
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  notes?: string;
}

interface MedReqInput {
  patientFhirId: string;
  encounterId: string;
  medications: MedicationItem[];
}

function toFhirMedicationRequest(patientFhirId: string, encounterId: string, med: MedicationItem) {
  return {
    resourceType: "MedicationRequest",
    status: "active",
    intent: "order",
    subject: { reference: `Patient/${patientFhirId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    medicationCodeableConcept: { text: med.drug },
    dosageInstruction: [
      {
        text: `${med.dose} ${med.frequency} for ${med.duration} via ${med.route}`,
        route: { text: med.route },
        ...(med.notes ? { patientInstruction: med.notes } : {}),
      },
    ],
  };
}

// POST /fhir/MedicationRequest — one resource per medication line
router.post("/", async (req, res) => {
  const { patientFhirId, encounterId, medications } = req.body as MedReqInput;

  const created = await Promise.all(
    medications.map((med) =>
      fhirCreate("MedicationRequest", toFhirMedicationRequest(patientFhirId, encounterId, med)),
    ),
  );

  const first = created[0] as { id: string };
  res.status(201).json({ id: first.id, resourceType: "Bundle", entry: created });
});

// GET /fhir/MedicationRequest/:id
router.get("/:id", async (req, res) => {
  const resource = await fhirRead("MedicationRequest", req.params["id"]!);
  res.json(resource);
});

export default router;
