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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Good {greeting()}, {user?.doctor?.name ? `Dr. ${user.doctor.name.split(" ")[0]}` : "Doctor"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{todayDate}</p>
      </div>

      {/* Active consultations alert */}
      {activeConsultations.length > 0 && (
        <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 p-4">
          <p className="text-sm font-semibold text-purple-800 mb-2">
            🩺 {activeConsultations.length} active consultation{activeConsultations.length !== 1 ? "s" : ""} in progress
          </p>
          <div className="flex flex-wrap gap-2">
            {activeConsultations.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/consultations/${c.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50"
              >
                {c.patient.phone}
                {c.chiefComplaint && <span className="text-purple-400">— {c.chiefComplaint.slice(0, 25)}</span>}
                <span className="text-purple-500">Open →</span>
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
          color="blue"
        />
        <StatCard
          label="Today's Appointments"
          value={String(todayAppts.length)}
          sub={`${pendingAppts.length} pending · ${completedAppts.length} done`}
          color="green"
        />
        <StatCard
          label="GST Collected"
          value={revenue ? `₹${Number(revenue.gstCollected).toLocaleString("en-IN")}` : "—"}
          sub="Today"
          color="purple"
        />
        <StatCard
          label="Consultation Fees"
          value={revenue ? `₹${Number(revenue.consultationFees).toLocaleString("en-IN")}` : "—"}
          sub="Before GST"
          color="orange"
        />
      </div>

      {/* Revenue sparkline */}
      {dailyRevenue && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Revenue — Last 30 Days</h2>
            {sparkTooltip && (
              <span className="text-xs text-gray-500">
                {sparkTooltip.date}: <span className="font-semibold text-gray-900">₹{sparkTooltip.amount.toLocaleString("en-IN")}</span>
              </span>
            )}
          </div>
          <RevenueSparkline data={dailyRevenue} onHover={setSparkTooltip} />
        </div>
      )}

      {/* Quick actions */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-8">
        <QuickAction href="/dashboard/appointments/new" label="Book Appointment" icon="📅" primary />
        <QuickAction href="/dashboard/patients/new" label="Register Patient" icon="👤" />
        <QuickAction href="/dashboard/appointments" label="Today's Schedule" icon="🗓️" />
        <QuickAction href="/dashboard/billing" label="Billing" icon="💳" />
      </div>

      {/* Today's upcoming appointments */}
      {pendingAppts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Upcoming Today</h2>
          <div className="space-y-2">
            {pendingAppts.slice(0, 5).map((appt) => (
              <Link
                key={appt.id}
                href={`/dashboard/appointments/${appt.id}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-blue-300 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(appt.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    <span className="ml-2 text-xs text-gray-400 capitalize">{appt.type.replace("_", " ")}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{appt.patientId.slice(0, 8)}…</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  appt.status === "confirmed" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                }`}>
                  {appt.status}
                </span>
              </Link>
            ))}
            {pendingAppts.length > 5 && (
              <Link href="/dashboard/appointments" className="block text-center text-xs text-blue-600 hover:underline py-2">
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
    blue: "border-blue-100 bg-blue-50",
    green: "border-green-100 bg-green-50",
    purple: "border-purple-100 bg-purple-50",
    orange: "border-orange-100 bg-orange-50",
  };
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${colors[color] ?? "border-gray-200 bg-white"}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{sub}</p>
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
              className={val > 0 ? "fill-blue-500 hover:fill-blue-600 cursor-pointer" : "fill-gray-100"}
              onMouseEnter={(e) => onHover({ date, amount: val, x: e.clientX })}
              onMouseLeave={() => onHover(null)}
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
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
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm hover:shadow-md transition-all ${
        primary ? "border-blue-300 bg-blue-600 hover:bg-blue-700" : "border-gray-200 bg-white hover:border-blue-300"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className={`text-sm font-medium ${primary ? "text-white" : "text-gray-700"}`}>{label}</span>
    </Link>
  );
}
