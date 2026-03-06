import { Router } from "express";
import { fhirCreate, fhirRead, fhirUpdate } from "../lib/healthcareClient.js";

const router = Router();

interface EncounterInput {
  patientFhirId: string;
  practitionerId: string;
  startedAt: string;
  chiefComplaint?: string;
}

function toFhirEncounter(data: EncounterInput) {
  return {
    resourceType: "Encounter",
    status: "in-progress",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
    subject: { reference: `Patient/${data.patientFhirId}` },
    participant: [
      {
        individual: { reference: `Practitioner/${data.practitionerId}` },
      },
    ],
    period: { start: data.startedAt },
    ...(data.chiefComplaint
      ? {
          reasonCode: [
            {
              text: data.chiefComplaint,
            },
          ],
        }
      : {}),
  };
}

// POST /fhir/Encounter
router.post("/", async (req, res) => {
  const encounter = await fhirCreate("Encounter", toFhirEncounter(req.body as EncounterInput));
  res.status(201).json(encounter);
});

// GET /fhir/Encounter/:id
router.get("/:id", async (req, res) => {
  const encounter = await fhirRead("Encounter", req.params["id"]!);
  res.json(encounter);
});

// PUT /fhir/Encounter/:id — update status, end time, etc.
router.put("/:id", async (req, res) => {
  const existing = (await fhirRead("Encounter", req.params["id"]!)) as Record<string, unknown>;
  const updates = req.body as Record<string, unknown>;

  const updated = { ...existing, ...updates };

  const result = await fhirUpdate("Encounter", req.params["id"]!, updated);
  res.json(result);
});

export default router;
