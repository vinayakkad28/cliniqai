import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import { generateTestToken } from "../helpers.js";

// Must import app after mocks are set up (setup.ts runs first)
let app: Express.Application;
let prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;

beforeEach(async () => {
  vi.resetModules();
  const appModule = await import("../../index.js");
  app = appModule.default as unknown as Express.Application;
  const prismaModule = await import("../../lib/prisma.js");
  prisma = prismaModule.prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
});

describe("GET /health", () => {
  it("returns ok status", async () => {
    const res = await supertest(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("cliniqai-api");
    expect(res.body.checks.db).toBe("ok");
    expect(res.body).toHaveProperty("uptime");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without auth token", async () => {
    const res = await supertest(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns user profile with valid token", async () => {
    const token = generateTestToken();
    const mockUser = {
      id: "test-user-id",
      phone: "+919876543210",
      email: null,
      role: "doctor",
      createdAt: new Date(),
      doctor: { id: "test-doctor-id", name: "Dr. Test", specialties: ["general"], licenseNumber: "MH-12345" },
    };

    prisma["user"]!["findUnique"]!.mockResolvedValue(mockUser);

    const res = await supertest(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", "test-user-id");
  });
});

describe("POST /api/auth/send-otp", () => {
  it("returns 400 for invalid phone", async () => {
    const res = await supertest(app)
      .post("/api/auth/send-otp")
      .send({ phone: "invalid" });

    expect(res.status).toBe(400);
  });
});

describe("404 handler", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await supertest(app).get("/api/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Not found");
  });
});
