import pino from "pino";

const LOG_LEVEL = process.env["LOG_LEVEL"] ?? (process.env["NODE_ENV"] === "production" ? "info" : "debug");

export const logger = pino({
  level: LOG_LEVEL,
  redact: {
    paths: ["req.headers.authorization", "phone", "password", "token", "otp", "*.phone", "*.password", "*.token", "*.otp"],
    censor: "[REDACTED]",
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  ...(process.env["NODE_ENV"] !== "production"
    ? {
        transport: {
          target: "pino/file",
          options: { destination: 1 },
        },
      }
    : {}),
});

export function createLogger(name: string) {
  return logger.child({ module: name });
}
