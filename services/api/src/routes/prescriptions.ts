import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { fhirClient } from "../lib/fhirClient.js";
import { aiClient } from "../lib/aiClient.js";
import { whatsappPrescriptionQueue, smsReminderQueue } from "../lib/queues.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const prescriptionsRouter = Router();

prescriptionsRouter.use(authenticate);

const MedicationSchema = z.object({
  drug: z.string().min(1).max(200),
  dose: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  duration: z.string().min(1).max(100),
  route: z.string().min(1).max(50),
  notes: z.string().max(500).optional(),
});

const CreatePrescriptionSchema = z.object({
  consultationId: z.string().uuid(),
  medications: z.array(MedicationSchema).min(1),
  sendVia: z.enum(["whatsapp", "sms", "none"]).default("whatsapp"),
  // Doctor sets true after reviewing DDI warnings to override
  acknowledgeDdi: z.boolean().default(false),
});

// ─── POST /api/prescriptions ─────────────────────────────────────────────────

prescriptionsRouter.post("/", requireScope("prescriptions:write"), asyncHandler(async (req, res) => {
  const result = CreatePrescriptionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { consultationId, medications, sendVia, acknowledgeDdi } = result.data;

  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: {
      patient: true,
      doctor: { select: { name: true } },
    },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }

  if (consultation.doctorId !== req.user!.doctor_id!) {
    res.status(403).json({ error: "Not your consultation" });
    return;
  }

  // DDI check — sync, blocks save on major interactions (< 2s latency budget)
  const ddiAlerts = await aiClient
    .checkDdi(medications.map((m) => m.drug), consultation.patientId)
    .catch(() => []);
  const majorAlerts = ddiAlerts.filter((a) => a.severity === "major");

  if (majorAlerts.length > 0 && !acknowledgeDdi) {
    res.status(422).json({
      error: "Major drug interactions detected. Set acknowledgeDdi=true to override.",
      ddiAlerts,
      requiresConfirmation: true,
    });
    return;
  }

  // Write FHIR MedicationRequest (clinical record, source of truth)
  const fhirMedReq = await fhirClient
    .createMedicationRequest({
      patientFhirId: consultation.patient.fhirPatientId,
      encounterId: consultation.fhirEncounterId ?? "",
      medications,
    })
    .catch(() => null);

  const now = new Date();
  const prescription = await prisma.prescription.create({
    data: {
      consultationId,
      patientId: consultation.patientId,
      doctorId: req.user!.doctor_id!,
      medications: medications as unknown as any,
      fhirMedicationRequestId: fhirMedReq?.id ?? null,
      sentVia: sendVia !== "none" ? sendVia : null,
      sentAt: sendVia !== "none" ? now : null,
      status: sendVia !== "none" ? "sent" : "draft",
    },
  });

  // Enqueue delivery job
  if (sendVia === "whatsapp") {
    whatsappPrescriptionQueue.add({
      prescriptionId: prescription.id,
      patientPhone: consultation.patient.phone,
      doctorName: consultation.doctor.name,
      medications: medications.map((m) => ({
        drug: m.drug,
        dose: m.dose,
        frequency: m.frequency,
        duration: m.duration,
      })),
    }).catch(() => {}); // fire-and-forget
  } else if (sendVia === "sms") {
    smsReminderQueue.add({
      prescriptionId: prescription.id,
      patientPhone: consultation.patient.phone,
      type: "prescription",
      doctorName: consultation.doctor.name,
    }).catch(() => {}); // fire-and-forget
  }

  res.status(201).json({
    prescription,
    ddiAlerts: ddiAlerts.filter((a) => a.severity !== "major"),
    majorAlertsAcknowledged: acknowledgeDdi && majorAlerts.length > 0,
  });
}));

// ─── GET /api/prescriptions/:id ──────────────────────────────────────────────

prescriptionsRouter.get("/:id", requireScope("prescriptions:read"), asyncHandler(async (req, res) => {
  const prescription = await prisma.prescription.findUnique({
    where: { id: req.params["id"] },
    include: {
      patient: { select: { id: true, phone: true, fhirPatientId: true } },
      dispensing: { include: { medicine: true } },
    },
  });

  if (!prescription || prescription.doctorId !== req.user!.doctor_id) {
    res.status(404).json({ error: "Prescription not found" });
    return;
  }

  res.json(prescription);
}));

// ─── POST /api/prescriptions/:id/send ────────────────────────────────────────

prescriptionsRouter.post("/:id/send", requireScope("prescriptions:write"), asyncHandler(async (req, res) => {
  const bodyResult = z.object({ via: z.enum(["whatsapp", "sms"]) }).safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({ error: bodyResult.error.flatten() });
    return;
  }

  const prescription = await prisma.prescription.findUnique({
    where: { id: req.params["id"] },
    include: {
      patient: { select: { phone: true } },
      doctor: { select: { name: true } },
    },
  });
  if (!prescription || prescription.doctorId !== req.user!.doctor_id) {
    res.status(404).json({ error: "Prescription not found" });
    return;
  }

  await prisma.prescription.update({
    where: { id: prescription.id },
    data: { sentVia: bodyResult.data.via, sentAt: new Date(), status: "sent" },
  });

  if (bodyResult.data.via === "whatsapp") {
    whatsappPrescriptionQueue.add({
      prescriptionId: prescription.id,
      patientPhone: prescription.patient.phone,
      doctorName: prescription.doctor.name,
      medications: (prescription.medications as any[]) ?? [],
    }).catch(() => {}); // fire-and-forget
  } else {
    smsReminderQueue.add({
      prescriptionId: prescription.id,
      patientPhone: prescription.patient.phone,
      type: "prescription",
      doctorName: prescription.doctor.name,
    }).catch(() => {}); // fire-and-forget
  }

  res.json({ message: `Prescription queued for delivery via ${bodyResult.data.via}` });
}));
