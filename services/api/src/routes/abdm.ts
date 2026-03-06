/**
 * ABDM (Ayushman Bharat Digital Mission) routes — Phase 4.
 *
 * Implements the HIU (Health Information User) side of the ABDM protocol.
 * All health data access requires explicit patient consent per DPDP Act 2023.
 *
 * POST /api/abdm/verify-abha        — verify ABHA number during patient registration
 * POST /api/abdm/consent/request    — initiate consent request (notifies patient via PHR app)
 * GET  /api/abdm/consent/:id/status — check consent status
 * POST /api/abdm/callback/health-info — ABDM gateway pushes records here after consent
 */

import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { abdmClient } from "../lib/abdmClient.js";
import { fhirClient } from "../lib/fhirClient.js";

export const abdmRouter = Router();
abdmRouter.use(authenticate);

// ─── POST /api/abdm/verify-abha ───────────────────────────────────────────────

abdmRouter.post("/verify-abha", requireScope("patients:write"), async (req, res) => {
  const { abhaNumber } = z.object({ abhaNumber: z.string().min(14) }).parse(req.body);

  const result = await abdmClient.verifyAbhaNumber(abhaNumber).catch((e) => {
    res.status(503).json({ error: `ABDM verification failed: ${(e as Error).message}` });
    return null;
  });

  if (!result) return;
  res.json(result);
});

// ─── POST /api/abdm/consent/request ──────────────────────────────────────────

abdmRouter.post("/consent/request", requireScope("patients:write"), async (req, res) => {
  const schema = z.object({
    patientId: z.string().uuid(),
    patientAbha: z.string().min(14),
    purpose: z.enum(["CAREMGT", "BTG", "PKD", "PATRQT", "PUBHLTH", "HRESCH"]).default("CAREMGT"),
    hiTypes: z.array(z.string()).default(["OPConsultation", "Prescription", "DiagnosticReport", "DischargeSummary"]),
    dateRangeFrom: z.string().optional(),
    dateRangeTo: z.string().optional(),
  });

  const data = schema.safeParse(req.body);
  if (!data.success) {
    res.status(400).json({ error: data.error.flatten() });
    return;
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.sub } });
  if (!doctor) {
    res.status(403).json({ error: "Doctor profile required" });
    return;
  }

  const result = await abdmClient.requestConsent({
    patientAbha: data.data.patientAbha,
    purpose: data.data.purpose,
    hiTypes: data.data.hiTypes,
    dateRange: {
      from: data.data.dateRangeFrom ?? "2010-01-01",
      to: data.data.dateRangeTo ?? new Date().toISOString(),
    },
    requesterName: doctor.name,
  }).catch((e) => {
    res.status(503).json({ error: `Consent request failed: ${(e as Error).message}` });
    return null;
  });

  if (!result) return;
  res.json(result);
});

// ─── POST /api/abdm/callback/health-info — UNAUTHENTICATED CALLBACK ──────────
// This endpoint is called by the ABDM gateway after consent is granted.
// It receives FHIR Bundle of patient health records.
// NOTE: Must be whitelisted in ABDM HIU registration.

const abdmCallbackRouter = Router();

abdmCallbackRouter.post("/health-info", async (req, res) => {
  // In production: verify ABDM gateway signature
  // For now: acknowledge immediately and process async
  const { pageNumber, pageCount, transactionId, entries } = req.body ?? {};

  console.log(`[abdm] Health info callback: txn=${transactionId}, page=${pageNumber}/${pageCount}`);

  // Process each FHIR entry and push to FHIR service
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      // Each entry is an encrypted FHIR Bundle (decrypt in production)
      // For now: log and store reference
      console.log(`[abdm] Received ${entry.care_contexts?.length ?? 0} care contexts for patient`);
    }
  }

  res.json({ message: "Received" });
});

export { abdmCallbackRouter };
