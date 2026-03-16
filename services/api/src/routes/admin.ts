import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole("admin"));

// GET /api/admin/clinics — List clinics with doctor counts
adminRouter.get(
  "/clinics",
  asyncHandler(async (req, res) => {
    const clinics = await prisma.clinic.findMany({
      include: {
        _count: { select: { clinicDoctors: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = clinics.map((c: typeof clinics[number]) => ({
      id: c.id,
      name: c.name,
      address: c.address,
      gstNumber: c.gstNumber,
      logoUrl: c.logoUrl,
      abdmRegistered: c.abdmRegistered,
      createdAt: c.createdAt,
      doctorCount: c._count.clinicDoctors,
    }));

    res.json({ clinics: result });
  })
);

// POST /api/admin/clinics — Create clinic
adminRouter.post(
  "/clinics",
  asyncHandler(async (req, res) => {
    const { name, address, gstNumber } = req.body;

    if (!name || !address) {
      res.status(400).json({ error: "name and address are required" });
      return;
    }

    const clinic = await prisma.clinic.create({
      data: {
        name,
        address,
        gstNumber: gstNumber ?? null,
      },
    });

    res.status(201).json({ clinic });
  })
);

// POST /api/admin/clinics/:id/doctors — Add doctor to clinic
adminRouter.post(
  "/clinics/:id/doctors",
  asyncHandler(async (req, res) => {
    const clinicId = req.params.id!;
    const { doctorId, role } = req.body;

    if (!doctorId) {
      res.status(400).json({ error: "doctorId is required" });
      return;
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      res.status(404).json({ error: "Clinic not found" });
      return;
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const existing = await prisma.clinicDoctor.findUnique({
      where: { clinicId_doctorId: { clinicId, doctorId } },
    });
    if (existing) {
      res.status(409).json({ error: "Doctor is already assigned to this clinic" });
      return;
    }

    const clinicDoctor = await prisma.clinicDoctor.create({
      data: {
        clinicId,
        doctorId,
        role: role ?? "doctor",
      },
    });

    res.status(201).json({ clinicDoctor });
  })
);

// DELETE /api/admin/clinics/:id/doctors/:doctorId — Remove doctor from clinic
adminRouter.delete(
  "/clinics/:id/doctors/:doctorId",
  asyncHandler(async (req, res) => {
    const clinicId = req.params.id!;
    const doctorId = req.params.doctorId!;

    const existing = await prisma.clinicDoctor.findUnique({
      where: { clinicId_doctorId: { clinicId, doctorId } },
    });
    if (!existing) {
      res.status(404).json({ error: "Doctor is not assigned to this clinic" });
      return;
    }

    await prisma.clinicDoctor.delete({
      where: { clinicId_doctorId: { clinicId, doctorId } },
    });

    res.json({ message: "Doctor removed from clinic" });
  })
);

// PATCH /api/admin/users/:id/role — Change user role
adminRouter.patch(
  "/users/:id/role",
  asyncHandler(async (req, res) => {
    const userId = req.params.id!;
    const { role } = req.body;

    const validRoles = ["doctor", "nurse", "admin", "receptionist", "patient"];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({
        error: `role is required and must be one of: ${validRoles.join(", ")}`,
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Prevent admins from changing their own role
    if (userId === req.user!.sub) {
      res.status(400).json({ error: "Cannot change your own role" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, phone: true, role: true, name: true },
    });

    res.json({ user: updated });
  })
);
