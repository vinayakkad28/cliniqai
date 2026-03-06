import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { fhirClient } from "../lib/fhirClient.js";

export const patientsRouter = Router();

patientsRouter.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const CreatePatientSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
  name: z.string().min(2).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  address: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).optional(),
});

const UpdatePatientSchema = CreatePatientSchema.partial().omit({ phone: true });

const ListQuerySchema = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── GET /api/patients ────────────────────────────────────────────────────────

patientsRouter.get("/", requireScope("patients:read"), async (req, res) => {
  const query = ListQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }

  const { search, tag, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where = {
    createdByDoctorId: req.user!.sub,
    ...(tag ? { tags: { some: { tag } } } : {}),
  };

  const [total, patients] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        phone: true,
        fhirPatientId: true,
        createdAt: true,
        tags: { select: { tag: true } },
      },
    }),
  ]);

  res.json({
    data: patients,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// ─── POST /api/patients ───────────────────────────────────────────────────────

patientsRouter.post("/", requireScope("patients:write"), async (req, res) => {
  const result = CreatePatientSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { phone, name, dateOfBirth, gender, address, tags } = result.data;

  const existing = await prisma.patient.findUnique({ where: { phone } });
  if (existing) {
    res.status(409).json({ error: "Patient with this phone already exists", patientId: existing.id });
    return;
  }

  // Create FHIR Patient resource (best-effort — FHIR service may not be running locally)
  const fhirPatient = await fhirClient.createPatient({ name, phone, dateOfBirth, gender, address }).catch(() => null);
  const fhirPatientId = fhirPatient?.id ?? `local-${Date.now()}`;

  const patient = await prisma.patient.create({
    data: {
      phone,
      fhirPatientId,
      createdByDoctorId: req.user!.sub,
      tags: tags ? { create: tags.map((tag) => ({ tag })) } : undefined,
    },
    include: { tags: true },
  });

  res.status(201).json({ ...patient, fhirPatient });
});

// ─── GET /api/patients/:id ────────────────────────────────────────────────────

patientsRouter.get("/:id", requireScope("patients:read"), async (req, res) => {
  const patient = await prisma.patient.findUnique({
    where: { id: req.params["id"] },
    include: { tags: true },
  });

  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  // Fetch demographics from FHIR
  const fhirPatient = await fhirClient.getPatient(patient.fhirPatientId).catch(() => null);

  res.json({ ...patient, fhirPatient });
});

// ─── PATCH /api/patients/:id ──────────────────────────────────────────────────

patientsRouter.patch("/:id", requireScope("patients:write"), async (req, res) => {
  const result = UpdatePatientSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const patient = await prisma.patient.findUnique({ where: { id: req.params["id"] } });
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const { tags, ...fhirFields } = result.data;

  // Update FHIR Patient (best-effort)
  if (Object.keys(fhirFields).length > 0) {
    await fhirClient.updatePatient(patient.fhirPatientId, fhirFields).catch(() => null);
  }

  // Update tags if provided
  if (tags !== undefined) {
    await prisma.patientTag.deleteMany({ where: { patientId: patient.id } });
    if (tags.length > 0) {
      await prisma.patientTag.createMany({
        data: tags.map((tag) => ({ patientId: patient.id, tag })),
      });
    }
  }

  const updated = await prisma.patient.findUnique({
    where: { id: patient.id },
    include: { tags: true },
  });

  res.json(updated);
});

// ─── GET /api/patients/:id/timeline ──────────────────────────────────────────

patientsRouter.get("/:id/timeline", requireScope("patients:read"), async (req, res) => {
  const patient = await prisma.patient.findUnique({ where: { id: req.params["id"] } });
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const [consultations, labOrders] = await Promise.all([
    prisma.consultation.findMany({
      where: { patientId: patient.id },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true, startedAt: true, endedAt: true, chiefComplaint: true, status: true,
        prescriptions: { select: { id: true, status: true, sentAt: true } },
        labOrders: { select: { id: true, tests: true, status: true } },
      },
    }),
    prisma.labOrder.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, tests: true, status: true, createdAt: true },
    }),
  ]);

  res.json({ consultations, labOrders });
});
