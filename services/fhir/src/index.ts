import "dotenv/config";
import express from "express";

const app = express();
const PORT = process.env["PORT"] ?? 3002;
const INTERNAL_TOKEN = process.env["INTERNAL_TOKEN"] ?? "";

app.use(express.json());

// Health check first — exempt from auth (used by Cloud Run probes)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "cliniqai-fhir" });
});

// Internal auth guard for all /fhir/* routes
app.use("/fhir", (req, res, next) => {
  const token = req.headers["x-internal-token"];
  if (token !== INTERNAL_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

// FHIR resource routes
import patientRouter from "./resources/patient.js";
import encounterRouter from "./resources/encounter.js";
import medicationRequestRouter from "./resources/medicationRequest.js";
import diagnosticReportRouter from "./resources/diagnosticReport.js";
import observationRouter from "./resources/observation.js";
import conditionRouter from "./resources/condition.js";
import serviceRequestRouter from "./resources/serviceRequest.js";

app.use("/fhir/Patient", patientRouter);
app.use("/fhir/Encounter", encounterRouter);
app.use("/fhir/MedicationRequest", medicationRequestRouter);
app.use("/fhir/DiagnosticReport", diagnosticReportRouter);
app.use("/fhir/Observation", observationRouter);
app.use("/fhir/Condition", conditionRouter);
app.use("/fhir/ServiceRequest", serviceRequestRouter);

app.listen(PORT, () => {
  console.log(`[fhir] CliniqAI FHIR service running on http://localhost:${PORT}`);
});
