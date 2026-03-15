import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { emailReceiptQueue } from "../lib/queues.js";
import { generateInvoicePdf } from "../lib/pdfGenerator.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const billingRouter = Router();

billingRouter.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const CreateInvoiceSchema = z.object({
  consultationId: z.string().uuid(),
  amount: z.number().positive(),
  gstPercent: z.number().min(0).max(100).default(0),
  paymentMethod: z.string().optional(),
});

const MarkPaidSchema = z.object({
  paymentMethod: z.string().min(1),
  transactionId: z.string().optional(),
  amount: z.number().positive().optional(), // for partial payments
});

const ListInvoicesSchema = z.object({
  status: z.enum(["pending", "paid", "partially_paid", "cancelled", "refunded"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  patientId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── POST /api/billing/invoices ───────────────────────────────────────────────

billingRouter.post("/invoices", requireScope("billing:write"), asyncHandler(async (req, res) => {
  const result = CreateInvoiceSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { consultationId, amount, gstPercent, paymentMethod } = result.data;

  const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
  if (!consultation) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }

  const existing = await prisma.invoice.findFirst({ where: { consultationId } });
  if (existing) {
    res.status(409).json({ error: "Invoice already exists for this consultation", invoiceId: existing.id });
    return;
  }

  const gstAmount = (amount * gstPercent) / 100;
  const total = amount + gstAmount;

  const invoice = await prisma.invoice.create({
    data: {
      consultationId,
      patientId: consultation.patientId,
      doctorId: consultation.doctorId,
      amount,
      gstAmount,
      total,
      status: "pending",
      paymentMethod: paymentMethod ?? null,
    },
  });

  res.status(201).json(invoice);
}));

// ─── GET /api/billing/invoices ────────────────────────────────────────────────

billingRouter.get("/invoices", requireScope("billing:read"), asyncHandler(async (req, res) => {
  const query = ListInvoicesSchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }

  const { status, from, to, patientId, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where = {
    doctorId: req.user!.doctor_id!,
    ...(status ? { status } : {}),
    ...(patientId ? { patientId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000+05:30`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999+05:30`) } : {}),
          },
        }
      : {}),
  };

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { patient: { select: { id: true, name: true, phone: true } } },
    }),
  ]);

  res.json({ data: invoices, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
}));

// ─── GET /api/billing/invoices/export — CSV download ─────────────────────────

billingRouter.get("/invoices/export", requireScope("billing:read"), asyncHandler(async (req, res) => {
  const { from, to, status } = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(["pending", "paid", "partially_paid", "cancelled", "refunded"]).optional(),
  }).parse(req.query);

  const where = {
    doctorId: req.user!.doctor_id!,
    ...(status ? { status } : {}),
    ...(from || to ? { createdAt: {
      ...(from ? { gte: new Date(`${from}T00:00:00.000+05:30`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999+05:30`) } : {}),
    } } : {}),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { patient: { select: { name: true, phone: true } } },
  });

  const lines = ["Date,Patient,Fees,GST,Total,Status,Payment Method,Paid At"];
  for (const inv of invoices) {
    lines.push([
      inv.createdAt.toISOString().slice(0, 10),
      inv.patient.phone,
      Number(inv.amount).toFixed(2),
      Number(inv.gstAmount).toFixed(2),
      Number(inv.total).toFixed(2),
      inv.status,
      inv.paymentMethod ?? "",
      inv.paidAt ? inv.paidAt.toISOString().slice(0, 10) : "",
    ].join(","));
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="invoices-${Date.now()}.csv"`);
  res.send(lines.join("\n"));
}));

// ─── GET /api/billing/invoices/:id ───────────────────────────────────────────

billingRouter.get("/invoices/:id", requireScope("billing:read"), asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params["id"] },
    include: {
      patient: { select: { id: true, name: true, phone: true } },
      paymentMethods: true,
    },
  });

  if (!invoice || invoice.doctorId !== req.user!.doctor_id) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json(invoice);
}));

// ─── PATCH /api/billing/invoices/:id — Mark payment ─────────────────────────

