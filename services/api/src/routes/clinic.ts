import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const clinicRouter = Router();

clinicRouter.use(authenticate);

const PatchClinicSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  address: z.string().max(1000).optional(),
  gstNumber: z.string().max(50).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

// GET /api/clinic/me — returns the doctor's clinic or null
clinicRouter.get("/me", asyncHandler(async (req, res) => {
  const doctorId = req.user!.doctor_id;
  if (!doctorId) {
    res.status(403).json({ error: "Doctor profile required" });
    return;
  }

  const link = await prisma.clinicDoctor.findFirst({
    where: { doctorId },
    include: { clinic: true },
  });

  res.json(link?.clinic ?? null);
}));

// PATCH /api/clinic/me — upsert the doctor's clinic
clinicRouter.patch("/me", asyncHandler(async (req, res) => {
  const doctorId = req.user!.doctor_id;
  if (!doctorId) {
    res.status(403).json({ error: "Doctor profile required" });
    return;
  }

  const parsed = PatchClinicSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, address, gstNumber, logoUrl } = parsed.data;

  // Check if doctor already has a clinic
  const existing = await prisma.clinicDoctor.findFirst({
    where: { doctorId },
    include: { clinic: true },
  });

  let clinic;
  if (existing) {
    clinic = await prisma.clinic.update({
      where: { id: existing.clinicId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(gstNumber !== undefined ? { gstNumber } : {}),
        ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
      },
    });
  } else {
    // Create a new clinic and link the doctor
    clinic = await prisma.clinic.create({
      data: {
        name: name ?? "My Clinic",
        address: address ?? "",
        gstNumber: gstNumber ?? null,
        logoUrl: logoUrl || null,
        clinicDoctors: {
          create: { doctorId, role: "doctor" },
        },
      },
    });
  }

  res.json(clinic);
}));
