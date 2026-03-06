/**
 * Document Intelligence Worker — Phase 2.
 *
 * Consumes "document.process" Bull queue jobs.
 * Pipeline:
 *   1. Fetch document record from DB
 *   2. POST /ai/documents/extract → MedGemma 27B structured extraction
 *   3. Chunk extracted text → embed via text-embedding-004 (AI service)
 *   4. Store chunks + vectors in documents.document_embeddings (pgvector)
 *   5. Create AiInsight record (pending doctor approval)
 *   6. Mark document status = "extracted" | "failed"
 *
 * Run: tsx src/workers/documentProcessor.ts
 */

import "dotenv/config";
import Bull = require("bull");
import { prisma } from "../lib/prisma.js";
import { aiClient } from "../lib/aiClient.js";
import type { DocumentProcessJob } from "../lib/queues.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const queue = new Bull<DocumentProcessJob>("document.process", REDIS_URL);

queue.process(async (job) => {
  const { documentId } = job.data;
  console.log(`[doc-worker] Processing document ${documentId}`);

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  try {
    // Step 1: Call AI service to extract structured data
    const { extractedData, summary } = await aiClient.documentExtract({
      documentId: document.id,
      gcsPath: document.gcsPath,
      mimeType: document.mimeType,
      documentType: document.type,
    });

    // Step 2: Store extracted data + summary in Document record
    await prisma.document.update({
      where: { id: documentId },
      data: {
        extractedData: extractedData as never,
        aiSummary: summary,
        status: "extracted",
      },
    });

    // Step 3: Create AiInsight for the doctor to review
    await prisma.aiInsight.create({
      data: {
        patientId: document.patientId,
        documentId: document.id,
        type: "document_extraction",
        content: summary,
        metadata: extractedData as never,
        doctorApproved: null, // doctor must approve
      },
    });

    // Step 4: Embed chunks (returned by AI service) and store in pgvector
    const chunks: Array<{ text: string; embedding: number[] }> =
      (extractedData["chunks"] as Array<{ text: string; embedding: number[] }>) ?? [];

    if (chunks.length > 0) {
      // Use raw SQL for pgvector insert since Prisma doesn't support Unsupported() in create
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) continue;
        const embeddingStr = `[${chunk.embedding.join(",")}]`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO documents.document_embeddings (id, document_id, chunk_index, chunk_text, embedding)
           VALUES (gen_random_uuid(), $1, $2, $3, $4::vector)`,
          documentId,
          i,
          chunk.text,
          embeddingStr,
        );
      }
      console.log(`[doc-worker] Stored ${chunks.length} embedding chunks for document ${documentId}`);
    }

    console.log(`[doc-worker] Done: document ${documentId}`);
  } catch (err) {
    console.error(`[doc-worker] Failed: document ${documentId}`, err);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "failed" },
    });
    throw err; // Bull will retry
  }
});

queue.on("failed", (job, err) => {
  console.error(`[doc-worker] Job ${job.id} failed after all attempts:`, err.message);
});

console.log("[doc-worker] Document processor worker started, waiting for jobs…");