billingRouter.patch("/invoices/:id", requireScope("billing:write"), asyncHandler(async (req, res) => {
  const result = MarkPaidSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params["id"] },
    include: { patient: { select: { name: true, phone: true } } },
  });
  if (!invoice || invoice.doctorId !== req.user!.doctor_id) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const { paymentMethod, transactionId, amount } = result.data;
  const paidAmount = amount ?? Number(invoice.total);
  const now = new Date();

  const [updatedInvoice] = await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: paidAmount >= Number(invoice.total) ? "paid" : "partially_paid",
        paidAt: now,
        paymentMethod,
      },
    }),
    prisma.paymentRecord.create({
      data: {
        invoiceId: invoice.id,
        provider: paymentMethod,
        transactionId: transactionId ?? `manual-${Date.now()}`,
        amount: paidAmount,
      },
    }),
  ]);

  // Send email receipt if fully paid
  if (paidAmount >= Number(invoice.total)) {
    emailReceiptQueue.add({
      invoiceId: invoice.id,
      patientPhone: invoice.patient.phone,
      total: paidAmount,
      paidAt: now.toISOString(),
    }).catch(() => {}); // fire-and-forget
  }

  res.json(updatedInvoice);
}));

// ─── GET /api/billing/reports/revenue ────────────────────────────────────────

billingRouter.get("/reports/revenue", requireScope("billing:read"), asyncHandler(async (req, res) => {
  const { from, to } = z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .parse(req.query);

  const where = {
    doctorId: req.user!.doctor_id!,
    status: { in: ["paid", "partially_paid"] as ("paid" | "partially_paid")[] },
    ...(from || to
      ? {
          paidAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000+05:30`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999+05:30`) } : {}),
          },
        }
      : {}),
  };

  const result = await prisma.invoice.aggregate({
    where,
    _sum: { total: true, gstAmount: true, amount: true },
    _count: { id: true },
  });

  res.json({
    totalRevenue: result._sum?.total ?? 0,
    consultationFees: result._sum?.amount ?? 0,
    gstCollected: result._sum?.gstAmount ?? 0,
    invoiceCount: (result._count as { id?: number })?.id ?? 0,
    period: { from: from ?? null, to: to ?? null },
  });
}));

// ─── GET /api/billing/reports/daily — Day-by-day revenue for sparkline ────────

billingRouter.get("/reports/daily", requireScope("billing:read"), asyncHandler(async (req, res) => {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) }).parse(req.query);

  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  from.setHours(0, 0, 0, 0);

  const invoices = await prisma.invoice.findMany({
    where: {
      doctorId: req.user!.doctor_id!,
      status: { in: ["paid", "partially_paid"] },
      paidAt: { gte: from },
    },
    select: { paidAt: true, total: true },
    orderBy: { paidAt: "asc" },
  });

  const byDate: Record<string, number> = {};
  // Pre-fill all days with 0
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    byDate[d.toISOString().slice(0, 10)] = 0;
  }
  for (const inv of invoices) {
    if (!inv.paidAt) continue;
    const d = inv.paidAt.toISOString().slice(0, 10);
    byDate[d] = (byDate[d] ?? 0) + Number(inv.total);
  }

  res.json({ days: byDate });
}));

// ─── GET /api/billing/invoices/:id/pdf ──────────────────────────────────────

billingRouter.get("/invoices/:id/pdf", requireScope("billing:read"), asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params["id"] },
    include: {
      patient: { select: { phone: true } },
      doctor: { select: { name: true, clinicDoctors: { include: { clinic: true }, take: 1 } } },
    },
  });

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const clinic = invoice.doctor.clinicDoctors[0]?.clinic;

  const pdfBuffer = await generateInvoicePdf({
    invoiceId: invoice.id,
    createdAt: invoice.createdAt,
    clinic: {
      name: clinic?.name ?? "CliniqAI Clinic",
      address: clinic?.address ?? "",
      gstNumber: clinic?.gstNumber,
    },
    doctor: { name: invoice.doctor.name },
    patient: { phone: invoice.patient.phone },
    amount: Number(invoice.amount),
    gstAmount: Number(invoice.gstAmount),
    total: Number(invoice.total),
    status: invoice.status,
    paymentMethod: invoice.paymentMethod,
    paidAt: invoice.paidAt,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.id.slice(0, 8)}.pdf"`);
  res.send(pdfBuffer);
}));
