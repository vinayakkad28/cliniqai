-- Phase 2: Document Intelligence + Phase 3: AI Insights + Phase 4: Organizations

-- Enable pgvector extension (idempotent) - skipped if not available
-- CREATE EXTENSION IF NOT EXISTS vector;

-- New schemas
CREATE SCHEMA IF NOT EXISTS "org";
CREATE SCHEMA IF NOT EXISTS "documents";
CREATE SCHEMA IF NOT EXISTS "ai";

-- ─── Organizations ───────────────────────────────────────────────────────────

CREATE TYPE "org"."SubscriptionTier" AS ENUM ('solo', 'clinic', 'hospital', 'enterprise');

CREATE TABLE "org"."organizations" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"              TEXT NOT NULL,
  "gstin"             TEXT,
  "subscription_tier" "org"."SubscriptionTier" NOT NULL DEFAULT 'solo',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Documents ───────────────────────────────────────────────────────────────

CREATE TYPE "documents"."DocumentType" AS ENUM (
  'lab_report', 'prescription_external', 'discharge_summary', 'imaging', 'insurance', 'other'
);

CREATE TYPE "documents"."DocumentStatus" AS ENUM (
  'uploaded', 'processing', 'extracted', 'failed'
);

CREATE TABLE "documents"."documents" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "patient_id"           UUID NOT NULL,
  "uploaded_by_doctor_id" UUID NOT NULL,
  "gcs_path"             TEXT NOT NULL,
  "file_name"            TEXT NOT NULL,
  "mime_type"            TEXT NOT NULL,
  "type"                 "documents"."DocumentType" NOT NULL DEFAULT 'other',
  "status"               "documents"."DocumentStatus" NOT NULL DEFAULT 'uploaded',
  "extracted_data"       JSONB,
  "ai_summary"           TEXT,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "documents_patient_id_idx" ON "documents"."documents" ("patient_id");
CREATE INDEX "documents_status_idx" ON "documents"."documents" ("status");

CREATE TABLE "documents"."document_embeddings" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id"  UUID NOT NULL REFERENCES "documents"."documents" ("id") ON DELETE CASCADE,
  "chunk_index"  INTEGER NOT NULL,
  "chunk_text"   TEXT NOT NULL,
  "embedding"    JSONB,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── AI Insights ─────────────────────────────────────────────────────────────

CREATE TYPE "ai"."AiInsightType" AS ENUM (
  'diagnosis_suggestion', 'drug_interaction', 'lab_interpretation',
  'clinical_alert', 'discharge_summary', 'longitudinal_summary', 'document_extraction'
);

CREATE TABLE "ai"."ai_insights" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "patient_id"     UUID NOT NULL,
  "consultation_id" UUID,
  "document_id"    UUID,
  "type"           "ai"."AiInsightType" NOT NULL,
  "content"        TEXT NOT NULL,
  "metadata"       JSONB,
  "doctor_approved" BOOLEAN,        -- NULL = pending review, TRUE = approved, FALSE = rejected
  "approved_at"    TIMESTAMPTZ,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "ai_insights_patient_id_idx" ON "ai"."ai_insights" ("patient_id");
CREATE INDEX "ai_insights_type_idx" ON "ai"."ai_insights" ("type");
CREATE INDEX "ai_insights_pending_idx" ON "ai"."ai_insights" ("patient_id") WHERE "doctor_approved" IS NULL;
