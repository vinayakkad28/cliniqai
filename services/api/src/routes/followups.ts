import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

export const followupsRouter = Router();

followupsRouter.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const CreateFollowupSchema = z.object({
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().optional(),
  scheduledDate: z.string().datetime(),
  reason: z.string().min(1).max(500),
  channel: z.enum(["sms", "whatsapp", "email"]),
});

const UpdateFollowupSchema = z.object({
  status: z.enum(["pending", "sent", "acknowledged", "cancelled"]),
});

const ListQuerySchema = z.object({
  status: z.enum(["pending", "sent", "acknowledged", "cancelled"]).optional(),
  patientId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

const AutoGenerateSchema = z.object({
  consultationId: z.string().uuid(),
  diagnosis: z.string().min(1),
  patientId: z.string().uuid(),
  channel: z.enum(["sms", "whatsapp", "email"]).default("whatsapp"),
});

// ─── Diagnosis → follow-up interval mapping ────────────────────────────────

const DIAGNOSIS_FOLLOWUP_RULES: Record<string, { days: number; reason: string }> = {
  diabetes:         { days: 90,  reason: "3-month diabetes checkup — HbA1c review" },
  "type 2 diabetes": { days: 90,  reason: "3-month diabetes checkup — HbA1c review" },
  hypertension:     { days: 30,  reason: "Monthly BP monitoring and medication review" },
  asthma:           { days: 60,  reason: "Bi-monthly asthma control assessment" },
  hypothyroidism:   { days: 90,  reason: "Quarterly thyroid function test review" },
  "upper respiratory infection": { days: 7, reason: "Follow-up if symptoms persist after 7 days" },
  uti:              { days: 7,   reason: "Post-antibiotic follow-up for UTI" },
  "urinary tract infection": { days: 7, reason: "Post-antibiotic follow-up for UTI" },
  gastritis:        { days: 14,  reason: "2-week follow-up to assess symptom resolution" },
  "anxiety disorder": { days: 30, reason: "Monthly mental health follow-up" },
  depression:       { days: 30,  reason: "Monthly mental health follow-up" },
  "lower back pain": { days: 14, reason: "2-week follow-up for pain management review" },
  pregnancy:        { days: 30,  reason: "Monthly prenatal checkup" },
  "allergic rhinitis": { days: 30, reason: "Monthly allergy management review" },
  anemia:           { days: 30,  reason: "Monthly hemoglobin monitoring" },
};

function matchDiagnosisRule(diagnosis: string): { days: number; reason: string } | null {
  const lower = diagnosis.toLowerCase().trim();
  for (const [key, rule] of Object.entries(DIAGNOSIS_FOLLOWUP_RULES)) {
    if (lower.includes(key)) return rule;
  }
  // Default: 30-day follow-up for unrecognized diagnoses
  return null;
}

// ─── POST /api/followups ────────────────────────────────────────────────────

followupsRouter.post("/", async (req: Request, res: Response) => {
  const result = CreateFollowupSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { patientId, consultationId, scheduledDate, reason, channel } = result.data;

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const followup = await prisma.followup.create({
    data: {
      patientId,
      consultationId: consultationId ?? null,
      doctorId: req.user!.doctor_id!,
      scheduledDate: new Date(scheduledDate),
      reason,
      channel,
      status: "pending",
    },
    include: {
      patient: { select: { id: true, phone: true } },
    },
  });

  res.status(201).json(followup);
});

// ─── GET /api/followups ─────────────────────────────────────────────────────

followupsRouter.get("/", async (req: Request, res: Response) => {
  const query = ListQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }

  const { status, patientId, from, to, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const dateFilter = (from || to)
    ? {
        scheduledDate: {
          ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
        },
      }
    : {};

  const where = {
    doctorId: req.user!.doctor_id!,
    ...(status ? { status } : {}),
    ...(patientId ? { patientId } : {}),
    ...dateFilter,
  };

  const [total, followups] = await Promise.all([
    prisma.followup.count({ where }),
    prisma.followup.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledDate: "asc" },
      include: {
        patient: { select: { id: true, phone: true } },
      },
    }),
  ]);

  res.json({
    data: followups,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// ─── GET /api/followups/due ─────────────────────────────────────────────────

followupsRouter.get("/due", async (req: Request, res: Response) => {
  const rangeParam = (req.query["range"] as string) || "today";

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let endDate: Date;

  if (rangeParam === "week") {
    endDate = new Date(startOfDay);
    endDate.setDate(endDate.getDate() + 7);
  } else {
    // default: today
    endDate = new Date(startOfDay);
    endDate.setDate(endDate.getDate() + 1);
  }

  const followups = await prisma.followup.findMany({
    where: {
      doctorId: req.user!.doctor_id!,
      status: "pending",
      scheduledDate: {
        gte: startOfDay,
        lt: endDate,
      },
    },
    orderBy: { scheduledDate: "asc" },
    include: {
      patient: { select: { id: true, phone: true } },
    },
  });

  res.json({ data: followups, meta: { total: followups.length, range: rangeParam } });
});

// ─── POST /api/followups/auto-generate ──────────────────────────────────────

followupsRouter.post("/auto-generate", async (req: Request, res: Response) => {
  const result = AutoGenerateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { consultationId, diagnosis, patientId, channel } = result.data;

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const rule = matchDiagnosisRule(diagnosis);
  if (!rule) {
    res.status(200).json({
      message: "No automatic follow-up rule found for this diagnosis",
      diagnosis,
      created: null,
    });
    return;
  }

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + rule.days);

  // Check for existing pending follow-up to avoid duplicates
  const existing = await prisma.followup.findFirst({
    where: {
      patientId,
      consultationId,
      status: "pending",
      scheduledDate: {
        gte: new Date(scheduledDate.getTime() - 7 * 24 * 3600 * 1000),
        lte: new Date(scheduledDate.getTime() + 7 * 24 * 3600 * 1000),
      },
    },
  });

  if (existing) {
    res.status(200).json({
      message: "A follow-up already exists for this consultation within the expected window",
      existing,
      created: null,
    });
    return;
  }

  const followup = await prisma.followup.create({
    data: {
      patientId,
      consultationId,
      doctorId: req.user!.doctor_id!,
      scheduledDate,
      reason: rule.reason,
      channel,
      status: "pending",
    },
    include: {
      patient: { select: { id: true, phone: true } },
    },
  });

  res.status(201).json({
    message: `Follow-up scheduled in ${rule.days} days based on diagnosis: ${diagnosis}`,
    created: followup,
  });
});

// ─── PATCH /api/followups/:id ───────────────────────────────────────────────

followupsRouter.patch("/:id", async (req: Request, res: Response) => {
  const result = UpdateFollowupSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const followup = await prisma.followup.findUnique({ where: { id: req.params["id"] } });
  if (!followup) {
    res.status(404).json({ error: "Follow-up not found" });
    return;
  }

  if (followup.doctorId !== req.user!.doctor_id) {
    res.status(403).json({ error: "Not your follow-up" });
    return;
  }

  const updated = await prisma.followup.update({
    where: { id: followup.id },
    data: { status: result.data.status },
    include: {
      patient: { select: { id: true, phone: true } },
    },
  });

  res.json(updated);
});

// ─── DELETE /api/followups/:id ──────────────────────────────────────────────

followupsRouter.delete("/:id", async (req: Request, res: Response) => {
  const followup = await prisma.followup.findUnique({ where: { id: req.params["id"] } });
  if (!followup) {
    res.status(404).json({ error: "Follow-up not found" });
    return;
  }

  if (followup.doctorId !== req.user!.doctor_id) {
    res.status(403).json({ error: "Not your follow-up" });
    return;
  }

  await prisma.followup.update({
    where: { id: followup.id },
    data: { status: "cancelled" },
  });

  res.json({ message: "Follow-up cancelled" });
});
