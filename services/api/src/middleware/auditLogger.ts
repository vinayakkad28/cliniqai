import type { Request, Response, NextFunction } from "express";
import { createLogger } from "../lib/logger.js";

const audit = createLogger("audit");

/**
 * Logs every API request with doctor_id, action, and IP.
 * PHI (patient names, diagnoses) is intentionally excluded.
 */
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    audit.info({
      correlationId: req.correlationId,
      doctorId: req.user?.sub ?? null,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ip: req.ip,
    }, "api_request");
  });
  next();
}
