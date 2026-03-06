import { Router } from "express";
import { fhirCreate, fhirRead } from "../lib/healthcareClient.js";

const router = Router();

interface DiagnosticReportInput {
  patientFhirId: string;
  serviceRequestId: string;
  resultFileUrl: string;
  aiSummary?: string;
}

function toFhirDiagnosticReport(data: DiagnosticReportInput) {
  return {
    resourceType: "DiagnosticReport",
    status: "final",
    subject: { reference: `Patient/${data.patientFhirId}` },
    basedOn: [{ reference: `ServiceRequest/${data.serviceRequestId}` }],
    presentedForm: [
      {
        contentType: "application/pdf",
        url: data.resultFileUrl,
      },
    ],
    ...(data.aiSummary
      ? { conclusion: data.aiSummary }
      : {}),
  };
}

// POST /fhir/DiagnosticReport
router.post("/", async (req, res) => {
  const report = await fhirCreate("DiagnosticReport", toFhirDiagnosticReport(req.body as DiagnosticReportInput));
  res.status(201).json(report);
});

// GET /fhir/DiagnosticReport/:id
router.get("/:id", async (req, res) => {
  const report = await fhirRead("DiagnosticReport", req.params["id"]!);
  res.json(report);
});

export default router;
