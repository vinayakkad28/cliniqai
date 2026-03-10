import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { fhirClient } from "../lib/fhirClient.js";
import { aiClient } from "../lib/aiClient.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const patientsRouter = Router();

patientsRouter.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const CreatePatientSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
  name: z.string().min(2).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  bloodGroup: z.string().max(5).optional(),
  address: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).optional(),
});

const MedicalHistorySchema = z.object({
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  pastSurgeries: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  familyHistory: z.string().max(1000).optional(),
});

const UpdatePatientSchema = CreatePatientSchema.partial().omit({ phone: true }).extend({
  medicalHistory: MedicalHistorySchema.optional(),
});

const ListQuerySchema = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── GET /api/patients ────────────────────────────────────────────────────────

patientsRouter.get("/", requireScope("patients:read"), asyncHandler(async (req, res) => {
  const query = ListQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }

  const { search, tag, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where = {
    createdByDoctorId: req.user!.doctor_id ?? req.user!.sub,
    ...(tag ? { tags: { some: { tag } } } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search } },
      ],
    } : {}),
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
        name: true,
        phone: true,
        gender: true,
        dateOfBirth: true,
        bloodGroup: true,
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
}));

// ─── POST /api/patients ───────────────────────────────────────────────────────

patientsRouter.post("/", requireScope("patients:write"), asyncHandler(async (req, res) => {
  const result = CreatePatientSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { phone, name, dateOfBirth, gender, bloodGroup, address, tags } = result.data;

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
      name,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender,
      bloodGroup,
      address,
      fhirPatientId,
      createdByDoctorId: req.user!.doctor_id ?? req.user!.sub,
      tags: tags ? { create: tags.map((tag) => ({ tag })) } : undefined,
    },
    include: { tags: true },
  });

  res.status(201).json({ ...patient, fhirPatient });
}));

// ─── GET /api/patients/:id ────────────────────────────────────────────────────

patientsRouter.get("/:id", requireScope("patients:read"), asyncHandler(async (req, res) => {
  const patient = await prisma.patient.findUnique({
    where: { id: req.params["id"] },
    include: { tags: true },
  });

  if (!patient || patient.createdByDoctorId !== (req.user!.doctor_id ?? req.user!.sub)) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  // Fetch demographics from FHIR
  const fhirPatient = await fhirClient.getPatient(patient.fhirPatientId).catch(() => null);

  res.json({ ...patient, fhirPatient });
}));

// ─── PATCH /api/patients/:id ──────────────────────────────────────────────────

patientsRouter.patch("/:id", requireScope("patients:write"), asyncHandler(async (req, res) => {
  const result = UpdatePatientSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const patient = await prisma.patient.findUnique({ where: { id: req.params["id"] } });
  if (!patient || patient.createdByDoctorId !== (req.user!.doctor_id ?? req.user!.sub)) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const { tags, medicalHistory, name, dateOfBirth, gender, address, ...fhirFields } = result.data;

  // Save demographics + medical history locally
  const localUpdate: Record<string, unknown> = {};
  if (name !== undefined) localUpdate.name = name;
  if (dateOfBirth !== undefined) localUpdate.dateOfBirth = new Date(dateOfBirth);
  if (gender !== undefined) localUpdate.gender = gender;
  if (address !== undefined) localUpdate.address = address;
  if (medicalHistory !== undefined) localUpdate.medicalHistory = medicalHistory;

  if (Object.keys(localUpdate).length > 0) {
    await prisma.patient.update({
      where: { id: patient.id },
      data: localUpdate,
    });
  }

  // Update FHIR Patient (best-effort)
  const allFhirFields = { name, dateOfBirth, gender, address, ...fhirFields };
  const fhirFieldsToUpdate = Object.fromEntries(Object.entries(allFhirFields).filter(([, v]) => v !== undefined));
  if (Object.keys(fhirFieldsToUpdate).length > 0) {
    await fhirClient.updatePatient(patient.fhirPatientId, fhirFieldsToUpdate).catch(() => null);
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
}));

// ─── GET /api/patients/:id/timeline ──────────────────────────────────────────

patientsRouter.get("/:id/timeline", requireScope("patients:read"), asyncHandler(async (req, res) => {
  const patient = await prisma.patient.findUnique({ where: { id: req.params["id"] } });
  if (!patient || patient.createdByDoctorId !== (req.user!.doctor_id ?? req.user!.sub)) {
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
}));

// ─── POST /api/patients/:id/search — AI natural language record search ────────

patientsRouter.post("/:id/search", requireScope("patients:read"), asyncHandler(async (req, res) => {
  const result = z.object({ query: z.string().min(3).max(500) }).safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const patient = await prisma.patient.findUnique({ where: { id: req.params["id"] } });
  if (!patient || patient.createdByDoctorId !== (req.user!.doctor_id ?? req.user!.sub)) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const answer = await aiClient.vectorSearch({
    query: result.data.query,
    patientId: patient.fhirPatientId,
  }).catch(() => null);

  res.json({ answer: answer ?? [], patientId: patient.id, query: result.data.query });
}));
