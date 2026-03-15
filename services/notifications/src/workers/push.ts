import { pushAlertQueue } from "../queues/index.js";

export interface PushJobData {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  channelId?: string; // Android notification channel
}

const FCM_SERVER_KEY = process.env["FCM_SERVER_KEY"] ?? "";
const FCM_URL = "https://fcm.googleapis.com/fcm/send";

interface FcmPayload {
  to: string;
  notification: {
    title: string;
    body: string;
    image?: string;
    sound: string;
    android_channel_id?: string;
  };
  data?: Record<string, string>;
  priority: string;
}

interface FcmResponse {
  multicast_id: number;
  success: number;
  failure: number;
  results: Array<{ message_id?: string; error?: string }>;
}

async function sendFcmPush(payload: FcmPayload): Promise<FcmResponse> {
  const res = await fetch(FCM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${FCM_SERVER_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FCM API error ${res.status}: ${text}`);
  }

  const result = (await res.json()) as FcmResponse;

  // Check for token-level failures
  if (result.failure > 0) {
    const errors = result.results
      .filter((r) => r.error)
      .map((r) => r.error);
    console.warn(`[push] Partial failure:`, errors);

    // InvalidRegistration / NotRegistered means token is stale
    const invalidToken = result.results.some(
      (r) => r.error === "InvalidRegistration" || r.error === "NotRegistered",
    );
    if (invalidToken) {
      console.warn(`[push] Token ${payload.to.slice(0, 12)}... is invalid — should be removed`);
      // The caller (API service) should handle token cleanup via a returned flag
    }
  }

  return result;
}

pushAlertQueue.process(async (job) => {
  const { fcmToken, title, body, data, imageUrl, channelId } = job.data as PushJobData;
  console.log(`[push] Sending to ${fcmToken.slice(0, 12)}...`, { title });

  if (!FCM_SERVER_KEY) {
    console.warn("[push] FCM_SERVER_KEY not set — skipping in dev mode");
    return { status: "skipped", reason: "no_server_key" };
  }

  const payload: FcmPayload = {
    to: fcmToken,
    notification: {
      title,
      body,
      sound: "default",
      ...(imageUrl && { image: imageUrl }),
      ...(channelId && { android_channel_id: channelId }),
    },
    ...(data && { data }),
    priority: "high",
  };

  const result = await sendFcmPush(payload);
  console.log(`[push] Sent — success: ${result.success}, failure: ${result.failure}`);
  return result;
});
