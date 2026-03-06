"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { billing } from "@/lib/api";

interface RevenueData {
  totalRevenue: number;
  consultationFees: number;
  gstCollected: number;
  invoiceCount: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState<RevenueData | null>(null);

  useEffect(() => {
    // Today's date range
    const today = new Date().toISOString().slice(0, 10);
    billing.revenue({ from: today, to: today }).then((r) => setRevenue(r as RevenueData)).catch(() => null);
  }, []);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Good {greeting()}, Dr. {user?.doctor?.name?.split(" ")[0] ?? "Doctor"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{today}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <StatCard
          label="Today's Revenue"
          value={revenue ? `₹${Number(revenue.totalRevenue).toLocaleString("en-IN")}` : "—"}
          sub="Billed today"
        />
        <StatCard
          label="Consultations"
          value={revenue ? String(revenue.invoiceCount) : "—"}
          sub="Invoiced today"
        />
        <StatCard
          label="GST Collected"
          value={revenue ? `₹${Number(revenue.gstCollected).toLocaleString("en-IN")}` : "—"}
          sub="Today"
        />
        <StatCard
          label="Consultation Fees"
          value={revenue ? `₹${Number(revenue.consultationFees).toLocaleString("en-IN")}` : "—"}
          sub="Before GST"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuickAction href="/dashboard/appointments" label="View Today's Appointments" icon="📅" />
        <QuickAction href="/dashboard/patients" label="Search Patients" icon="🔍" />
        <QuickAction href="/dashboard/patients/new" label="Register New Patient" icon="➕" />
        <QuickAction href="/dashboard/billing" label="Billing & Invoices" icon="💳" />
      </div>
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
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </a>
  );
}
