"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { billing, appointments, consultations } from "@/lib/api";
import type { Appointment } from "@/lib/api";
import { CardSkeleton, ListSkeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import {
  CalendarDaysIcon,
  UserPlusIcon,
  ClockIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
  patient: { id: string; phone: string; name?: string | null };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [activeConsultations, setActiveConsultations] = useState<ConsultationItem[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; amount: number }[] | null>(null);
  const [loading, setLoading] = useState(true);

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
      if (daily) {
        const days = (daily as { days: Record<string, number> }).days;
        const entries = Object.entries(days)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, amount]) => ({ date: date.slice(5), amount }));
        setDailyRevenue(entries);
      }
      setLoading(false);
    });
  }, []);

  const todayDate = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const pendingAppts = todayAppts.filter((a) => ["scheduled", "confirmed"].includes(a.status));
  const completedAppts = todayAppts.filter((a) => a.status === "completed");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Good {greeting()}, {user?.doctor?.name ? `Dr. ${user.doctor.name.split(" ")[0]}` : "Doctor"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{todayDate}</p>
      </div>

      {/* Active consultations alert */}
      {activeConsultations.length > 0 && (
        <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 p-4 animate-slide-up">
          <p className="text-sm font-semibold text-purple-800 mb-2">
            {activeConsultations.length} active consultation{activeConsultations.length !== 1 ? "s" : ""} in progress
          </p>
          <div className="flex flex-wrap gap-2">
            {activeConsultations.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/consultations/${c.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
              >
                {c.patient.name || c.patient.phone}
                {c.chiefComplaint && <span className="text-purple-400">— {c.chiefComplaint.slice(0, 25)}</span>}
                <span className="text-purple-500">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
          <StatCard
            label="Today's Revenue"
            value={revenue ? `₹${Number(revenue.totalRevenue).toLocaleString("en-IN")}` : "₹0"}
            sub={`${revenue?.invoiceCount ?? 0} invoices`}
          />
          <StatCard
            label="Today's Appointments"
            value={String(todayAppts.length)}
            sub={`${pendingAppts.length} pending · ${completedAppts.length} done`}
          />
          <StatCard
            label="GST Collected"
            value={revenue ? `₹${Number(revenue.gstCollected).toLocaleString("en-IN")}` : "₹0"}
            sub="Today"
          />
          <StatCard
            label="Consultation Fees"
            value={revenue ? `₹${Number(revenue.consultationFees).toLocaleString("en-IN")}` : "₹0"}
            sub="Before GST"
          />
        </div>
      )}

      {/* Revenue chart */}
      {loading ? (
        <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="h-4 w-40 animate-pulse rounded bg-muted mb-4" />
          <div className="h-48 animate-pulse rounded bg-muted" />
        </div>
      ) : dailyRevenue && dailyRevenue.length > 0 ? (
        <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">Revenue — Last 30 Days</h2>
          <div aria-label="30-day revenue trend chart" role="img">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyRevenue}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891B2" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0891B2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                  width={50}
                />
                <Tooltip
                  formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
                  labelFormatter={(label) => `Date: ${String(label)}`}
                  contentStyle={{ borderRadius: 8, border: "1px solid #CCFBF1", fontSize: 13 }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#0891B2"
                  strokeWidth={2}
                  fill="url(#revGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Revenue — Last 30 Days</h2>
          <p className="text-sm text-muted-foreground py-8 text-center">No revenue data yet</p>
        </div>
      )}

      {/* Quick actions */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-8">
        <QuickAction href="/dashboard/appointments/new" label="Book Appointment" Icon={CalendarDaysIcon} primary />
        <QuickAction href="/dashboard/patients/new" label="Register Patient" Icon={UserPlusIcon} />
        <QuickAction href="/dashboard/appointments" label="Today's Schedule" Icon={ClockIcon} />
        <QuickAction href="/dashboard/billing" label="Billing" Icon={CreditCardIcon} />
      </div>

      {/* Today's upcoming appointments */}
      {!loading && pendingAppts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming Today</h2>
          <div className="space-y-2">
            {pendingAppts.slice(0, 5).map((appt) => (
              <Link
                key={appt.id}
                href={`/dashboard/appointments/${appt.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm hover:border-primary/40 transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    {new Date(appt.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    <span className="ml-2 text-xs text-muted-foreground capitalize">{appt.type.replace("_", " ")}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{appt.patient?.name || appt.patient?.phone || `${appt.patientId.slice(0, 8)}…`}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  appt.status === "confirmed" ? "bg-primary/10 text-primary" : "bg-yellow-100 text-yellow-700"
                }`}>
                  {appt.status}
                </span>
              </Link>
            ))}
            {pendingAppts.length > 5 && (
              <Link href="/dashboard/appointments" className="block text-center text-xs text-primary hover:underline py-2 cursor-pointer">
                View all {pendingAppts.length} appointments →
              </Link>
            )}
          </div>
        </div>
      )}

      {!loading && pendingAppts.length === 0 && todayAppts.length === 0 && (
        <EmptyState
          icon={<CalendarDaysIcon className="h-8 w-8 text-muted-foreground" />}
          title="No appointments today"
          description="Book your first appointment to get started"
          actionLabel="Book Appointment"
          actionHref="/dashboard/appointments/new"
        />
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

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-card-foreground tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function QuickAction({ href, label, Icon, primary }: { href: string; label: string; Icon: React.ComponentType<{ className?: string }>; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        primary ? "border-primary bg-primary hover:opacity-90" : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${primary ? "text-primary-foreground" : "text-primary"}`} aria-hidden="true" />
      <span className={`text-sm font-medium ${primary ? "text-primary-foreground" : "text-card-foreground"}`}>{label}</span>
    </Link>
  );
}
