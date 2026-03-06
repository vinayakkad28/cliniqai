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
  if (!apiKey) throw new Error("MSG91_API_KEY not configured");

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MSG91 error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function sendOtpSms({ phone, otp, templateId }: SendOtpParams): Promise<string | void> {
  if (process.env["NODE_ENV"] === "development") {
    console.log(`[msg91] DEV — OTP for ${phone}: ${otp}`);
    return otp; // returned so routes can surface it in dev responses
  }
  await msg91Post("/otp", {
    template_id: templateId,
    mobile: phone,
    otp,
  });
}

export async function sendSms({ phone, message, senderId }: SendSmsParams): Promise<void> {
  if (process.env["NODE_ENV"] === "development") {
    console.log(`[msg91] DEV — SMS to ${phone}: ${message}`);
    return;
  }
  await msg91Post("/flow/", {
    sender: senderId ?? process.env["MSG91_SENDER_ID"] ?? "CLNQAI",
    short_url: "0",
    mobiles: phone,
    message,
  });
}
