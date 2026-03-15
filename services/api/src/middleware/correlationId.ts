import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      log: typeof logger;
    }
  }
}

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers["x-request-id"] as string) ?? randomUUID();
  req.correlationId = id;
  req.log = logger.child({ correlationId: id });
  res.setHeader("X-Request-ID", id);
  next();
}
