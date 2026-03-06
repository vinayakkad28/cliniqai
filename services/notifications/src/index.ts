import "dotenv/config";

// Start all queue workers
import "./workers/sms.js";
import "./workers/whatsapp.js";
import "./workers/push.js";
import "./workers/email.js";

import express from "express";

const app = express();
const PORT = process.env["PORT"] ?? 3003;

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "cliniqai-notifications" });
});

app.listen(PORT, () => {
  console.log(`[notifications] CliniqAI Notification service running on http://localhost:${PORT}`);
  console.log("[notifications] Workers listening on queues: sms.otp, sms.reminder, whatsapp.prescription, push.alert, email.receipt");
});
