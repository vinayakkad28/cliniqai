import { Router } from "express";
import { fhirCreate, fhirRead } from "../lib/healthcareClient.js";

const router = Router();

interface ConditionInput {
  patientFhirId: string;
  encounterId?: string;
  icd10Code: string;
  description: string;
  clinicalStatus?: string; // "active", "resolved", "inactive"
  severity?: string;
}

function toFhirCondition(data: ConditionInput) {
  return {
    resourceType: "Condition",
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: data.clinicalStatus ?? "active",
        },
      ],
    },
    code: {
      coding: [
        {
          system: "http://hl7.org/fhir/sid/icd-10",
          code: data.icd10Code,
          display: data.description,
        },
      ],
      text: data.description,
    },
    subject: { reference: `Patient/${data.patientFhirId}` },
    ...(data.encounterId ? { encounter: { reference: `Encounter/${data.encounterId}` } } : {}),
    recordedDate: new Date().toISOString(),
  };
}

// POST /fhir/Condition
router.post("/", async (req, res) => {
  const condition = await fhirCreate("Condition", toFhirCondition(req.body as ConditionInput));
  res.status(201).json(condition);
});

// GET /fhir/Condition/:id
router.get("/:id", async (req, res) => {
  const condition = await fhirRead("Condition", req.params["id"]!);
  res.json(condition);
});

export default router;
