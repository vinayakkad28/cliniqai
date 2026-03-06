-- CreateSchemas
CREATE SCHEMA IF NOT EXISTS "auth";
CREATE SCHEMA IF NOT EXISTS "clinic";
CREATE SCHEMA IF NOT EXISTS "patients";
CREATE SCHEMA IF NOT EXISTS "appointments";
CREATE SCHEMA IF NOT EXISTS "consultations";
CREATE SCHEMA IF NOT EXISTS "prescriptions";
CREATE SCHEMA IF NOT EXISTS "billing";
CREATE SCHEMA IF NOT EXISTS "pharmacy";
CREATE SCHEMA IF NOT EXISTS "labs";

-- CreateEnum
CREATE TYPE "auth"."UserRole" AS ENUM ('doctor', 'nurse', 'admin', 'receptionist', 'patient');

-- CreateEnum
CREATE TYPE "clinic"."DayOfWeek" AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- CreateEnum
CREATE TYPE "appointments"."AppointmentStatus" AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "appointments"."AppointmentType" AS ENUM ('scheduled', 'walk_in', 'follow_up', 'teleconsult');

-- CreateEnum
CREATE TYPE "consultations"."ConsultationStatus" AS ENUM ('in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "prescriptions"."PrescriptionStatus" AS ENUM ('draft', 'sent', 'dispensed', 'cancelled');

-- CreateEnum
CREATE TYPE "billing"."InvoiceStatus" AS ENUM ('pending', 'paid', 'partially_paid', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "labs"."LabOrderStatus" AS ENUM ('pending', 'collected', 'processing', 'completed', 'cancelled');

-- CreateTable: auth.users
CREATE TABLE "auth"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "auth"."UserRole" NOT NULL DEFAULT 'doctor',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "auth"."users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "auth"."users"("phone");

-- CreateTable: auth.refresh_tokens
CREATE TABLE "auth"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable: auth.otp_codes
CREATE TABLE "auth"."otp_codes" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: clinic.doctors
CREATE TABLE "clinic"."doctors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialties" TEXT[],
    "license_number" TEXT NOT NULL,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doctors_user_id_key" ON "clinic"."doctors"("user_id");

-- CreateTable: clinic.clinics
CREATE TABLE "clinic"."clinics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "gst_number" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable: clinic.clinic_doctors
CREATE TABLE "clinic"."clinic_doctors" (
    "clinic_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'doctor',

    CONSTRAINT "clinic_doctors_pkey" PRIMARY KEY ("clinic_id","doctor_id")
);

-- CreateTable: clinic.working_hours
CREATE TABLE "clinic"."working_hours" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "day_of_week" "clinic"."DayOfWeek" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "slot_duration_mins" INTEGER NOT NULL DEFAULT 15,

    CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable: patients.patients
CREATE TABLE "patients"."patients" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "fhir_patient_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_by_doctor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"."patients"("user_id");
CREATE UNIQUE INDEX "patients_fhir_patient_id_key" ON "patients"."patients"("fhir_patient_id");
CREATE UNIQUE INDEX "patients_phone_key" ON "patients"."patients"("phone");

-- CreateTable: patients.patient_tags
CREATE TABLE "patients"."patient_tags" (
    "patient_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "patient_tags_pkey" PRIMARY KEY ("patient_id","tag")
);

-- CreateTable: appointments.appointments
CREATE TABLE "appointments"."appointments" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "appointments"."AppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "type" "appointments"."AppointmentType" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: appointments.appointment_queue
CREATE TABLE "appointments"."appointment_queue" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "token_number" INTEGER NOT NULL,
    "arrived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'waiting',

    CONSTRAINT "appointment_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable: consultations.consultations
CREATE TABLE "consultations"."consultations" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "fhir_encounter_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "chief_complaint" TEXT,
    "notes" TEXT,
    "status" "consultations"."ConsultationStatus" NOT NULL DEFAULT 'in_progress',

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consultations_appointment_id_key" ON "consultations"."consultations"("appointment_id");
CREATE UNIQUE INDEX "consultations_fhir_encounter_id_key" ON "consultations"."consultations"("fhir_encounter_id");

-- CreateTable: prescriptions.prescriptions
CREATE TABLE "prescriptions"."prescriptions" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "fhir_medication_request_id" TEXT,
    "sent_via" TEXT,
    "sent_at" TIMESTAMP(3),
    "pdf_url" TEXT,
    "status" "prescriptions"."PrescriptionStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prescriptions_fhir_medication_request_id_key" ON "prescriptions"."prescriptions"("fhir_medication_request_id");

-- CreateTable: billing.invoices
CREATE TABLE "billing"."invoices" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "gst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "status" "billing"."InvoiceStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "payment_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: billing.payment_methods
CREATE TABLE "billing"."payment_methods" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pharmacy.medicines
CREATE TABLE "pharmacy"."medicines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generic_name" TEXT,
    "manufacturer" TEXT,
    "form" TEXT,
    "strength" TEXT,
    "unit" TEXT,

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pharmacy.inventory
CREATE TABLE "pharmacy"."inventory" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 10,
    "expiry_date" TIMESTAMP(3),
    "batch_number" TEXT,
    "cost_price" DECIMAL(10,2),
    "selling_price" DECIMAL(10,2),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: pharmacy.dispensing
CREATE TABLE "pharmacy"."dispensing" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "quantity_dispensed" INTEGER NOT NULL,
    "dispensed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispensing_pkey" PRIMARY KEY ("id")
);

-- CreateTable: labs.lab_orders
CREATE TABLE "labs"."lab_orders" (
    "id" TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "tests" TEXT[],
    "status" "labs"."LabOrderStatus" NOT NULL DEFAULT 'pending',
    "fhir_service_request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lab_orders_fhir_service_request_id_key" ON "labs"."lab_orders"("fhir_service_request_id");

-- CreateTable: labs.lab_results
CREATE TABLE "labs"."lab_results" (
    "id" TEXT NOT NULL,
    "lab_order_id" TEXT NOT NULL,
    "fhir_diagnostic_report_id" TEXT,
    "result_file_url" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ai_summary" TEXT,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lab_results_fhir_diagnostic_report_id_key" ON "labs"."lab_results"("fhir_diagnostic_report_id");

-- AddForeignKeys: auth
ALTER TABLE "auth"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKeys: clinic
ALTER TABLE "clinic"."doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic"."clinic_doctors" ADD CONSTRAINT "clinic_doctors_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinic"."clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic"."clinic_doctors" ADD CONSTRAINT "clinic_doctors_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "clinic"."doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic"."working_hours" ADD CONSTRAINT "working_hours_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "clinic"."doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKeys: patients
ALTER TABLE "patients"."patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "patients"."patient_tags" ADD CONSTRAINT "patient_tags_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKeys: appointments
ALTER TABLE "appointments"."appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments"."appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "clinic"."doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments"."appointment_queue" ADD CONSTRAINT "appointment_queue_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinic"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments"."appointment_queue" ADD CONSTRAINT "appointment_queue_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKeys: consultations
ALTER TABLE "consultations"."consultations" ADD CONSTRAINT "consultations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"."appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultations"."consultations" ADD CONSTRAINT "consultations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "clinic"."doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultations"."consultations" ADD CONSTRAINT "consultations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKeys: prescriptions
ALTER TABLE "prescriptions"."prescriptions" ADD CONSTRAINT "prescriptions_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"."consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions"."prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions"."prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "clinic"."doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKeys: billing
ALTER TABLE "billing"."invoices" ADD CONSTRAINT "invoices_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"."consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing"."invoices" ADD CONSTRAINT "invoices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing"."invoices" ADD CONSTRAINT "invoices_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "clinic"."doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing"."payment_methods" ADD CONSTRAINT "payment_methods_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKeys: pharmacy
ALTER TABLE "pharmacy"."inventory" ADD CONSTRAINT "inventory_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinic"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pharmacy"."inventory" ADD CONSTRAINT "inventory_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "pharmacy"."medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pharmacy"."dispensing" ADD CONSTRAINT "dispensing_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"."prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pharmacy"."dispensing" ADD CONSTRAINT "dispensing_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "pharmacy"."medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKeys: labs
ALTER TABLE "labs"."lab_orders" ADD CONSTRAINT "lab_orders_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"."consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "labs"."lab_orders" ADD CONSTRAINT "lab_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "labs"."lab_results" ADD CONSTRAINT "lab_results_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "labs"."lab_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
