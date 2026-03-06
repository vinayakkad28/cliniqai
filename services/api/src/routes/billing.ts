import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { emailReceiptQueue } from "../lib/queues.js";

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

billingRouter.post("/invoices", requireScope("billing:write"), async (req, res) => {
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
});

// ─── GET /api/billing/invoices ────────────────────────────────────────────────

billingRouter.get("/invoices", requireScope("billing:read"), async (req, res) => {
  const query = ListInvoicesSchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.flatten() });
    return;
  }

  const { status, from, to, patientId, page, limit } = query.data;
  const skip = (page - 1) * limit;

  const where = {
    doctorId: req.user!.sub,
    ...(status ? { status } : {}),
    ...(patientId ? { patientId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
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
      include: { patient: { select: { id: true, phone: true } } },
    }),
  ]);

  res.json({ data: invoices, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
});

// ─── GET /api/billing/invoices/:id ───────────────────────────────────────────

billingRouter.get("/invoices/:id", requireScope("billing:read"), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params["id"] },
    include: {
      patient: { select: { id: true, phone: true } },
      paymentMethods: true,
    },
  });

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json(invoice);
});

// ─── PATCH /api/billing/invoices/:id — Mark payment ─────────────────────────

billingRouter.patch("/invoices/:id", requireScope("billing:write"), async (req, res) => {
  const result = MarkPaidSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params["id"] },
    include: { patient: { select: { phone: true } } },
  });
  if (!invoice) {
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
    await emailReceiptQueue.add({
      invoiceId: invoice.id,
      patientPhone: invoice.patient.phone,
      total: paidAmount,
      paidAt: now.toISOString(),
    });
  }

  res.json(updatedInvoice);
});

// ─── GET /api/billing/reports/revenue ────────────────────────────────────────

billingRouter.get("/reports/revenue", requireScope("billing:read"), async (req, res) => {
  const { from, to } = z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .parse(req.query);

  const where = {
    doctorId: req.user!.sub,
    status: { in: ["paid", "partially_paid"] as ("paid" | "partially_paid")[] },
    ...(from || to
      ? {
          paidAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
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
});
