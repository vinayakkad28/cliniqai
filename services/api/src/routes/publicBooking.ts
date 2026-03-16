import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { sendSms } from "../lib/msg91.js";

export const publicBookingRouter = Router();

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

// ─── GET /api/public/doctors/:id ─────────────────────────────────────────────

publicBookingRouter.get("/doctors/:id", asyncHandler(async (req, res) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      specialties: true,
      bio: true,
      workingHours: {
        select: { dayOfWeek: true, startTime: true, endTime: true, slotDurationMins: true },
        orderBy: { dayOfWeek: "asc" },
      },
      clinicDoctors: {
        select: { clinic: { select: { id: true, name: true, address: true } } },
        take: 1,
      },
    },
  });

  if (!doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }

  const clinic = doctor.clinicDoctors[0]?.clinic ?? null;

  res.json({
    id: doctor.id,
    name: doctor.name,
    specialties: doctor.specialties,
    bio: doctor.bio,
    clinic: clinic ? { name: clinic.name, address: clinic.address } : null,
    workingHours: doctor.workingHours,
  });
}));

// ─── GET /api/public/doctors/:id/slots?date=YYYY-MM-DD ──────────────────────

publicBookingRouter.get("/doctors/:id/slots", asyncHandler(async (req, res) => {
  const dateStr = req.query.date as string;
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    res.status(400).json({ error: "date query param required (YYYY-MM-DD)" });
    return;
  }

  const date = new Date(dateStr + "T00:00:00+05:30"); // IST
  const dayName = DAYS[date.getDay()];

  const workingHours = await prisma.workingHours.findMany({
    where: { doctorId: req.params.id, dayOfWeek: dayName as never },
  });

  if (workingHours.length === 0) {
    res.json({ date: dateStr, slots: [], message: "Doctor is not available on this day" });
    return;
  }

  // Generate all possible slots
  const allSlots: string[] = [];
  for (const wh of workingHours) {
    const parts = wh.startTime.split(":").map(Number);
    const endParts = wh.endTime.split(":").map(Number);
    const startMins = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    const endMins = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);
    const duration = wh.slotDurationMins || 15;

    for (let m = startMins; m + duration <= endMins; m += duration) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      allSlots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
  }

  // Get existing appointments for this date
  const dayStart = new Date(dateStr + "T00:00:00+05:30");
  const dayEnd = new Date(dateStr + "T23:59:59+05:30");

  const existing = await prisma.appointment.findMany({
    where: {
      doctorId: req.params.id,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { in: ["scheduled", "confirmed", "in_progress"] },
    },
    select: { scheduledAt: true },
  });

  const bookedSlots = new Set(
    existing.map((a) => {
      const d = new Date(a.scheduledAt);
      // Convert to IST
      const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
      return `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
    })
  );

  // Filter out past slots if date is today
  const now = new Date();
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const isToday = dateStr === istNow.toISOString().split("T")[0];

  const availableSlots = allSlots.filter((slot) => {
    if (bookedSlots.has(slot)) return false;
    if (isToday) {
      const slotParts = slot.split(":").map(Number);
      const slotMins = (slotParts[0] ?? 0) * 60 + (slotParts[1] ?? 0);
      const nowMins = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
      if (slotMins <= nowMins) return false;
    }
    return true;
  });

  res.json({ date: dateStr, slots: availableSlots });
}));

// ─── POST /api/public/book ──────────────────────────────────────────────────

const BookSchema = z.object({
  doctorId: z.string().uuid(),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().max(500).optional(),
});

// Simple rate limit: max 5 bookings per phone per day (in-memory)
const bookingRateLimit = new Map<string, { count: number; resetAt: number }>();

publicBookingRouter.post("/book", asyncHandler(async (req, res) => {
  const result = BookSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { doctorId, phone, name, date, time, reason } = result.data;

  // Rate limit check
  const key = `${phone}:${date}`;
  const now = Date.now();
  const entry = bookingRateLimit.get(key);
  if (entry && now < entry.resetAt) {
    if (entry.count >= 5) {
      res.status(429).json({ error: "Too many bookings for today. Please try again tomorrow." });
      return;
    }
    entry.count++;
  } else {
    bookingRateLimit.set(key, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
  }

  // Verify doctor exists
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId }, select: { id: true, name: true } });
  if (!doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }

  // Build scheduled datetime in IST
  const scheduledAt = new Date(`${date}T${time}:00+05:30`);
  if (isNaN(scheduledAt.getTime())) {
    res.status(400).json({ error: "Invalid date/time" });
    return;
  }

  // Don't allow booking in the past
  if (scheduledAt < new Date()) {
    res.status(400).json({ error: "Cannot book in the past" });
    return;
  }

  // Check for conflicting appointment (same doctor, same time ±15min)
  const slotStart = new Date(scheduledAt.getTime() - 15 * 60 * 1000);
  const slotEnd = new Date(scheduledAt.getTime() + 15 * 60 * 1000);

  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId,
      scheduledAt: { gte: slotStart, lte: slotEnd },
      status: { in: ["scheduled", "confirmed", "in_progress"] },
    },
  });

  if (conflict) {
    res.status(409).json({ error: "This slot is no longer available. Please pick another time." });
    return;
  }

  // Find or create patient
  let patient = await prisma.patient.findFirst({ where: { phone } });
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        phone,
        name,
        fhirPatientId: `local-${Date.now()}`,
        createdByDoctorId: doctorId,
      },
    });
  }

  // Create appointment
  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId,
      scheduledAt,
      type: "scheduled",
      status: "scheduled",
      notes: reason ?? null,
    },
  });

  // Send SMS confirmation (best-effort)
  sendSms({
    phone,
    message: `Your appointment with Dr. ${doctor.name} is confirmed for ${date} at ${time}. - CliniqAI`,
  }).catch(() => {});

  res.status(201).json({
    appointmentId: appointment.id,
    message: "Appointment booked successfully",
    doctor: doctor.name,
    scheduledAt: scheduledAt.toISOString(),
    date,
    time,
  });
}));
