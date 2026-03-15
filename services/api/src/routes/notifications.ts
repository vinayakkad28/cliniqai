import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

// In-memory store for notifications (replace with persistent storage in production)
const notificationLog: Array<{
  id: string;
  patientId: string;
  channel: string;
  message: string;
  templateId?: string;
  sentAt: string;
  status: string;
}> = [];

const SendNotificationSchema = z.object({
  patientId: z.string().uuid(),
  channel: z.enum(["sms", "whatsapp", "email"]),
  message: z.string().min(1).max(2000),
  templateId: z.string().optional(),
});

// POST /api/notifications/send — Send a notification
notificationsRouter.post(
  "/send",
  asyncHandler(async (req, res) => {
    const result = SendNotificationSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error.flatten() });
      return;
    }

    const { patientId, channel, message, templateId } = result.data;

    // Verify the patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    // TODO: Replace with Bull queue integration:
    // import { notificationQueue } from "../queues/notification.js";
    // await notificationQueue.add("send-notification", {
    //   patientId, channel, message, templateId,
    //   doctorId: req.user!.doctor_id,
    // });
    // The Bull worker would handle actual delivery via SMS/WhatsApp/email providers.

    const notification = {
      id: crypto.randomUUID(),
      patientId,
      channel,
      message,
      templateId,
      sentAt: new Date().toISOString(),
      status: "sent",
    };

    notificationLog.push(notification);

    console.log(
      `[notifications] ${channel.toUpperCase()} to patient ${patientId}: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"`,
    );

    res.status(200).json({
      success: true,
      notification: {
        id: notification.id,
        channel: notification.channel,
        status: notification.status,
        sentAt: notification.sentAt,
      },
    });
  }),
);
