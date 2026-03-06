/**
 * Bull queue publishers for the Core API.
 * These queues share the same Redis instance as the notification service workers.
 */
import Bull from "bull";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const defaultJobOptions: Bull.JobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export const smsOtpQueue = new Bull("sms.otp", REDIS_URL, {
  defaultJobOptions: { ...defaultJobOptions, priority: 1 },
});

export const smsReminderQueue = new Bull("sms.reminder", REDIS_URL, { defaultJobOptions });
export const whatsappPrescriptionQueue = new Bull("whatsapp.prescription", REDIS_URL, { defaultJobOptions });
export const pushAlertQueue = new Bull("push.alert", REDIS_URL, { defaultJobOptions });
export const emailReceiptQueue = new Bull("email.receipt", REDIS_URL, { defaultJobOptions });
export const documentProcessQueue = new Bull("document.process", REDIS_URL, { defaultJobOptions });
export const clinicalAlertQueue = new Bull("clinical.alert", REDIS_URL, { defaultJobOptions });

// ─── Job payload types ────────────────────────────────────────────────────────

export interface SmsOtpJob {
  phone: string;
  otp: string;
}

export interface WhatsappPrescriptionJob {
  prescriptionId: string;
  patientPhone: string;
  doctorName: string;
  medications: Array<{ drug: string; dose: string; frequency: string; duration: string }>;
}

export interface SmsReminderJob {
  patientPhone: string;
  doctorName: string;
  scheduledAt: string;
  clinicName?: string;
}

export interface EmailReceiptJob {
  invoiceId: string;
  patientPhone: string;
  total: number;
  paidAt: string;
}

export interface DocumentProcessJob {
  documentId: string;
}

export interface ClinicalAlertJob {
  patientId: string;
  consultationId?: string;
  triggerType: "new_consultation" | "new_lab_result" | "new_prescription";
}
