"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { billing, appointments, consultations } from "@/lib/api";
import type { Appointment } from "@/lib/api";

interface RevenueData {
  totalRevenue: number;
  consultationFees: number;
  gstCollected: number;
  invoiceCount: number;
}

interface ConsultationItem {
  id: string;
  patientId: string;
  status: string;
  chiefComplaint?: string;
  startedAt: string;
  patient: { id: string; phone: string };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [activeConsultations, setActiveConsultations] = useState<ConsultationItem[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<Record<string, number> | null>(null);
  const [sparkTooltip, setSparkTooltip] = useState<{ date: string; amount: number; x: number } | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      billing.revenue({ from: today, to: today }).catch(() => null),
      appointments.list({ date: today }).catch(() => null),
      consultations.list({ status: "in_progress", limit: 5 }).catch(() => null),
      billing.dailyRevenue(30).catch(() => null),
    ]).then(([rev, apptData, consultData, daily]) => {
      if (rev) setRevenue(rev as RevenueData);
      const ad = apptData as { data: Appointment[] } | null;
      if (ad?.data) setTodayAppts(ad.data);
      const cd = consultData as { data: ConsultationItem[] } | null;
      if (cd?.data) setActiveConsultations(cd.data);
      if (daily) setDailyRevenue((daily as { days: Record<string, number> }).days);
    });
  }, []);

  const todayDate = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const pendingAppts = todayAppts.filter((a) => ["scheduled", "confirmed"].includes(a.status));
  const completedAppts = todayAppts.filter((a) => a.status === "completed");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Good {greeting()}, {user?.doctor?.name ? `Dr. ${user.doctor.name.split(" ")[0]}` : "Doctor"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{todayDate}</p>
      </div>

      {/* Active consultations alert */}
      {activeConsultations.length > 0 && (
        <div className="mb-6 rounded-xl border border-secondary-200 bg-secondary-50 p-4 animate-slide-up">
          <p className="text-sm font-semibold text-secondary-800 mb-2">
            🩺 {activeConsultations.length} active consultation{activeConsultations.length !== 1 ? "s" : ""} in progress
          </p>
          <div className="flex flex-wrap gap-2">
            {activeConsultations.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/consultations/${c.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-secondary-200 px-3 py-1 text-xs font-medium text-secondary-700 hover:bg-secondary-50 transition-colors"
              >
                {c.patient.phone}
                {c.chiefComplaint && <span className="text-secondary-400">— {c.chiefComplaint.slice(0, 25)}</span>}
                <span className="text-secondary-500">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <StatCard
          label="Today's Revenue"
          value={revenue ? `₹${Number(revenue.totalRevenue).toLocaleString("en-IN")}` : "—"}
          sub={`${revenue?.invoiceCount ?? 0} invoices`}
          color="primary"
        />
        <StatCard
          label="Today's Appointments"
          value={String(todayAppts.length)}
          sub={`${pendingAppts.length} pending · ${completedAppts.length} done`}
          color="success"
        />
        <StatCard
          label="GST Collected"
          value={revenue ? `₹${Number(revenue.gstCollected).toLocaleString("en-IN")}` : "—"}
          sub="Today"
          color="secondary"
        />
        <StatCard
          label="Consultation Fees"
          value={revenue ? `₹${Number(revenue.consultationFees).toLocaleString("en-IN")}` : "—"}
          sub="Before GST"
          color="accent"
        />
      </div>

      {/* Revenue sparkline */}
      {dailyRevenue && (
        <div className="mb-8 cliniq-card-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Revenue — Last 30 Days</h2>
            {sparkTooltip && (
              <span className="text-xs text-slate-500">
                {sparkTooltip.date}: <span className="font-semibold text-slate-900">₹{sparkTooltip.amount.toLocaleString("en-IN")}</span>
              </span>
            )}
          </div>
          <RevenueSparkline data={dailyRevenue} onHover={setSparkTooltip} />
        </div>
      )}

      {/* Quick actions */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-8">
        <QuickAction href="/dashboard/appointments/new" label="Book Appointment" icon="📅" primary />
        <QuickAction href="/dashboard/patients/new" label="Register Patient" icon="👤" />
        <QuickAction href="/dashboard/appointments" label="Today's Schedule" icon="🗓️" />
        <QuickAction href="/dashboard/billing" label="Billing" icon="💳" />
      </div>

      {/* Today's upcoming appointments */}
      {pendingAppts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Upcoming Today</h2>
          <div className="space-y-2">
            {pendingAppts.slice(0, 5).map((appt) => (
              <Link
                key={appt.id}
                href={`/dashboard/appointments/${appt.id}`}
                className="flex items-center justify-between cliniq-card px-4 py-3 hover:border-primary-300 transition-all duration-150"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(appt.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    <span className="ml-2 text-xs text-slate-400 capitalize">{appt.type.replace("_", " ")}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{appt.patientId.slice(0, 8)}…</p>
                </div>
                <span className={`cliniq-badge ${
                  appt.status === "confirmed"
                    ? "bg-primary-50 text-primary-700"
                    : "bg-accent-100 text-accent-700"
                }`}>
                  {appt.status}
                </span>
              </Link>
            ))}
            {pendingAppts.length > 5 && (
              <Link href="/dashboard/appointments" className="block text-center text-xs text-primary-600 hover:underline py-2">
                View all {pendingAppts.length} appointments →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    primary: "border-primary-100 bg-primary-50",
    success: "border-green-100 bg-green-50",
    secondary: "border-secondary-100 bg-secondary-50",
    accent: "border-accent-100 bg-accent-50",
  };
  return (
    <div className={`rounded-xl border p-5 shadow-xs ${colors[color] ?? "border-slate-200 bg-white"}`}>
      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function RevenueSparkline({
  data,
  onHover,
}: {
  data: Record<string, number>;
  onHover: (v: { date: string; amount: number; x: number } | null) => void;
}) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const values = entries.map(([, v]) => v);
  const maxVal = Math.max(...values, 1);
  const W = 600;
  const H = 80;
  const barW = Math.floor(W / entries.length) - 2;

  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
        {entries.map(([date, val], i) => {
          const x = i * (W / entries.length);
          const barH = Math.max(2, (val / maxVal) * (H - 4));
          const y = H - barH;
          return (
            <rect
              key={date}
              x={x + 1}
              y={y}
              width={barW}
              height={barH}
              rx={2}
              className={val > 0 ? "fill-primary-500 hover:fill-primary-600 cursor-pointer transition-colors" : "fill-slate-100"}
              onMouseEnter={(e) => onHover({ date, amount: val, x: e.clientX })}
              onMouseLeave={() => onHover(null)}
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-2xs text-slate-400">
        <span>{entries[0]?.[0]?.slice(5)}</span>
        <span>{entries[entries.length - 1]?.[0]?.slice(5)}</span>
      </div>
    </div>
  );
}

function QuickAction({ href, label, icon, primary }: { href: string; label: string; icon: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xs hover:shadow-md transition-all duration-150 ${
        primary
          ? "border-primary-400 bg-gradient-primary hover:opacity-90"
          : "border-slate-100 bg-white hover:border-primary-200"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className={`text-sm font-semibold ${primary ? "text-white" : "text-slate-700"}`}>{label}</span>
    </Link>
  );
}
