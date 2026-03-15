import { smsOtpQueue, smsReminderQueue } from "../queues/index.js";

export interface SmsOtpJobData {
  phone: string;
  templateId: string;
  variables: Record<string, string>;
}

export interface SmsReminderJobData {
  appointmentId: string;
  patientPhone: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  scheduledAt: string | Date;
}

const MSG91_API_KEY = process.env["MSG91_API_KEY"] ?? "";
const MSG91_SENDER_ID = process.env["MSG91_SENDER_ID"] ?? "CLNQAI";
const MSG91_BASE_URL = "https://control.msg91.com/api/v5";

async function sendMsg91Sms(payload: {
  sender: string;
  route: string;
  country: string;
  sms: Array<{ message: string; to: string[] }>;
}): Promise<{ type: string; message: string }> {
  const res = await fetch(`${MSG91_BASE_URL}/flow/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: MSG91_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MSG91 SMS API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<{ type: string; message: string }>;
}

async function sendOtpViaMSG91(phone: string, templateId: string, variables: Record<string, string>) {
  const res = await fetch(`${MSG91_BASE_URL}/flow/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: MSG91_API_KEY,
    },
    body: JSON.stringify({
      flow_id: templateId,
      sender: MSG91_SENDER_ID,
      mobiles: `91${phone.replace(/^\+?91/, "")}`,
      ...variables,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MSG91 OTP API error ${res.status}: ${text}`);
  }

  return res.json();
}

// OTP SMS — high priority, must arrive within seconds
smsOtpQueue.process(async (job) => {
  const { phone, templateId, variables } = job.data as SmsOtpJobData;
  console.log(`[sms.otp] Sending OTP to ${phone} via template ${templateId}`);

  if (!MSG91_API_KEY) {
    console.warn("[sms.otp] MSG91_API_KEY not set — skipping in dev mode");
    return { status: "skipped", reason: "no_api_key" };
  }

  const result = await sendOtpViaMSG91(phone, templateId, variables);
  console.log(`[sms.otp] Sent to ${phone}`, result);
  return result;
});

// Appointment reminder SMS
smsReminderQueue.process(async (job) => {
  const data = job.data as SmsReminderJobData;
  const apptTime = new Date(data.scheduledAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  console.log(`[sms.reminder] Sending reminder to ${data.patientPhone} for ${apptTime}`);

  if (!MSG91_API_KEY) {
    console.warn("[sms.reminder] MSG91_API_KEY not set — skipping in dev mode");
    return { status: "skipped", reason: "no_api_key" };
  }

  const message = `Hi ${data.patientName}, reminder: Your appointment with Dr. ${data.doctorName} at ${data.clinicName} is on ${apptTime}. - CliniqAI`;

  const result = await sendMsg91Sms({
    sender: MSG91_SENDER_ID,
    route: "4",
    country: "91",
    sms: [{ message, to: [data.patientPhone.replace(/^\+?91/, "")] }],
  });

  console.log(`[sms.reminder] Sent to ${data.patientPhone}`, result);
  return result;
});
