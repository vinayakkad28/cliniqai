import { Router } from "express";
import { fhirCreate, fhirRead } from "../lib/healthcareClient.js";

const router = Router();

interface ObservationInput {
  patientFhirId: string;
  encounterId?: string;
  code: string;        // LOINC code or free text
  value: number | string;
  unit?: string;
  effectiveDateTime?: string;
  status?: string;
}

function toFhirObservation(data: ObservationInput) {
  return {
    resourceType: "Observation",
    status: data.status ?? "final",
    subject: { reference: `Patient/${data.patientFhirId}` },
    ...(data.encounterId ? { encounter: { reference: `Encounter/${data.encounterId}` } } : {}),
    code: { text: data.code },
    effectiveDateTime: data.effectiveDateTime ?? new Date().toISOString(),
    ...(typeof data.value === "number"
      ? { valueQuantity: { value: data.value, unit: data.unit ?? "" } }
      : { valueString: data.value }),
  };
}

// POST /fhir/Observation
router.post("/", async (req, res) => {
  const obs = await fhirCreate("Observation", toFhirObservation(req.body as ObservationInput));
  res.status(201).json(obs);
});

// GET /fhir/Observation/:id
router.get("/:id", async (req, res) => {
  const obs = await fhirRead("Observation", req.params["id"]!);
  res.json(obs);
});

export default router;
