/**
 * Clinical Alert Worker — Phase 3.
 *
 * Consumes "clinical.alert" Bull queue jobs.
 * Logic:
 *   1. Fetch patient context (current meds, recent vitals, lab flags)
 *   2. Rule-based pre-filter (avoids AI cost for obviously clean cases)
 *   3. If rules flag anything, call /ai/alerts/evaluate (MedGemma)
 *   4. If alert confirmed, create AiInsight + push notification to doctor
 *
 * Run: tsx src/workers/clinicalAlertWorker.ts
 */

import "dotenv/config";
import Bull from "bull";
import { prisma } from "../lib/prisma.js";
import { aiClient } from "../lib/aiClient.js";
import { pushAlertQueue } from "../lib/queues.js";
import type { ClinicalAlertJob } from "../lib/queues.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const queue = new Bull<ClinicalAlertJob>("clinical.alert", REDIS_URL);

queue.process(async (job) => {
  const { patientId, consultationId } = job.data;
  console.log(`[alert-worker] Evaluating alerts for patient ${patientId}`);

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return;

  // Gather context
  const recentPrescriptions = await prisma.prescription.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true },
  });

  // Rule-based pre-filter: skip if no prescriptions (nothing to cross-check)
  if (recentPrescriptions.length === 0) {
    console.log(`[alert-worker] No prescriptions for patient ${patientId}, skipping`);
    return;
  }

  // Call AI for alert evaluation
  const alert = await aiClient.evaluateClinicalAlert({
    patientId,
    consultationId,
    medications: recentPrescriptions.map((p) => p.id), // AI service resolves via its own DB
  });

  if (!alert.hasAlert) {
    console.log(`[alert-worker] No alert for patient ${patientId}`);
    return;
  }

  // Store insight (doctor must approve before action is taken)
  const insight = await prisma.aiInsight.create({
    data: {
      patientId,
      consultationId,
      type: "clinical_alert",
      content: alert.message,
      metadata: { severity: alert.severity } as never,
      doctorApproved: null,
    },
  });

  // Push notification to doctor (real-time alert)
  await pushAlertQueue.add({
    insightId: insight.id,
    patientId,
    severity: alert.severity,
    message: alert.message,
  });

  console.log(`[alert-worker] Alert created for patient ${patientId}: ${alert.severity}`);
});

queue.on("failed", (job, err) => {
  console.error(`[alert-worker] Job ${job.id} failed:`, err.message);
});

console.log("[alert-worker] Clinical alert worker started…");
