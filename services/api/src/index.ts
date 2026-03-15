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

// Prevent unhandled rejections from crashing the process in dev
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection");
});

const app = express();
const PORT = process.env["PORT"] ?? 3001;
const startTime = Date.now();

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

// Rate limiting
app.use("/api", apiRateLimiter);

// Audit logging (every authenticated request)
app.use("/api", auditLogger);

// Health check (unauthenticated) — pings DB and Redis
app.get("/health", async (_req, res) => {
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
