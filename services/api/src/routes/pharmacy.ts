import { Router } from "express";
import { z } from "zod";
import { authenticate, requireScope } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

export const pharmacyRouter = Router();

pharmacyRouter.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const CreateMedicineSchema = z.object({
  name: z.string().min(1).max(200),
  genericName: z.string().max(200).optional(),
  manufacturer: z.string().max(200).optional(),
  form: z.string().max(50).optional(),
  strength: z.string().max(50).optional(),
  unit: z.string().max(30).optional(),
});

const UpdateInventorySchema = z.object({
  stockQuantity: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  expiryDate: z.string().datetime().optional(),
  batchNumber: z.string().optional(),
  costPrice: z.number().positive().optional(),
  sellingPrice: z.number().positive().optional(),
});

const DispenseSchema = z.object({
  prescriptionId: z.string().uuid(),
  medicineId: z.string().uuid(),
  quantity: z.number().int().positive(),
  clinicId: z.string().uuid(),
});

// ─── GET /api/pharmacy/medicines ─────────────────────────────────────────────

pharmacyRouter.get("/medicines", requireScope("pharmacy:read"), async (req, res) => {
  const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { genericName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, medicines] = await Promise.all([
    prisma.medicine.count({ where }),
    prisma.medicine.findMany({ where, skip, take: parseInt(limit), orderBy: { name: "asc" } }),
  ]);

  res.json({ data: medicines, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
});

// ─── POST /api/pharmacy/medicines ────────────────────────────────────────────

pharmacyRouter.post("/medicines", requireScope("pharmacy:write"), async (req, res) => {
  const result = CreateMedicineSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const medicine = await prisma.medicine.create({ data: result.data });
  res.status(201).json(medicine);
});

// ─── GET /api/pharmacy/inventory/low-stock — MUST be before /:id ─────────────

pharmacyRouter.get("/inventory/low-stock", requireScope("pharmacy:read"), async (req, res) => {
  const clinicId = req.query["clinicId"] as string | undefined;

  const items = await prisma.inventory.findMany({
    where: {
      ...(clinicId ? { clinicId } : {}),
      stockQuantity: { lte: prisma.inventory.fields.reorderLevel },
    },
    include: { medicine: true },
    orderBy: { stockQuantity: "asc" },
  });

  res.json(items);
});

// ─── GET /api/pharmacy/inventory ─────────────────────────────────────────────

pharmacyRouter.get("/inventory", requireScope("pharmacy:read"), async (req, res) => {
  const clinicId = req.query["clinicId"] as string | undefined;

  const inventory = await prisma.inventory.findMany({
    where: clinicId ? { clinicId } : {},
    include: { medicine: true },
    orderBy: { medicine: { name: "asc" } },
  });

  res.json(inventory);
});

// ─── PATCH /api/pharmacy/inventory/:id ───────────────────────────────────────

pharmacyRouter.patch("/inventory/:id", requireScope("pharmacy:write"), async (req, res) => {
  const result = UpdateInventorySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const item = await prisma.inventory.findUnique({ where: { id: req.params["id"] } });
  if (!item) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }

  const updated = await prisma.inventory.update({
    where: { id: item.id },
    data: {
      ...(result.data.stockQuantity !== undefined ? { stockQuantity: result.data.stockQuantity } : {}),
      ...(result.data.reorderLevel !== undefined ? { reorderLevel: result.data.reorderLevel } : {}),
      ...(result.data.expiryDate ? { expiryDate: new Date(result.data.expiryDate) } : {}),
      ...(result.data.batchNumber !== undefined ? { batchNumber: result.data.batchNumber } : {}),
      ...(result.data.costPrice !== undefined ? { costPrice: result.data.costPrice } : {}),
      ...(result.data.sellingPrice !== undefined ? { sellingPrice: result.data.sellingPrice } : {}),
    },
    include: { medicine: true },
  });

  res.json(updated);
});

// ─── GET /api/pharmacy/queue ──────────────────────────────────────────────────

pharmacyRouter.get("/queue", requireScope("pharmacy:read"), async (req, res) => {
  const rxList = await prisma.prescription.findMany({
    where: {
      doctorId: req.user!.doctor_id!,
      sentVia: { not: null },
    },
    orderBy: { sentAt: "desc" },
    take: 50,
    include: {
      patient: { select: { id: true, phone: true } },
      consultation: { select: { id: true, chiefComplaint: true } },
      dispensing: { include: { medicine: true } },
    },
  });
  res.json({ data: rxList });
});

// ─── POST /api/pharmacy/dispense ─────────────────────────────────────────────

pharmacyRouter.post("/dispense", requireScope("pharmacy:write"), async (req, res) => {
  const result = DispenseSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { prescriptionId, medicineId, quantity, clinicId } = result.data;

  const inventoryItem = await prisma.inventory.findFirst({
    where: { clinicId, medicineId },
  });

  if (!inventoryItem) {
    res.status(404).json({ error: "Medicine not found in clinic inventory" });
    return;
  }

  if (inventoryItem.stockQuantity < quantity) {
    res.status(400).json({
      error: "Insufficient stock",
      available: inventoryItem.stockQuantity,
      requested: quantity,
    });
    return;
  }

  const [dispensing] = await prisma.$transaction([
    prisma.dispensing.create({
      data: { prescriptionId, medicineId, quantityDispensed: quantity },
      include: { medicine: true },
    }),
    prisma.inventory.update({
      where: { id: inventoryItem.id },
      data: { stockQuantity: { decrement: quantity } },
    }),
  ]);

  res.status(201).json(dispensing);
});
