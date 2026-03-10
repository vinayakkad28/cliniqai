-- Add patient demographics to local DB (previously FHIR-only)
ALTER TABLE "patients"."patients" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "patients"."patients" ADD COLUMN IF NOT EXISTS "date_of_birth" TIMESTAMP(3);
ALTER TABLE "patients"."patients" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "patients"."patients" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "patients"."patients" ADD COLUMN IF NOT EXISTS "blood_group" TEXT;

-- Add structured fields to consultations
ALTER TABLE "consultations"."consultations" ADD COLUMN IF NOT EXISTS "diagnosis" TEXT;
ALTER TABLE "consultations"."consultations" ADD COLUMN IF NOT EXISTS "icd_codes" TEXT[] DEFAULT '{}';
ALTER TABLE "consultations"."consultations" ADD COLUMN IF NOT EXISTS "vitals" JSONB;
ALTER TABLE "consultations"."consultations" ADD COLUMN IF NOT EXISTS "soap_notes" JSONB;

-- Add medications and notes to prescriptions (previously FHIR-only)
ALTER TABLE "prescriptions"."prescriptions" ADD COLUMN IF NOT EXISTS "medications" JSONB;
ALTER TABLE "prescriptions"."prescriptions" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "prescriptions"."prescriptions" ADD COLUMN IF NOT EXISTS "verification_code" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "prescriptions_verification_code_key" ON "prescriptions"."prescriptions"("verification_code");

-- CreateEnum: FollowupStatus
DO $$ BEGIN
  CREATE TYPE "consultations"."FollowupStatus" AS ENUM ('pending', 'sent', 'acknowledged', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: followups
CREATE TABLE IF NOT EXISTS "consultations"."followups" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "consultation_id" TEXT,
    "doctor_id" TEXT NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "status" "consultations"."FollowupStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "followups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "consultations"."followups" ADD CONSTRAINT "followups_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultations"."followups" ADD CONSTRAINT "followups_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"."consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultations"."followups" ADD CONSTRAINT "followups_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "clinic"."doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
