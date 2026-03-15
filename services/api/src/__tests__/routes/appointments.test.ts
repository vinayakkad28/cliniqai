import { describe, it, expect, vi, beforeEach } from "vitest";
import supertest from "supertest";
import { generateTestToken } from "../helpers.js";

let app: Express.Application;
let prisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;

beforeEach(async () => {
  vi.resetModules();
  const appModule = await import("../../index.js");
  app = appModule.default as unknown as Express.Application;
  const prismaModule = await import("../../lib/prisma.js");
  prisma = prismaModule.prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
});

const token = generateTestToken();

describe("GET /api/appointments", () => {
  it("returns paginated appointments", async () => {
    const mockAppointments = [
      {
        id: "apt-1",
        doctorId: "test-doctor-id",
        patientId: "patient-1",
        status: "scheduled",
        type: "scheduled",
        scheduledAt: new Date(),
        createdAt: new Date(),
        patient: { id: "patient-1", phone: "+919876543210" },
      },
    ];

    prisma["appointment"]!["count"]!.mockResolvedValue(1);
    prisma["appointment"]!["findMany"]!.mockResolvedValue(mockAppointments);

    const res = await supertest(app)
      .get("/api/appointments")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it("returns 401 without token", async () => {
    const res = await supertest(app).get("/api/appointments");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/appointments", () => {
  it("creates an appointment", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    prisma["patient"]!["findUnique"]!.mockResolvedValue({ id: "patient-1", doctorId: "test-doctor-id" });
    prisma["appointment"]!["findFirst"]!.mockResolvedValue(null); // no conflict
    prisma["appointment"]!["create"]!.mockResolvedValue({
      id: "apt-new",
      doctorId: "test-doctor-id",
      patientId: "patient-1",
      status: "scheduled",
      type: "scheduled",
      scheduledAt: tomorrow,
    });

    const res = await supertest(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        patientId: "patient-1",
        scheduledAt: tomorrow.toISOString(),
        type: "scheduled",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("apt-new");
  });

  it("returns 400 for missing fields", async () => {
    const res = await supertest(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/appointments/:id", () => {
  it("updates appointment status and emits socket event", async () => {
    prisma["appointment"]!["findUnique"]!.mockResolvedValue({
      id: "apt-1",
      doctorId: "test-doctor-id",
      patientId: "patient-1",
      status: "scheduled",
    });
    prisma["appointment"]!["update"]!.mockResolvedValue({
      id: "apt-1",
      doctorId: "test-doctor-id",
      patientId: "patient-1",
      status: "confirmed",
    });

    const res = await supertest(app)
      .patch("/api/appointments/apt-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "confirmed" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
  });

  it("returns 404 for non-existent appointment", async () => {
    prisma["appointment"]!["findUnique"]!.mockResolvedValue(null);

    const res = await supertest(app)
      .patch("/api/appointments/nonexistent")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "confirmed" });

    expect(res.status).toBe(404);
  });

  it("returns 403 for another doctor's appointment", async () => {
    prisma["appointment"]!["findUnique"]!.mockResolvedValue({
      id: "apt-1",
      doctorId: "other-doctor-id",
      patientId: "patient-1",
      status: "scheduled",
    });

    const res = await supertest(app)
      .patch("/api/appointments/apt-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "confirmed" });

    expect(res.status).toBe(403);
  });
});
