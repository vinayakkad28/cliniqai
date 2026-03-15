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

describe("POST /api/billing/invoices", () => {
  it("creates an invoice with GST", async () => {
    prisma["consultation"]!["findUnique"]!.mockResolvedValue({
      id: "cons-1",
      doctorId: "test-doctor-id",
      patientId: "patient-1",
    });
    prisma["invoice"]!["findFirst"]!.mockResolvedValue(null); // no existing invoice
    prisma["invoice"]!["create"]!.mockResolvedValue({
      id: "inv-1",
      consultationId: "cons-1",
      amount: 500,
      gstAmount: 90,
      total: 590,
      status: "pending",
    });

    const res = await supertest(app)
      .post("/api/billing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        consultationId: "cons-1",
        amount: 500,
        gstPercent: 18,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("inv-1");
  });

  it("returns 409 if invoice already exists", async () => {
    prisma["consultation"]!["findUnique"]!.mockResolvedValue({
      id: "cons-1",
      doctorId: "test-doctor-id",
      patientId: "patient-1",
    });
    prisma["invoice"]!["findFirst"]!.mockResolvedValue({ id: "existing-inv" });

    const res = await supertest(app)
      .post("/api/billing/invoices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        consultationId: "cons-1",
        amount: 500,
      });

    expect(res.status).toBe(409);
  });
});

describe("GET /api/billing/invoices", () => {
  it("returns paginated invoices", async () => {
    prisma["invoice"]!["count"]!.mockResolvedValue(1);
    prisma["invoice"]!["findMany"]!.mockResolvedValue([
      {
        id: "inv-1",
        amount: 500,
        gstAmount: 0,
        total: 500,
        status: "pending",
        createdAt: new Date(),
        patient: { id: "patient-1", phone: "+919876543210" },
      },
    ]);

    const res = await supertest(app)
      .get("/api/billing/invoices")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe("GET /api/billing/reports/revenue", () => {
  it("returns revenue stats", async () => {
    prisma["invoice"]!["aggregate"]!.mockResolvedValue({
      _sum: { total: 5000, amount: 4500, gstAmount: 500 },
      _count: { id: 10 },
    });

    const res = await supertest(app)
      .get("/api/billing/reports/revenue")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalRevenue).toBe(5000);
    expect(res.body.invoiceCount).toBe(10);
  });
});
