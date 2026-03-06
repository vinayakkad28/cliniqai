import { smsOtpQueue, smsReminderQueue } from "../queues/index.js";

export interface SmsJobData {
  phone: string;
  templateId: string;
  variables: Record<string, string>;
}

smsOtpQueue.process(async (job) => {
  const { phone, templateId, variables } = job.data as SmsJobData;
  // TODO: POST to MSG91 SMS API
  console.log(`[sms.otp] Sending OTP to ${phone} via template ${templateId}`, variables);
});

smsReminderQueue.process(async (job) => {
  const { phone, templateId, variables } = job.data as SmsJobData;
  // TODO: POST to MSG91 SMS API
  console.log(`[sms.reminder] Sending reminder to ${phone}`, variables);
});
