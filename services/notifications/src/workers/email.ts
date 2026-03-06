import { emailReceiptQueue } from "../queues/index.js";

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

emailReceiptQueue.process(async (job) => {
  const { to, subject, html } = job.data as EmailJobData;
  // TODO: POST to Resend API
  console.log(`[email.receipt] Sending email to ${to} subject="${subject}" (${html.length} chars)`);
});
