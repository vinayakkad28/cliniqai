import { emailReceiptQueue } from "../queues/index.js";

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64-encoded
    contentType: string;
  }>;
}

const RESEND_API_KEY = process.env["RESEND_API_KEY"] ?? "";
const EMAIL_FROM = process.env["EMAIL_FROM"] ?? "CliniqAI <noreply@cliniqai.com>";
const RESEND_URL = "https://api.resend.com/emails";

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  reply_to?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    type: string;
  }>;
}

interface ResendResponse {
  id: string;
}

async function sendResendEmail(payload: ResendPayload): Promise<ResendResponse> {
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<ResendResponse>;
}

emailReceiptQueue.process(async (job) => {
  const { to, subject, html, replyTo, attachments } = job.data as EmailJobData;
  console.log(`[email] Sending to ${to} — "${subject}"`);

  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping in dev mode");
    return { status: "skipped", reason: "no_api_key" };
  }

  const payload: ResendPayload = {
    from: EMAIL_FROM,
    to: [to],
    subject,
    html,
    ...(replyTo && { reply_to: replyTo }),
    ...(attachments && {
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        type: a.contentType,
      })),
    }),
  };

  const result = await sendResendEmail(payload);
  console.log(`[email] Sent to ${to} — id: ${result.id}`);
  return result;
});
