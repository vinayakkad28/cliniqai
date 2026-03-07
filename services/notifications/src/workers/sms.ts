import { smsOtpQueue, smsReminderQueue } from "../queues/index.js";

export interface SmsOtpJobData {
  phone: string;
  templateId: string;
  variables: Record<string, string>;
}

export interface SmsReminderJobData {
  appointmentId: string;
  patientPhone: string;
  scheduledAt: string | Date;
}

smsOtpQueue.process(async (job) => {
  const { phone, templateId, variables } = job.data as SmsOtpJobData;
  // TODO: POST to MSG91 SMS API with credentials from env
  console.log(`[sms.otp] Sending OTP to ${phone} via template ${templateId}`, variables);
});

smsReminderQueue.process(async (job) => {
  const data = job.data as SmsReminderJobData;
  const apptTime = new Date(data.scheduledAt).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  // TODO: POST to MSG91/Twilio SMS API with credentials from env
  console.log(`[sms.reminder] Appointment reminder for ${data.patientPhone}: Your appointment is scheduled for ${apptTime}. Appt ID: ${data.appointmentId}`);
});
