/**
 * MSG91 SMS + WhatsApp client.
 * Docs: https://docs.msg91.com/
 */

const BASE_URL = "https://control.msg91.com/api/v5";

interface SendOtpParams {
  phone: string;
  otp: string;
  templateId: string;
}

interface SendSmsParams {
  phone: string;
  message: string;
  senderId?: string;
}

async function msg91Post(path: string, body: unknown): Promise<unknown> {
  const apiKey = process.env["MSG91_API_KEY"];
  if (!apiKey) {
    console.warn("[msg91] MSG91_API_KEY not configured — skipping SMS");
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MSG91 error ${res.status}: ${text}`);
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendOtpSms({ phone, otp, templateId }: SendOtpParams): Promise<string | void> {
  if (process.env["NODE_ENV"] === "development") {
    console.log(`[msg91] DEV — OTP for ${phone}: ${otp}`);
    return otp; // returned so routes can surface it in dev responses
  }
  if (!process.env["MSG91_API_KEY"]) {
    console.warn(`[msg91] No API key — OTP for ${phone}: ${otp}`);
    return otp;
  }
  await msg91Post("/otp", {
    template_id: templateId,
    mobile: phone,
    otp,
  });
}

export async function sendSms({ phone, message, senderId }: SendSmsParams): Promise<void> {
  if (process.env["NODE_ENV"] === "development" || !process.env["MSG91_API_KEY"]) {
    console.warn(`[msg91] SMS to ${phone}: ${message}`);
    return;
  }
  await msg91Post("/flow/", {
    sender: senderId ?? process.env["MSG91_SENDER_ID"] ?? "CLNQAI",
    short_url: "0",
    mobiles: phone,
    message,
  });
}
