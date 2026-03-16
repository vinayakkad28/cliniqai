import "dotenv/config";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { authRouter } from "./routes/auth.js";
import { doctorsRouter } from "./routes/doctors.js";
import { patientsRouter } from "./routes/patients.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { consultationsRouter } from "./routes/consultations.js";
import { prescriptionsRouter } from "./routes/prescriptions.js";
import { billingRouter } from "./routes/billing.js";
import { pharmacyRouter } from "./routes/pharmacy.js";
import { labsRouter } from "./routes/labs.js";
import { notificationsRouter } from "./routes/notifications.js";
import { adminRouter } from "./routes/admin.js";
import { documentsRouter } from "./routes/documents.js";
import { insightsRouter } from "./routes/insights.js";
import { organizationsRouter } from "./routes/organizations.js";
import { abdmRouter, abdmCallbackRouter } from "./routes/abdm.js";
import { clinicRouter } from "./routes/clinic.js";
import { auditLogger } from "./middleware/auditLogger.js";
import { correlationId } from "./middleware/correlationId.js";
import { apiRateLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { initSocketServer } from "./lib/socketServer.js";
import whatsappBotRouter from "./routes/whatsappBot.js";
import ePrescriptionRouter from "./routes/ePrescription.js";
import eventsRouter from "./routes/events.js";
import abdmFullRouter from "./routes/abdmFull.js";
import { followupsRouter } from "./routes/followups.js";
import { analyticsRouter } from "./routes/analytics.js";
import auditLogRouter from "./routes/auditLog.js";
import { publicBookingRouter } from "./routes/publicBooking.js";
import { tracingMiddleware } from "./lib/monitoring.js";
import { healthCheck } from "./lib/monitoring.js";

// Production environment validation
if (process.env.NODE_ENV !== 'development') {
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
  const missing = required.filter(k => !process.env[k] || process.env[k]!.includes('your-') || process.env[k]!.includes('change-me'));
  if (missing.length > 0) {
    console.error(`FATAL: Missing or placeholder environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// Prevent unhandled rejections from crashing the process in dev
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection");
});

const app = express();
const PORT = process.env["PORT"] ?? 3001;
const startTime = Date.now();

// Trust proxy (Railway, Cloud Run, etc.)
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// CORS
const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "http://localhost:3000").split(",");
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Request parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Correlation ID (must come before pino-http so it's available for logging)
app.use(correlationId);

// Structured HTTP request logging (replaces morgan — no PHI logged)
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => (req.url ?? "").startsWith("/health") },
    customProps: (req) => ({ correlationId: (req as express.Request).correlationId }),
  }),
);

// Distributed tracing
app.use(tracingMiddleware);

// Rate limiting
app.use("/api", apiRateLimiter);

// Audit logging (every authenticated request)
app.use("/api", auditLogger);

// Health check (unauthenticated) — enhanced with dependency checks + DB fallback
app.get("/health", async (_req, res) => {
  try {
    const health = await healthCheck();
    res.status(health.status === "unhealthy" ? 503 : 200).json(health);
  } catch {
    // Fallback: basic DB ping
    let dbOk = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }

    const status = dbOk ? "ok" : "degraded";
    res.status(dbOk ? 200 : 503).json({
      status,
      service: "cliniqai-api",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks: { db: dbOk ? "ok" : "error" },
    });
  }
});

// API routes
app.use("/api/auth", authRouter);
app.use("/api/doctors", doctorsRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/consultations", consultationsRouter);
app.use("/api/prescriptions", prescriptionsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/pharmacy", pharmacyRouter);
app.use("/api/labs", labsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/organizations", organizationsRouter);
app.use("/api/clinic", clinicRouter);
app.use("/api/abdm", abdmRouter);
// ABDM gateway callback — unauthenticated, whitelist in prod by IP
app.use("/api/abdm/callback", abdmCallbackRouter);
// New feature routes
app.use("/api/whatsapp", whatsappBotRouter);
app.use("/api/e-prescription", ePrescriptionRouter);
app.use("/api/events", eventsRouter);
app.use("/api/abdm-v2", abdmFullRouter);
app.use("/api/followups", followupsRouter);
app.use("/api/audit-log", auditLogRouter);
app.use("/api/analytics", analyticsRouter);
// Public routes (no auth required)
app.use("/api/public", publicBookingRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  (req.log ?? logger).error({ err }, "unhandled route error");
  res.status(500).json({ error: "Internal server error" });
});

const httpServer = createServer(app);
initSocketServer(httpServer);

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, "CliniqAI API running");
});

export default app;
