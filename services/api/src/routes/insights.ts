/**
 * AI Insights routes — Phase 3.
 *
 * All AI-generated insights require explicit doctor approval before they can
 * be acted upon (compliance: AI is advisory, never autonomous).
 *
 * POST /api/insights/request  — trigger AI insight generation for a patient
 * GET  /api/insights           — list insights (with filters)
 * PATCH /api/insights/:id/approve — doctor approves or rejects an insight
 */

import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { aiClient } from "../lib/aiClient.js";
import { clinicalAlertQueue } from "../lib/queues.js";

export const insightsRouter = Router();
insightsRouter.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const RequestInsightSchema = z.object({
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().optional(),
  type: z.enum([
    "diagnosis_suggestion",
    "drug_interaction",
    "lab_interpretation",
    "clinical_alert",
    "discharge_summary",
    "longitudinal_summary",
    "document_extraction",
  ]),
  context: z.record(z.unknown()).optional(), // additional context payload
});

const ApproveSchema = z.object({
  approved: z.boolean(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  type: z.string().optional(),
  pending: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── POST /api/insights/request ──────────────────────────────────────────────

insightsRouter.post("/request", requireScope("consultations:write"), async (req, res) => {
  const result = RequestInsightSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { patientId, consultationId, type, context } = result.data;

  // Enqueue async clinical alert processing
  if (type === "clinical_alert") {
    await clinicalAlertQueue.add({
      patientId,
      consultationId,
      triggerType: "new_consultation",
    });
    res.json({ message: "Clinical alert evaluation queued", patientId });
    return;
  }

  // For synchronous insight types, call AI service directly
  let aiContent: string;
  try {
    aiContent = await generateInsight(type, patientId, consultationId, context);
  } catch {
    res.status(503).json({ error: "AI service unavailable — please retry" });
    return;
  }

  const insight = await prisma.aiInsight.create({
    data: {
      patientId,
      consultationId,
      type: type as never,
      content: aiContent,
      metadata: context as never,
      doctorApproved: null, // pending review
    },
  });

  res.status(201).json(insight);
});

// ─── GET /api/insights ────────────────────────────────────────────────────────

insightsRouter.get("/", requireScope("consultations:read"), async (req, res) => {
  const query = ListQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }

  const { patientId, type, pending, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where = {
    ...(patientId ? { patientId } : {}),
    ...(type ? { type: type as never } : {}),
    ...(pending ? { doctorApproved: null } : {}),
  };

  const [total, insights] = await Promise.all([
    prisma.aiInsight.count({ where }),
    prisma.aiInsight.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  res.json({ data: insights, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
});

// ─── PATCH /api/insights/:id/approve ─────────────────────────────────────────

insightsRouter.patch("/:id/approve", requireScope("consultations:write"), async (req, res) => {
  const result = ApproveSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const insight = await prisma.aiInsight.findUnique({ where: { id: req.params["id"] } });
  if (!insight) {
    res.status(404).json({ error: "Insight not found" });
    return;
  }

  const updated = await prisma.aiInsight.update({
    where: { id: insight.id },
    data: {
      doctorApproved: result.data.approved,
      approvedAt: new Date(),
    },
  });

  res.json(updated);
});

// ─── GET /api/insights/longitudinal/:patientId ───────────────────────────────

insightsRouter.get("/longitudinal/:patientId", requireScope("patients:read"), async (req, res) => {
  const patientId = req.params["patientId"] as string;

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  // Check for a recent longitudinal summary (< 24h old) to avoid redundant calls
  const recentSummary = await prisma.aiInsight.findFirst({
    where: {
      patientId,
      type: "longitudinal_summary",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentSummary) {
    res.json({ insight: recentSummary, cached: true });
    return;
  }

  // Fetch context: last 10 consultations + approved insights
  const [consultations, approvedInsights] = await Promise.all([
    prisma.consultation.findMany({
      where: { patientId },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { id: true, startedAt: true, chiefComplaint: true, notes: true, status: true },
    }),
    prisma.aiInsight.findMany({
      where: { patientId, doctorApproved: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { type: true, content: true, createdAt: true },
    }),
  ]);

  let summaryContent: string;
  try {
    summaryContent = await aiClient.longitudinalSummary({
      patientId,
      consultations,
      approvedInsights,
    });
  } catch {
    res.status(503).json({ error: "AI service unavailable" });
    return;
  }

  const insight = await prisma.aiInsight.create({
    data: {
      patientId,
      type: "longitudinal_summary",
      content: summaryContent,
      doctorApproved: null,
    },
  });

  res.json({ insight, cached: false });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateInsight(
  type: string,
  patientId: string,
  _consultationId?: string,
  context?: Record<string, unknown>,
): Promise<string> {
  switch (type) {
    case "diagnosis_suggestion": {
      const r = await aiClient.suggestDiagnosis({
        patientId,
        symptoms: (context?.["symptoms"] as string[]) ?? [],
      });
      return JSON.stringify(r);
    }
    case "drug_interaction": {
      const alerts = await aiClient.checkDdi(
        (context?.["medications"] as string[]) ?? [],
        patientId,
      );
      return JSON.stringify(alerts);
    }
    case "lab_interpretation": {
      const r = await aiClient.interpretLabResults({
        patientId,
        labOrderId: (context?.["labOrderId"] as string) ?? "",
        results: (context?.["results"] as Parameters<typeof aiClient.interpretLabResults>[0]["results"]) ?? [],
      });
      return r.plainLanguageSummary;
    }
    case "discharge_summary":
    case "longitudinal_summary":
      return aiClient.longitudinalSummary({ patientId, consultations: [], approvedInsights: [] });
    default:
      throw new Error(`Unknown insight type: ${type}`);
  }
}
