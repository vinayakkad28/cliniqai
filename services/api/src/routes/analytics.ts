import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

// GET /api/analytics/summary?days=30 — Practice analytics for the authenticated doctor
analyticsRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const doctorId = req.user!.doctor_id!;
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Run independent queries in parallel
    const [
      totalPatients,
      totalConsultations,
      revenueResult,
      consultations,
      topDiagnoses,
      appointmentsByType,
      consultationsByHour,
    ] = await Promise.all([
      // Total unique patients with appointments for this doctor
      prisma.appointment.findMany({
        where: { doctorId, scheduledAt: { gte: since } },
        select: { patientId: true },
        distinct: ["patientId"],
      }),

      // Total consultations in the period
      prisma.consultation.count({
        where: { doctorId, startedAt: { gte: since } },
      }),

      // Total revenue from paid invoices
      prisma.invoice.aggregate({
        where: { doctorId, status: "paid", paidAt: { gte: since } },
        _sum: { total: true },
      }),

      // Consultations with timing data for average duration
      prisma.consultation.findMany({
        where: {
          doctorId,
          startedAt: { gte: since },
          endedAt: { not: null },
        },
        select: { startedAt: true, endedAt: true },
      }),

      // Top diagnoses
      prisma.consultation.groupBy({
        by: ["diagnosis"],
        where: {
          doctorId,
          startedAt: { gte: since },
          diagnosis: { not: null },
        },
        _count: { diagnosis: true },
        orderBy: { _count: { diagnosis: "desc" } },
        take: 8,
      }),

      // Appointments grouped by type
      prisma.appointment.groupBy({
        by: ["type"],
        where: { doctorId, scheduledAt: { gte: since } },
        _count: { type: true },
      }),

      // Consultations for hour-of-day breakdown
      prisma.consultation.findMany({
        where: { doctorId, startedAt: { gte: since } },
        select: { startedAt: true },
      }),
    ]);

    // Calculate average consultation duration in minutes
    let avgConsultationDuration = 12; // default
    if (consultations.length > 0) {
      const totalMinutes = consultations.reduce((sum: number, c: typeof consultations[number]) => {
        const diff = (c.endedAt!.getTime() - c.startedAt.getTime()) / 60_000;
        return sum + diff;
      }, 0);
      avgConsultationDuration = Math.round(totalMinutes / consultations.length);
    }

    // Build hour-of-day histogram (hours 8-19)
    const hourCounts: Record<number, number> = {};
    for (let h = 8; h <= 19; h++) hourCounts[h] = 0;
    for (const c of consultationsByHour) {
      const hour = c.startedAt.getHours();
      if (hour >= 8 && hour <= 19) {
        hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
      }
    }

    res.json({
      totalPatients: totalPatients.length,
      totalConsultations,
      totalRevenue: revenueResult._sum.total ?? 0,
      avgConsultationDuration,
      topDiagnoses: topDiagnoses.map((d: typeof topDiagnoses[number]) => ({
        diagnosis: d.diagnosis,
        count: d._count.diagnosis,
      })),
      appointmentsByType: appointmentsByType.map((a: typeof appointmentsByType[number]) => ({
        type: a.type,
        count: a._count.type,
      })),
      consultationsByHour: Object.entries(hourCounts).map(([hour, count]) => ({
        hour: parseInt(hour),
        count,
      })),
    });
  }),
);
