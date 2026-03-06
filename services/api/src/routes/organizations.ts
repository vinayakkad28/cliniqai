/**
 * Organization routes — Phase 4 (multi-tenancy).
 *
 * Organizations are the top-level tenants (hospital, clinic group, solo practice).
 * Each doctor, clinic, and patient will be associated with an organization via
 * organization_id (added as a schema migration).
 *
 * POST /api/organizations         — create organization (admin only)
 * GET  /api/organizations/:id     — get organization details
 * PATCH /api/organizations/:id    — update organization (admin only)
 * GET  /api/organizations/:id/stats — usage stats for hospital admin dashboard
 */

import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

export const organizationsRouter = Router();
organizationsRouter.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(200),
  gstin: z.string().regex(/^[0-9A-Z]{15}$/, "Invalid GSTIN format").optional(),
  subscriptionTier: z.enum(["solo", "clinic", "hospital", "enterprise"]).default("solo"),
});

const UpdateOrgSchema = CreateOrgSchema.partial();

// ─── POST /api/organizations ──────────────────────────────────────────────────

organizationsRouter.post("/", requireRole("admin"), async (req, res) => {
  const result = CreateOrgSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const org = await prisma.organization.create({
    data: {
      name: result.data.name,
      gstin: result.data.gstin,
      subscriptionTier: result.data.subscriptionTier as never,
    },
  });

  res.status(201).json(org);
});

// ─── GET /api/organizations/:id ───────────────────────────────────────────────

organizationsRouter.get("/:id", async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.params["id"] } });
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json(org);
});

// ─── PATCH /api/organizations/:id ─────────────────────────────────────────────

organizationsRouter.patch("/:id", requireRole("admin"), async (req, res) => {
  const result = UpdateOrgSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const org = await prisma.organization.findUnique({ where: { id: req.params["id"] } });
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: {
      ...(result.data.name !== undefined ? { name: result.data.name } : {}),
      ...(result.data.gstin !== undefined ? { gstin: result.data.gstin } : {}),
      ...(result.data.subscriptionTier !== undefined ? { subscriptionTier: result.data.subscriptionTier as never } : {}),
    },
  });

  res.json(updated);
});

// ─── GET /api/organizations/:id/stats ─────────────────────────────────────────

organizationsRouter.get("/:id/stats", requireRole("admin"), async (req, res) => {
  // Aggregate usage stats for the hospital admin dashboard
  // In Phase 4 these will be filtered by organizationId — for now global counts
  const [doctorCount, patientCount, consultationCount, invoiceRevenue] = await Promise.all([
    prisma.doctor.count(),
    prisma.patient.count(),
    prisma.consultation.count(),
    prisma.invoice.aggregate({
      where: { status: { in: ["paid", "partially_paid"] } },
      _sum: { total: true },
    }),
  ]);

  res.json({
    doctors: doctorCount,
    patients: patientCount,
    consultations: consultationCount,
    totalRevenue: invoiceRevenue._sum?.total ?? 0,
  });
});
