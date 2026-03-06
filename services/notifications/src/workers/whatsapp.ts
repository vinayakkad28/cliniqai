import { whatsappPrescriptionQueue } from "../queues/index.js";

export interface WhatsAppJobData {
  phone: string;
  templateName: string;
  variables: Record<string, string>;
  mediaUrl?: string; // PDF URL for prescription
}

whatsappPrescriptionQueue.process(async (job) => {
  const { phone, templateName, variables, mediaUrl } = job.data as WhatsAppJobData;
  // TODO: POST to MSG91 WhatsApp API
  console.log(`[whatsapp.prescription] Sending to ${phone} template=${templateName}`, {
    variables,
    mediaUrl,
  });
});
