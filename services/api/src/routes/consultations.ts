import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { fhirClient } from "../lib/fhirClient.js";
import { emitToDoctor } from "../lib/socketServer.js";
import { SOCKET_EVENTS } from "../lib/socketEvents.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const consultationsRouter = Router();

consultationsRouter.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const StartConsultationSchema = z.object({
  appointmentId: z.string().uuid(),
  chiefComplaint: z.string().max(500).optional(),
});

const SoapNotesSchema = z.object({
  subjective: z.string().max(5000).optional(),
  objective: z.string().max(5000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
});

const VitalsSchema = z.object({
  bloodPressureSystolic: z.number().optional(),
  bloodPressureDiastolic: z.number().optional(),
  pulse: z.number().optional(),
  temperature: z.number().optional(),
  spo2: z.number().optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  respiratoryRate: z.number().optional(),
});

const UpdateConsultationSchema = z.object({
  chiefComplaint: z.string().max(500).optional(),
  notes: z.string().max(10_000).optional(),
  diagnosis: z.string().max(500).optional(),
  icdCodes: z.array(z.string().max(20)).optional(),
  soapNotes: SoapNotesSchema.optional(),
  vitals: VitalsSchema.optional(),
});

// ─── POST /api/consultations — Start ─────────────────────────────────────────

consultationsRouter.post("/", requireScope("consultations:write"), asyncHandler(async (req, res) => {
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

  if (appointment.doctorId !== req.user!.doctor_id!) {
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
    practitionerId: req.user!.doctor_id!,
    startedAt: new Date().toISOString(),
    chiefComplaint,
  }).catch(() => null);

  // Update appointment status to in_progress
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "in_progress" },
  });

  const doctorId = req.user!.doctor_id!;
  const consultation = await prisma.consultation.create({
    data: {
      appointmentId,
      doctorId,
      patientId: appointment.patientId,
      fhirEncounterId: fhirEncounter?.id ?? null,
      chiefComplaint,
      status: "in_progress",
    },
  });

  emitToDoctor(doctorId, SOCKET_EVENTS.CONSULTATION_STATUS_CHANGED, {
    consultationId: consultation.id,
    status: "in_progress",
    patientId: appointment.patientId,
  });

  res.status(201).json(consultation);
}));

// ─── GET /api/consultations — List ───────────────────────────────────────────

consultationsRouter.get("/", requireScope("consultations:read"), asyncHandler(async (req, res) => {
  const { patientId, status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    doctorId: req.user!.doctor_id!,
    ...(patientId ? { patientId } : {}),
    ...(status ? { status: status as import("@prisma/client").ConsultationStatus } : {}),
  };

  const [total, data] = await Promise.all([
    prisma.consultation.count({ where }),
    prisma.consultation.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { startedAt: "desc" },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        prescriptions: { select: { id: true } },
        labOrders: { select: { id: true } },
        invoices: { select: { id: true, status: true, total: true } },
      },
    }),
  ]);

  res.json({ data, meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
}));

// ─── GET /api/consultations/:id ───────────────────────────────────────────────

consultationsRouter.get("/:id", requireScope("consultations:read"), asyncHandler(async (req, res) => {
  const consultation = await prisma.consultation.findUnique({
    where: { id: req.params["id"] },
    include: {
      patient: { select: { id: true, phone: true, fhirPatientId: true } },
      prescriptions: { select: { id: true, status: true, sentAt: true, pdfUrl: true } },
      labOrders: { select: { id: true, tests: true, status: true } },
      invoices: { select: { id: true, total: true, status: true } },
    },
  });

  if (!consultation || consultation.doctorId !== req.user!.doctor_id) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }

  res.json(consultation);
}));

// ─── PATCH /api/consultations/:id ─────────────────────────────────────────────

consultationsRouter.patch("/:id", requireScope("consultations:write"), asyncHandler(async (req, res) => {
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

  if (consultation.doctorId !== req.user!.doctor_id!) {
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
}));

// ─── POST /api/consultations/:id/end ─────────────────────────────────────────

consultationsRouter.post("/:id/end", requireScope("consultations:write"), asyncHandler(async (req, res) => {
  const consultation = await prisma.consultation.findUnique({
    where: { id: req.params["id"] },
    include: { appointment: true },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }

  if (consultation.doctorId !== req.user!.doctor_id!) {
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

  emitToDoctor(consultation.doctorId, SOCKET_EVENTS.CONSULTATION_STATUS_CHANGED, {
    consultationId: consultation.id,
    status: "completed",
    patientId: consultation.patientId,
  });

  res.json(updated);
}));

// ─── POST /api/consultations/:id/telemedicine/room ───────────────────────────

consultationsRouter.post("/:id/telemedicine/room", requireScope("consultations:write"), asyncHandler(async (req, res) => {
  const consultation = await prisma.consultation.findUnique({ where: { id: req.params["id"] } });
  if (!consultation || consultation.doctorId !== req.user!.doctor_id!) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (!process.env["DAILY_API_KEY"]) {
    res.status(503).json({ error: "Telemedicine not configured" });
    return;
  }

  const r = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env["DAILY_API_KEY"]}`,
    },
    body: JSON.stringify({
      name: `cliniqai-${consultation.id.slice(0, 8)}`,
      properties: {
        exp: Math.floor(Date.now() / 1000) + 3600,
        enable_screenshare: false,
      },
    }),
  });

  if (!r.ok) {
    res.status(502).json({ error: "Failed to create video room" });
    return;
  }

  const room = await r.json() as { url: string; name: string };
  res.json({ roomUrl: room.url, roomName: room.name });
}));
