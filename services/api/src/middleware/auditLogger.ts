import type { Request, Response, NextFunction } from "express";

/**
 * Logs every API request with doctor_id, action, and IP.
 * PHI (patient names, diagnoses) is intentionally excluded.
 */
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    const entry = {
      timestamp: new Date().toISOString(),
      doctor_id: req.user?.sub ?? null,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ip: req.ip,
    };
    // In production, write to Cloud Logging. For now, stdout.
    console.log("[audit]", JSON.stringify(entry));
  });
  next();
}
