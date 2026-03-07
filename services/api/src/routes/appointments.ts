import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { smsReminderQueue } from "../lib/queues.js";

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const CreateAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  type: z.enum(["scheduled", "walk_in", "follow_up", "teleconsult"]).default("scheduled"),
  notes: z.string().max(1000).optional(),
});

const UpdateAppointmentSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  notes: z.string().max(1000).optional(),
});

const ListQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // filter by single date YYYY-MM-DD
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // date range start
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),   // date range end
  status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

// ─── GET /api/appointments ────────────────────────────────────────────────────

appointmentsRouter.get("/", requireScope("appointments:read"), async (req, res) => {
  const query = ListQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }

  const { date, from, to, status, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const dateFilter = date
    ? { scheduledAt: { gte: new Date(`${date}T00:00:00.000Z`), lte: new Date(`${date}T23:59:59.999Z`) } }
    : (from || to)
    ? { scheduledAt: { ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } }
    : {};

  const where = {
    doctorId: req.user!.doctor_id!,
    ...(status ? { status } : {}),
    ...dateFilter,
  };

  const [total, appointments] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledAt: "asc" },
      include: {
        patient: {
          select: { id: true, phone: true, fhirPatientId: true, tags: { select: { tag: true } } },
        },
      },
    }),
  ]);

  res.json({ data: appointments, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
});

// ─── POST /api/appointments ───────────────────────────────────────────────────

appointmentsRouter.post("/", requireScope("appointments:write"), async (req, res) => {
  const result = CreateAppointmentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { patientId, scheduledAt, type, notes } = result.data;

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  // Check for conflicting appointment (same doctor, same time ±15min)
  const slotStart = new Date(new Date(scheduledAt).getTime() - 15 * 60 * 1000);
  const slotEnd = new Date(new Date(scheduledAt).getTime() + 15 * 60 * 1000);

  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId: req.user!.doctor_id!,
      scheduledAt: { gte: slotStart, lte: slotEnd },
      status: { in: ["scheduled", "confirmed", "in_progress"] },
    },
  });

  if (conflict) {
    res.status(409).json({ error: "Time slot already booked", conflictId: conflict.id });
    return;
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId: req.user!.doctor_id!,
      scheduledAt: new Date(scheduledAt),
      type,
      notes,
      status: "scheduled",
    },
    include: { patient: { select: { id: true, phone: true } } },
  });

  // Queue SMS reminder 24h before appointment (fire-and-forget)
  const reminderDelay = Math.max(0, new Date(appointment.scheduledAt).getTime() - Date.now() - 24 * 60 * 60 * 1000);
  smsReminderQueue.add(
    {
      appointmentId: appointment.id,
      patientPhone: appointment.patient.phone,
      scheduledAt: appointment.scheduledAt,
    },
    { delay: reminderDelay }
  ).catch(() => {}); // Upstash Redis may not support delayed jobs — silent fail

  res.status(201).json(appointment);
});

// ─── GET /api/appointments/queue ─────────────────────────────────────────────

appointmentsRouter.get("/queue", requireScope("appointments:read"), async (req, res) => {
  const clinicId = req.query["clinicId"] as string | undefined;

  const where = {
    ...(clinicId ? { clinicId } : {}),
    status: "waiting",
  };

  const queue = await prisma.appointmentQueue.findMany({
    where,
    orderBy: { tokenNumber: "asc" },
    include: { patient: { select: { id: true, phone: true } } },
  });

  res.json(queue);
});

// ─── POST /api/appointments/queue ────────────────────────────────────────────

appointmentsRouter.post("/queue", requireScope("appointments:write"), async (req, res) => {
  const result = z.object({
    clinicId: z.string().uuid(),
    patientId: z.string().uuid(),
  }).safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { clinicId, patientId } = result.data;

  // Assign next token number for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastToken = await prisma.appointmentQueue.findFirst({
    where: { clinicId, arrivedAt: { gte: today } },
    orderBy: { tokenNumber: "desc" },
    select: { tokenNumber: true },
  });

  const tokenNumber = (lastToken?.tokenNumber ?? 0) + 1;

  const entry = await prisma.appointmentQueue.create({
    data: { clinicId, patientId, tokenNumber, status: "waiting" },
    include: { patient: { select: { id: true, phone: true } } },
  });

  res.status(201).json({ ...entry, tokenNumber });
});

// ─── GET /api/appointments/:id ────────────────────────────────────────────────

appointmentsRouter.get("/:id", requireScope("appointments:read"), async (req, res) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params["id"] },
    include: {
      patient: { select: { id: true, phone: true, fhirPatientId: true, tags: { select: { tag: true } } } },
      consultation: { select: { id: true, status: true, startedAt: true } },
    },
  });

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json(appointment);
});

// ─── PATCH /api/appointments/:id ─────────────────────────────────────────────

appointmentsRouter.patch("/:id", requireScope("appointments:write"), async (req, res) => {
  const result = UpdateAppointmentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const appointment = await prisma.appointment.findUnique({ where: { id: req.params["id"] } });
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (appointment.doctorId !== req.user!.doctor_id) {
    res.status(403).json({ error: "Not your appointment" });
    return;
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      ...(result.data.scheduledAt ? { scheduledAt: new Date(result.data.scheduledAt) } : {}),
      ...(result.data.status ? { status: result.data.status } : {}),
      ...(result.data.notes !== undefined ? { notes: result.data.notes } : {}),
    },
  });

  res.json(updated);
});

// ─── DELETE /api/appointments/:id ─────────────────────────────────────────────

appointmentsRouter.delete("/:id", requireScope("appointments:write"), async (req, res) => {
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params["id"] } });
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (appointment.doctorId !== req.user!.doctor_id) {
    res.status(403).json({ error: "Not your appointment" });
    return;
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "cancelled" },
  });

  res.json({ message: "Appointment cancelled" });
});
