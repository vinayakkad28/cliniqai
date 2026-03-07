import jwt from "jsonwebtoken";
import type { AuthPayload } from "../middleware/auth.js";

function getSecret(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export function signAccessToken(payload: Omit<AuthPayload, "iat" | "exp">): string {
  return jwt.sign(payload, getSecret("JWT_SECRET"), {
    expiresIn: (process.env["JWT_EXPIRES_IN"] ?? "7d") as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(sub: string): string {
  return jwt.sign({ sub }, getSecret("JWT_REFRESH_SECRET"), {
    expiresIn: (process.env["JWT_REFRESH_EXPIRES_IN"] ?? "30d") as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, getSecret("JWT_REFRESH_SECRET")) as { sub: string };
}

/** Scope sets per role — mirrors ARCHITECTURE.md §5.3 */
export const ROLE_SCOPES: Record<string, string[]> = {
  doctor: [
    "patients:read", "patients:write",
    "prescriptions:read", "prescriptions:write",
    "appointments:read", "appointments:write",
    "consultations:read", "consultations:write",
    "billing:read", "billing:write", "labs:read", "labs:write",
    "pharmacy:read", "pharmacy:write",
  ],
  nurse: [
    "patients:read", "appointments:read", "appointments:write", "vitals:write",
  ],
  admin: [
    "billing:read", "billing:write",
    "pharmacy:read", "pharmacy:write",
    "reports:read",
    "appointments:read",
    "patients:read",
  ],
  receptionist: [
    "appointments:read", "appointments:write", "patients:read",
  ],
  patient: ["own_records:read", "appointments:book"],
};
