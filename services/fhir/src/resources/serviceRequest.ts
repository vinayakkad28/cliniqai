import { Router } from "express";
import { fhirCreate, fhirRead } from "../lib/healthcareClient.js";

const router = Router();

interface ServiceRequestInput {
  patientFhirId: string;
  encounterId: string;
  tests: string[];
}

function toFhirServiceRequest(data: ServiceRequestInput) {
  return {
    resourceType: "ServiceRequest",
    status: "active",
    intent: "order",
    subject: { reference: `Patient/${data.patientFhirId}` },
    encounter: { reference: `Encounter/${data.encounterId}` },
    code: {
      coding: data.tests.map((test) => ({ system: "http://loinc.org", display: test })),
      text: data.tests.join(", "),
    },
    authoredOn: new Date().toISOString(),
  };
}

// POST /fhir/ServiceRequest
router.post("/", async (req, res) => {
  const sr = await fhirCreate("ServiceRequest", toFhirServiceRequest(req.body as ServiceRequestInput));
  res.status(201).json(sr);
});

// GET /fhir/ServiceRequest/:id
router.get("/:id", async (req, res) => {
  const sr = await fhirRead("ServiceRequest", req.params["id"]!);
  res.json(sr);
});

export default router;
