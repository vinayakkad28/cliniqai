import Bull = require("bull");

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

const defaultJobOptions: Bull.JobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

// High-priority OTP SMS (must arrive within seconds)
export const smsOtpQueue = new Bull("sms.otp", REDIS_URL, {
  defaultJobOptions: { ...defaultJobOptions, priority: 1 },
});

// Appointment reminder SMS
export const smsReminderQueue = new Bull("sms.reminder", REDIS_URL, {
  defaultJobOptions,
});

// Prescription delivery via WhatsApp
export const whatsappPrescriptionQueue = new Bull("whatsapp.prescription", REDIS_URL, {
  defaultJobOptions,
});

// Push notifications
export const pushAlertQueue = new Bull("push.alert", REDIS_URL, {
  defaultJobOptions,
});

// Billing email receipts
export const emailReceiptQueue = new Bull("email.receipt", REDIS_URL, {
  defaultJobOptions,
});
