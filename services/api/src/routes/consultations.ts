import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { fhirClient } from "../lib/fhirClient.js";

export const consultationsRouter = Router();

consultationsRouter.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const StartConsultationSchema = z.object({
  appointmentId: z.string().uuid(),
  chiefComplaint: z.string().max(500).optional(),
});

const UpdateConsultationSchema = z.object({
  chiefComplaint: z.string().max(500).optional(),
  notes: z.string().max(10_000).optional(),
});

// ─── POST /api/consultations — Start ─────────────────────────────────────────

consultationsRouter.post("/", requireScope("consultations:write"), async (req, res) => {
  const result = StartConsultationSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { appointmentId, chiefComplaint } = result.data;

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, consultation: true },
  });

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (appointment.doctorId !== req.user!.sub) {
    res.status(403).json({ error: "Not your appointment" });
    return;
  }

  if (appointment.consultation) {
    res.status(409).json({ error: "Consultation already started for this appointment" });
    return;
  }

  // Create FHIR Encounter
  const fhirEncounter = await fhirClient.createEncounter({
    patientFhirId: appointment.patient.fhirPatientId,
    practitionerId: req.user!.sub,
    startedAt: new Date().toISOString(),
    chiefComplaint,
  }).catch(() => null);

  // Update appointment status to in_progress
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "in_progress" },
  });

  const consultation = await prisma.consultation.create({
    data: {
      appointmentId,
      doctorId: req.user!.sub,
      patientId: appointment.patientId,
      fhirEncounterId: fhirEncounter?.id ?? null,
      chiefComplaint,
      status: "in_progress",
    },
  });

  res.status(201).json(consultation);
});

// ─── GET /api/consultations/:id ───────────────────────────────────────────────

consultationsRouter.get("/:id", requireScope("consultations:read"), async (req, res) => {
  const consultation = await prisma.consultation.findUnique({
    where: { id: req.params["id"] },
    include: {
      patient: { select: { id: true, phone: true, fhirPatientId: true } },
      prescriptions: { select: { id: true, status: true, sentAt: true, pdfUrl: true } },
      labOrders: { select: { id: true, tests: true, status: true } },
      invoices: { select: { id: true, total: true, status: true } },
    },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }

  res.json(consultation);
});

// ─── PATCH /api/consultations/:id ─────────────────────────────────────────────

consultationsRouter.patch("/:id", requireScope("consultations:write"), async (req, res) => {
  const result = UpdateConsultationSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const consultation = await prisma.consultation.findUnique({ where: { id: req.params["id"] } });
  if (!consultation) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }

  if (consultation.doctorId !== req.user!.sub) {
    res.status(403).json({ error: "Not your consultation" });
    return;
  }

  if (consultation.status !== "in_progress") {
    res.status(400).json({ error: "Consultation is not in progress" });
    return;
  }

  const updated = await prisma.consultation.update({
    where: { id: consultation.id },
    data: result.data,
  });

  res.json(updated);
});

// ─── POST /api/consultations/:id/end ─────────────────────────────────────────

consultationsRouter.post("/:id/end", requireScope("consultations:write"), async (req, res) => {
  const consultation = await prisma.consultation.findUnique({
    where: { id: req.params["id"] },
    include: { appointment: true },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }

  if (consultation.doctorId !== req.user!.sub) {
    res.status(403).json({ error: "Not your consultation" });
    return;
  }

  if (consultation.status !== "in_progress") {
    res.status(400).json({ error: "Consultation is not in progress" });
    return;
  }

  const now = new Date();

  // Update FHIR Encounter end time
  if (consultation.fhirEncounterId) {
    await fhirClient
      .updateEncounter(consultation.fhirEncounterId, {
        status: "finished",
        period: { end: now.toISOString() },
      })
      .catch(() => null);
  }

  const [updated] = await prisma.$transaction([
    prisma.consultation.update({
      where: { id: consultation.id },
      data: { status: "completed", endedAt: now },
    }),
    prisma.appointment.update({
      where: { id: consultation.appointmentId },
      data: { status: "completed" },
    }),
  ]);

  res.json(updated);
});
