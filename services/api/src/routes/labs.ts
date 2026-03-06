import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { fhirClient } from "../lib/fhirClient.js";
import { aiClient } from "../lib/aiClient.js";

export const labsRouter = Router();

labsRouter.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const CreateLabOrderSchema = z.object({
  consultationId: z.string().uuid(),
  tests: z.array(z.string().min(1)).min(1),
});

const LabResultSchema = z.object({
  resultFileUrl: z.string().url(),
  results: z
    .array(
      z.object({
        name: z.string(),
        value: z.union([z.number(), z.string()]),
        unit: z.string(),
        referenceRange: z.string().optional(),
        flag: z.enum(["H", "L", "HH", "LL", "N"]).optional(),
      }),
    )
    .optional(),
});

// ─── POST /api/labs/orders ────────────────────────────────────────────────────

labsRouter.post("/orders", requireScope("labs:write"), async (req, res) => {
  const result = CreateLabOrderSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { consultationId, tests } = result.data;

  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: { patient: true },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }

  if (consultation.doctorId !== req.user!.sub) {
    res.status(403).json({ error: "Not your consultation" });
    return;
  }

  // Create FHIR ServiceRequest
  const fhirServiceReq = await fhirClient
    .createServiceRequest({
      patientFhirId: consultation.patient.fhirPatientId,
      encounterId: consultation.fhirEncounterId ?? "",
      tests,
    })
    .catch(() => null);

  const order = await prisma.labOrder.create({
    data: {
      consultationId,
      patientId: consultation.patientId,
      tests,
      status: "pending",
      fhirServiceRequestId: fhirServiceReq?.id ?? null,
    },
  });

  res.status(201).json(order);
});

// ─── GET /api/labs/orders/:id ─────────────────────────────────────────────────

labsRouter.get("/orders/:id", requireScope("labs:read"), async (req, res) => {
  const order = await prisma.labOrder.findUnique({
    where: { id: req.params["id"] },
    include: {
      results: true,
      patient: { select: { id: true, phone: true, fhirPatientId: true } },
    },
  });

  if (!order) {
    res.status(404).json({ error: "Lab order not found" });
    return;
  }

  res.json(order);
});

// ─── POST /api/labs/orders/:id/results ───────────────────────────────────────

labsRouter.post("/orders/:id/results", requireScope("labs:write"), async (req, res) => {
  const bodyResult = LabResultSchema.safeParse(req.body);
  if (!bodyResult.success) {
    res.status(400).json({ error: bodyResult.error.flatten() });
    return;
  }

  const order = await prisma.labOrder.findUnique({
    where: { id: req.params["id"] },
    include: { patient: true },
  });

  if (!order) {
    res.status(404).json({ error: "Lab order not found" });
    return;
  }

  const { resultFileUrl, results } = bodyResult.data;

  // Async: run AI interpretation if structured results provided
  let aiSummary: string | null = null;
  if (results && results.length > 0) {
    const interp = await aiClient
      .interpretLabResults({
        patientId: order.patientId,
        labOrderId: order.id,
        results,
      })
      .catch(() => null);
    aiSummary = interp?.plainLanguageSummary ?? null;
  }

  // Create FHIR DiagnosticReport
  const fhirReport = await fhirClient
    .createDiagnosticReport({
      patientFhirId: order.patient.fhirPatientId,
      serviceRequestId: order.fhirServiceRequestId ?? "",
      resultFileUrl,
      aiSummary: aiSummary ?? undefined,
    })
    .catch(() => null);

  const [labResult] = await prisma.$transaction([
    prisma.labResult.create({
      data: {
        labOrderId: order.id,
        fhirDiagnosticReportId: fhirReport?.id ?? null,
        resultFileUrl,
        aiSummary,
      },
    }),
    prisma.labOrder.update({
      where: { id: order.id },
      data: { status: "completed" },
    }),
  ]);

  res.status(201).json({ labResult, aiSummary });
});

// ─── POST /api/labs/webhook — Partner lab result delivery ────────────────────

labsRouter.post("/webhook", async (req, res) => {
  // Authenticated by webhook secret, NOT JWT
  const secret = req.headers["x-webhook-secret"];
  if (!secret || secret !== process.env["LAB_WEBHOOK_SECRET"]) {
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }

  const body = z
    .object({
      labOrderId: z.string(),
      resultFileUrl: z.string().url(),
      results: z.array(z.any()).optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() });
    return;
  }

  // Delegate to the results endpoint logic
  const order = await prisma.labOrder.findUnique({ where: { id: body.data.labOrderId } });
  if (!order) {
    res.status(404).json({ error: "Lab order not found" });
    return;
  }

  await prisma.labResult.create({
    data: {
      labOrderId: order.id,
      resultFileUrl: body.data.resultFileUrl,
    },
  });

  await prisma.labOrder.update({ where: { id: order.id }, data: { status: "completed" } });

  res.json({ message: "Result received" });
});
