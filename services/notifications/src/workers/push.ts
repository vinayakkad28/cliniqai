import { pushAlertQueue } from "../queues/index.js";

export interface PushJobData {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

pushAlertQueue.process(async (job) => {
  const { fcmToken, title, body, data } = job.data as PushJobData;
  // TODO: POST to Firebase Cloud Messaging API
  console.log(`[push.alert] Sending push to ${fcmToken.slice(0, 8)}...`, { title, body, data });
});
