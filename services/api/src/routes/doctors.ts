import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

export const doctorsRouter = Router();

doctorsRouter.use(authenticate);

const patchDoctorSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(2000).optional(),
  specialties: z.array(z.string()).optional(),
  licenseNumber: z.string().optional(),
});

const workingHoursSchema = z.array(
  z.object({
    dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
    slotDurationMins: z.number().int().min(5).max(120).default(15),
  })
);

// GET /api/doctors/me
doctorsRouter.get("/me", async (req, res) => {
  const userId = req.user!.sub;
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    include: {
      workingHours: true,
      clinicDoctors: { include: { clinic: true } },
    },
  });
  if (!doctor) {
    res.status(404).json({ error: "Doctor profile not found" });
    return;
  }
  res.json(doctor);
});

// PATCH /api/doctors/me
doctorsRouter.patch("/me", async (req, res) => {
  const parsed = patchDoctorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.sub;
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) {
    res.status(404).json({ error: "Doctor profile not found" });
    return;
  }

  const updated = await prisma.doctor.update({
    where: { id: doctor.id },
    data: {
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.bio !== undefined && { bio: parsed.data.bio }),
      ...(parsed.data.specialties && { specialties: parsed.data.specialties }),
      ...(parsed.data.licenseNumber && { licenseNumber: parsed.data.licenseNumber }),
    },
  });
  res.json(updated);
});

// GET /api/doctors/me/working-hours
doctorsRouter.get("/me/working-hours", async (req, res) => {
  const userId = req.user!.sub;
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) {
    res.status(404).json({ error: "Doctor profile not found" });
    return;
  }
  const hours = await prisma.workingHours.findMany({
    where: { doctorId: doctor.id },
    orderBy: { dayOfWeek: "asc" },
  });
  res.json(hours);
});

// PUT /api/doctors/me/working-hours
// Replaces all working hours atomically
doctorsRouter.put("/me/working-hours", async (req, res) => {
  const parsed = workingHoursSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.sub;
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) {
    res.status(404).json({ error: "Doctor profile not found" });
    return;
  }

  const hours = await prisma.$transaction([
    prisma.workingHours.deleteMany({ where: { doctorId: doctor.id } }),
    prisma.workingHours.createMany({
      data: parsed.data.map((h) => ({
        doctorId: doctor.id,
        dayOfWeek: h.dayOfWeek,
        startTime: h.startTime,
        endTime: h.endTime,
        slotDurationMins: h.slotDurationMins,
      })),
    }),
  ]);

  res.json({ replaced: hours[1].count });
});

// GET /api/doctors/:id — clinic admin / receptionist use
doctorsRouter.get("/:id", requireRole("admin", "receptionist"), async (req, res) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: req.params["id"] },
    include: { workingHours: true },
  });
  if (!doctor) {
    res.status(404).json({ error: "Doctor not found" });
    return;
  }
  res.json(doctor);
});
