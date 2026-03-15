import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { fhirClient } from "../lib/fhirClient.js";
import { aiClient } from "../lib/aiClient.js";
import { whatsappPrescriptionQueue, smsReminderQueue } from "../lib/queues.js";
import { generatePrescriptionPdf } from "../lib/pdfGenerator.js";
import { computeDigitalSignature, generatePrescriptionQR, verifyDigitalSignature } from "../lib/qrGenerator.js";

export const prescriptionsRouter = Router();

// ─── GET /api/prescriptions/verify/:id — Public verification endpoint ───────

prescriptionsRouter.get("/verify/:id", async (req, res) => {
  const prescription = await prisma.prescription.findUnique({
    where: { id: req.params["id"] },
    include: {
      doctor: { select: { name: true, licenseNumber: true, id: true, clinicDoctors: { include: { clinic: { select: { name: true } } }, take: 1 } } },
    },
  });

  if (!prescription || !prescription.digitalSignature) {
    res.json({ valid: false });
    return;
  }

  const valid = verifyDigitalSignature(
    prescription.id,
    prescription.doctorId,
    prescription.createdAt,
    prescription.digitalSignature,
  );

  res.json({
    valid,
    prescriptionId: prescription.id,
    doctorName: prescription.doctor.name,
    doctorLicense: prescription.doctor.licenseNumber,
    issuedAt: prescription.createdAt.toISOString(),
    clinicName: prescription.doctor.clinicDoctors[0]?.clinic?.name ?? null,
  });
});

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

prescriptionsRouter.post("/", requireScope("prescriptions:write"), async (req, res) => {
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
  const doctorId = req.user!.doctor_id!;
  const prescription = await prisma.prescription.create({
    data: {
      consultationId,
      patientId: consultation.patientId,
      doctorId,
      fhirMedicationRequestId: fhirMedReq?.id ?? null,
      medications: medications as unknown as Record<string, unknown>[],
      sentVia: sendVia !== "none" ? sendVia : null,
      sentAt: sendVia !== "none" ? now : null,
      status: sendVia !== "none" ? "sent" : "draft",
    },
  });

  // Compute digital signature for e-prescription verification
  const digitalSignature = computeDigitalSignature(prescription.id, doctorId, prescription.createdAt);
  await prisma.prescription.update({
    where: { id: prescription.id },
    data: { digitalSignature },
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
});

// ─── GET /api/prescriptions/:id ──────────────────────────────────────────────

prescriptionsRouter.get("/:id", requireScope("prescriptions:read"), async (req, res) => {
  const prescription = await prisma.prescription.findUnique({
    where: { id: req.params["id"] },
    include: {
      patient: { select: { id: true, phone: true, fhirPatientId: true } },
      dispensing: { include: { medicine: true } },
    },
  });

  if (!prescription) {
    res.status(404).json({ error: "Prescription not found" });
    return;
  }

  res.json(prescription);
});

// ─── POST /api/prescriptions/:id/send ────────────────────────────────────────

prescriptionsRouter.post("/:id/send", requireScope("prescriptions:write"), async (req, res) => {
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
  if (!prescription) {
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
      medications: [],
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
});

// ─── GET /api/prescriptions/:id/pdf ─────────────────────────────────────────

prescriptionsRouter.get("/:id/pdf", requireScope("prescriptions:read"), async (req, res) => {
  const prescription = await prisma.prescription.findUnique({
    where: { id: req.params["id"] },
    include: {
      patient: { select: { phone: true } },
      doctor: { select: { name: true, licenseNumber: true, specialties: true, clinicDoctors: { include: { clinic: true }, take: 1 } } },
    },
  });

  if (!prescription) {
    res.status(404).json({ error: "Prescription not found" });
    return;
  }

  const clinic = prescription.doctor.clinicDoctors[0]?.clinic;
  const medications = Array.isArray(prescription.medications) ? prescription.medications as Array<{
    drug: string; dose: string; frequency: string; duration: string; route: string; notes?: string;
  }> : [];

  // Generate QR code for the PDF
  const qrCodePng = await generatePrescriptionQR({
    prescriptionId: prescription.id,
    doctorLicenseNumber: prescription.doctor.licenseNumber,
    doctorName: prescription.doctor.name,
    createdAt: prescription.createdAt,
    doctorId: prescription.doctorId,
  });

  const pdfBufferWithQR = await generatePrescriptionPdf({
    ...{
      prescriptionId: prescription.id,
      createdAt: prescription.createdAt,
      clinic: {
        name: clinic?.name ?? "CliniqAI Clinic",
        address: clinic?.address ?? "",
        gstNumber: clinic?.gstNumber,
      },
      doctor: {
        name: prescription.doctor.name,
        licenseNumber: prescription.doctor.licenseNumber,
        specialties: prescription.doctor.specialties,
      },
      patient: { phone: prescription.patient.phone },
      medications,
    },
    qrCodePng,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="prescription-${prescription.id.slice(0, 8)}.pdf"`);
  res.send(pdfBufferWithQR);
});

// ─── GET /api/prescriptions/:id/qr ─────────────────────────────────────────

prescriptionsRouter.get("/:id/qr", requireScope("prescriptions:read"), async (req, res) => {
  const prescription = await prisma.prescription.findUnique({
    where: { id: req.params["id"] },
    include: {
      doctor: { select: { name: true, licenseNumber: true, id: true } },
    },
  });

  if (!prescription) {
    res.status(404).json({ error: "Prescription not found" });
    return;
  }

  const qrPng = await generatePrescriptionQR({
    prescriptionId: prescription.id,
    doctorLicenseNumber: prescription.doctor.licenseNumber,
    doctorName: prescription.doctor.name,
    createdAt: prescription.createdAt,
    doctorId: prescription.doctorId,
  });

  res.setHeader("Content-Type", "image/png");
  res.send(qrPng);
});
