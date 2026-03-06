import { Router } from "express";
import { authenticate } from "../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

// POST /api/notifications/send — Enqueue a notification job
notificationsRouter.post("/send", async (req, res) => {
  // TODO: push job to Bull queue via Redis
  res.status(501).json({ message: "Not implemented" });
});
