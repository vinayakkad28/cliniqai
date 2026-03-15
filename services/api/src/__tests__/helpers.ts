import jwt from "jsonwebtoken";
import supertest from "supertest";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret";

export interface TestTokenPayload {
  sub: string;
  doctor_id: string;
  role: string;
  scopes: string[];
}

const defaultPayload: TestTokenPayload = {
  sub: "test-user-id",
  doctor_id: "test-doctor-id",
  role: "doctor",
  scopes: [
    "patients:read", "patients:write",
    "appointments:read", "appointments:write",
    "consultations:read", "consultations:write",
    "prescriptions:read", "prescriptions:write",
    "billing:read", "billing:write",
    "pharmacy:read", "pharmacy:write",
    "labs:read", "labs:write",
    "documents:read", "documents:write",
    "insights:read", "insights:write",
  ],
};

export function generateTestToken(overrides?: Partial<TestTokenPayload>): string {
  const payload = { ...defaultPayload, ...overrides };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

export function createAuthAgent() {
  // Lazy import to avoid circular dependency with mocks
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const app = require("../index.js").default;
  const token = generateTestToken();
  const agent = supertest(app);
  return {
    app,
    agent,
    token,
    get: (url: string) => agent.get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string) => agent.post(url).set("Authorization", `Bearer ${token}`).set("Content-Type", "application/json"),
    patch: (url: string) => agent.patch(url).set("Authorization", `Bearer ${token}`).set("Content-Type", "application/json"),
    delete: (url: string) => agent.delete(url).set("Authorization", `Bearer ${token}`),
  };
}
