import { Router } from "express";
import { fhirCreate, fhirRead, fhirUpdate } from "../lib/healthcareClient.js";

const router = Router();

interface PatientInput {
  name: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
}

function toFhirPatient(data: PatientInput) {
  return {
    resourceType: "Patient",
    name: [{ use: "official", text: data.name }],
    telecom: [{ system: "phone", value: data.phone, use: "mobile" }],
    ...(data.gender ? { gender: data.gender } : {}),
    ...(data.dateOfBirth ? { birthDate: data.dateOfBirth } : {}),
    ...(data.address
      ? { address: [{ use: "home", text: data.address }] }
      : {}),
  };
}

// POST /fhir/Patient
router.post("/", async (req, res) => {
  const fhirPatient = await fhirCreate("Patient", toFhirPatient(req.body as PatientInput));
  res.status(201).json(fhirPatient);
});

// GET /fhir/Patient/:id
router.get("/:id", async (req, res) => {
  const fhirPatient = await fhirRead("Patient", req.params["id"]!);
  res.json(fhirPatient);
});

// PUT /fhir/Patient/:id
router.put("/:id", async (req, res) => {
  const existing = (await fhirRead("Patient", req.params["id"]!)) as Record<string, unknown>;

  const updates = req.body as Partial<PatientInput>;
  const updated = {
    ...existing,
    ...(updates.name ? { name: [{ use: "official", text: updates.name }] } : {}),
    ...(updates.phone
      ? { telecom: [{ system: "phone", value: updates.phone, use: "mobile" }] }
      : {}),
    ...(updates.gender ? { gender: updates.gender } : {}),
    ...(updates.dateOfBirth ? { birthDate: updates.dateOfBirth } : {}),
    ...(updates.address ? { address: [{ use: "home", text: updates.address }] } : {}),
  };

  const result = await fhirUpdate("Patient", req.params["id"]!, updated);
  res.json(result);
});

export default router;
