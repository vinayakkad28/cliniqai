import { whatsappPrescriptionQueue } from "../queues/index.js";

export interface WhatsAppJobData {
  phone: string;
  templateName: string;
  variables: Record<string, string>;
  mediaUrl?: string; // PDF URL for prescription
}

const WHATSAPP_AUTH_KEY = process.env["WHATSAPP_AUTH_KEY"] ?? "";
const MSG91_WHATSAPP_URL = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

interface Msg91WhatsAppPayload {
  integrated_number: string;
  content_type: "template";
  payload: {
    messaging_product: "whatsapp";
    type: "template";
    template: {
      name: string;
      language: { code: string; policy: string };
      namespace: string;
      to_and_components: Array<{
        to: string[];
        components: Record<string, unknown>;
      }>;
    };
  };
}

function buildTemplatePayload(data: WhatsAppJobData): Msg91WhatsAppPayload {
  const phone = data.phone.replace(/^\+?91/, "91");

  const bodyParams = Object.values(data.variables).map((value, index) => ({
    type: "text",
    text: value,
    parameter_index: index.toString(),
  }));

  const components: Record<string, unknown> = {
    body: bodyParams,
  };

  if (data.mediaUrl) {
    components["header"] = [
      {
        type: "document",
        document: { link: data.mediaUrl, filename: "prescription.pdf" },
      },
    ];
  }

  return {
    integrated_number: process.env["WHATSAPP_INTEGRATED_NUMBER"] ?? "",
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: data.templateName,
        language: { code: "en", policy: "deterministic" },
        namespace: process.env["WHATSAPP_NAMESPACE"] ?? "",
        to_and_components: [
          {
            to: [phone],
            components,
          },
        ],
      },
    },
  };
}

whatsappPrescriptionQueue.process(async (job) => {
  const data = job.data as WhatsAppJobData;
  console.log(`[whatsapp] Sending ${data.templateName} to ${data.phone}`);

  if (!WHATSAPP_AUTH_KEY) {
    console.warn("[whatsapp] WHATSAPP_AUTH_KEY not set — skipping in dev mode");
    return { status: "skipped", reason: "no_auth_key" };
  }

  const payload = buildTemplatePayload(data);

  const res = await fetch(MSG91_WHATSAPP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: WHATSAPP_AUTH_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MSG91 WhatsApp API error ${res.status}: ${text}`);
  }

  const result = await res.json();
  console.log(`[whatsapp] Sent to ${data.phone}`, result);
  return result;
});
