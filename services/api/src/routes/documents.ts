/**
 * Document Intelligence routes — Phase 2.
 *
 * Upload flow:
 *   1. POST /api/documents/upload-url  → returns presigned GCS PUT URL + document record
 *   2. Client PUTs file directly to GCS using the signed URL
 *   3. Client calls POST /api/documents/:id/confirm → enqueues processing job
 *
 * Processing (async via Bull):
 *   - Extract text (PDF.js / Cloud Vision OCR)
 *   - POST /ai/documents/extract → MedGemma 27B structured extraction
 *   - Chunk text → text-embedding-004 → store in pgvector
 *   - Store AiInsight record (pending doctor approval)
 */

import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { getSignedUploadUrl, getSignedReadUrl } from "../lib/storageClient.js";
import { documentProcessQueue } from "../lib/queues.js";

export const documentsRouter = Router();
documentsRouter.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const RequestUploadSchema = z.object({
  patientId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
  ]),
  type: z
    .enum(["lab_report", "prescription_external", "discharge_summary", "imaging", "insurance", "other"])
    .default("other"),
});

// ─── POST /api/documents/upload-url ──────────────────────────────────────────

documentsRouter.post("/upload-url", requireScope("patients:write"), async (req, res) => {
  const result = RequestUploadSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { patientId, fileName, mimeType, type } = result.data;

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const gcsPath = `patients/${patientId}/documents/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const [uploadUrl, document] = await Promise.all([
    getSignedUploadUrl(gcsPath, mimeType),
    prisma.document.create({
      data: {
        patientId,
        uploadedByDoctorId: req.user!.doctor_id ?? req.user!.sub,
        gcsPath,
        fileName,
        mimeType,
        type: type as never,
        status: "uploaded",
      },
    }),
  ]);

  res.status(201).json({ document, uploadUrl });
});

// ─── POST /api/documents/:id/confirm ─────────────────────────────────────────

documentsRouter.post("/:id/confirm", requireScope("patients:write"), async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params["id"] } });
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  await prisma.document.update({
    where: { id: document.id },
    data: { status: "processing" },
  });

  documentProcessQueue.add(
    { documentId: document.id },
    { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  ).catch(() => {}); // fire-and-forget

  res.json({ message: "Processing started", documentId: document.id });
});

// ─── GET /api/documents — list for patient ───────────────────────────────────

documentsRouter.get("/", requireScope("patients:read"), async (req, res) => {
  const patientId = req.query["patientId"] as string | undefined;
  if (!patientId) {
    res.status(400).json({ error: "patientId query param required" });
    return;
  }

  const docs = await prisma.document.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, fileName: true, mimeType: true, type: true,
      status: true, aiSummary: true, createdAt: true,
    },
  });

  res.json({ data: docs });
});

// ─── GET /api/documents/:id ───────────────────────────────────────────────────

documentsRouter.get("/:id", requireScope("patients:read"), async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params["id"] } });
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const readUrl = await getSignedReadUrl(document.gcsPath).catch(() => null);
  res.json({ ...document, readUrl });
});

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────

documentsRouter.delete("/:id", requireScope("patients:write"), async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params["id"] } });
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  await prisma.document.delete({ where: { id: document.id } });
  res.status(204).end();
});
