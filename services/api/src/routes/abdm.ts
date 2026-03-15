/**
 * ABDM (Ayushman Bharat Digital Mission) routes — Phase 4.
 *
 * Implements the HIU (Health Information User) side of the ABDM protocol.
 * All health data access requires explicit patient consent per DPDP Act 2023.
 */

import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { abdmClient } from "../lib/abdmClient.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("abdm-routes");

export const abdmRouter = Router();
abdmRouter.use(authenticate);

// ─── POST /api/abdm/verify-abha ────────────────────────────────────────────

abdmRouter.post("/verify-abha", requireScope("patients:write"), async (req, res) => {
  const parsed = z.object({
    abhaNumber: z.string().min(14),
    patientId: z.string().uuid().optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { abhaNumber, patientId } = parsed.data;

  const result = await abdmClient.verifyAbhaNumber(abhaNumber).catch((e) => {
    log.error({ err: e }, "abdm_verify_failed");
    res.status(503).json({ error: `ABDM verification failed: ${(e as Error).message}` });
    return null;
  });

  if (!result) return;

  // Link ABHA to patient record if patientId provided
  if (patientId && result.valid) {
    await prisma.patient.update({
      where: { id: patientId },
      data: { abhaNumber },
    }).catch((err: unknown) => {
      log.error({ err, patientId }, "abdm_link_abha_failed");
    });
  }

  res.json(result);
});

// ─── POST /api/abdm/consent/request ─────────────────────────────────────────

abdmRouter.post("/consent/request", requireScope("patients:write"), async (req, res) => {
  const parsed = z.object({
    patientId: z.string().uuid(),
    patientAbha: z.string().min(14),
    purpose: z.enum(["CAREMGT", "BTG", "PKD", "PATRQT", "PUBHLTH", "HRESCH"]).default("CAREMGT"),
    hiTypes: z.array(z.string()).default(["OPConsultation", "Prescription", "DiagnosticReport", "DischargeSummary"]),
    dateRangeFrom: z.string().optional(),
    dateRangeTo: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.sub } });
  if (!doctor) {
    res.status(403).json({ error: "Doctor profile required" });
    return;
  }

  const result = await abdmClient.requestConsent({
    patientAbha: data.patientAbha,
    purpose: data.purpose,
    hiTypes: data.hiTypes,
    dateRange: {
      from: data.dateRangeFrom ?? "2010-01-01",
      to: data.dateRangeTo ?? new Date().toISOString(),
    },
    requesterName: doctor.name,
    requesterLicense: doctor.licenseNumber,
  }).catch((e) => {
    log.error({ err: e }, "abdm_consent_request_failed");
    res.status(503).json({ error: `Consent request failed: ${(e as Error).message}` });
    return null;
  });

  if (!result) return;

  // Persist consent record
  const consent = await prisma.abdmConsent.create({
    data: {
      patientId: data.patientId,
      doctorId: doctor.id,
      consentRequestId: result.consentRequestId,
      purpose: data.purpose,
      hiTypes: data.hiTypes,
      dateRangeFrom: new Date(data.dateRangeFrom ?? "2010-01-01"),
      dateRangeTo: new Date(data.dateRangeTo ?? new Date().toISOString()),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "requested",
    },
  });

  res.status(201).json(consent);
});

// ─── GET /api/abdm/consent/:id/status ───────────────────────────────────────

abdmRouter.get("/consent/:id/status", requireScope("patients:read"), async (req, res) => {
  const consent = await prisma.abdmConsent.findUnique({
    where: { id: req.params["id"] },
  });

  if (!consent) {
    res.status(404).json({ error: "Consent not found" });
    return;
  }

  // If still pending, poll ABDM for updated status
  if (consent.status === "requested") {
    const abdmStatus = await abdmClient.checkConsentStatus(consent.consentRequestId).catch(() => null);
    if (abdmStatus && abdmStatus.status !== "REQUESTED") {
      const updated = await prisma.abdmConsent.update({
        where: { id: consent.id },
        data: {
          status: abdmStatus.status.toLowerCase(),
          consentArtefactId: abdmStatus.consentArtefactId ?? consent.consentArtefactId,
        },
      });
      res.json(updated);
      return;
    }
  }

  res.json(consent);
});

// ─── POST /api/abdm/consent/:id/revoke ──────────────────────────────────────

abdmRouter.post("/consent/:id/revoke", requireScope("patients:write"), async (req, res) => {
  const consent = await prisma.abdmConsent.findUnique({
    where: { id: req.params["id"] },
  });

  if (!consent) {
    res.status(404).json({ error: "Consent not found" });
    return;
  }

  if (!consent.consentArtefactId) {
    res.status(400).json({ error: "Consent not yet granted, cannot revoke" });
    return;
  }

  await abdmClient.revokeConsent(consent.consentArtefactId).catch((e) => {
    log.error({ err: e, consentId: consent.id }, "abdm_revoke_failed");
  });

  const updated = await prisma.abdmConsent.update({
    where: { id: consent.id },
    data: { status: "revoked" },
  });

  res.json(updated);
});

// ─── POST /api/abdm/consent/:id/fetch-records ───────────────────────────────

abdmRouter.post("/consent/:id/fetch-records", requireScope("patients:read"), async (req, res) => {
  const consent = await prisma.abdmConsent.findUnique({
    where: { id: req.params["id"] },
  });

  if (!consent) {
    res.status(404).json({ error: "Consent not found" });
    return;
  }

  if (consent.status !== "granted" || !consent.consentArtefactId) {
    res.status(400).json({ error: "Consent not granted" });
    return;
  }

  const result = await abdmClient.fetchHealthRecords(consent.consentArtefactId).catch((e) => {
    log.error({ err: e }, "abdm_fetch_records_failed");
    res.status(503).json({ error: `Failed to fetch records: ${(e as Error).message}` });
    return null;
  });

  if (!result) return;

  // Store encryption keys for decrypting callback data
  await prisma.abdmConsent.update({
    where: { id: consent.id },
    data: {
      privateKey: result.privateKey,
      nonce: result.nonce,
    },
  });

  res.json({ transactionId: result.transactionId, message: "Health record fetch initiated. Records will be delivered via callback." });
});

// ─── ABDM Gateway Callbacks (UNAUTHENTICATED) ──────────────────────────────

export const abdmCallbackRouter = Router();

// Consent notification — ABDM notifies when consent is granted/denied
abdmCallbackRouter.post("/consent-notification", async (req, res) => {
  const { notification } = req.body ?? {};
  log.info({ notification }, "abdm_consent_notification");

  if (notification?.consentRequestId && notification?.status) {
    await prisma.abdmConsent.updateMany({
      where: { consentRequestId: notification.consentRequestId },
      data: {
        status: (notification.status as string).toLowerCase(),
        consentArtefactId: notification.consentArtefacts?.[0]?.id ?? null,
      },
    }).catch((err: unknown) => {
      log.error({ err }, "abdm_consent_notification_update_failed");
    });
  }

  res.json({ message: "Acknowledged" });
});

// Health info — ABDM pushes encrypted FHIR bundles here
abdmCallbackRouter.post("/health-info", async (req, res) => {
  const { pageNumber, pageCount, transactionId, entries } = req.body ?? {};
  log.info({ transactionId, pageNumber, pageCount }, "abdm_health_info_callback");

  if (Array.isArray(entries)) {
    for (const entry of entries) {
      // TODO: Decrypt FHIR bundles using stored ECDH private key
      // TODO: Store decrypted records via fhirClient
      log.info({
        careContexts: entry.care_contexts?.length ?? 0,
        transactionId,
      }, "abdm_health_info_entry");
    }
  }

  res.json({ message: "Received" });
});
