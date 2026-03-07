"use client";

import { useEffect, useState } from "react";
import { billing } from "@/lib/api";

const BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api";

interface Invoice {
  id: string;
  consultationId: string;
  patientId: string;
  amount: string;
  gstAmount: string;
  total: string;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
  createdAt: string;
  patient: { id: string; phone: string };
}

interface RevenueData {
  totalRevenue: number;
  consultationFees: number;
  gstCollected: number;
  invoiceCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  partially_paid: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-600",
};

export default function BillingPage() {
  const thisMonth = new Date();
  const from = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const to = new Date().toISOString().slice(0, 10);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const token = localStorage.getItem("cliniqai_access_token") ?? "";
      const url = `${BASE}/billing/invoices/export?from=${from}&to=${to}${statusFilter ? `&status=${statusFilter}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `invoices-${from}-to-${to}.csv`;
      a.click();
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    billing.revenue({ from, to }).then((r) => setRevenue(r as RevenueData)).catch(() => null);
  }, []);

  useEffect(() => {
    setLoading(true);
    billing
      .listInvoices({ ...(statusFilter ? { status: statusFilter } : {}), page })
      .then((r) => {
        const data = r as { data: Invoice[]; meta: { total: number; pages: number } };
        setInvoices(data.data);
        setMeta(data.meta);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  async function handleMarkPaid(invoice: Invoice) {
    const method = prompt("Payment method (cash / upi / card)?", "cash");
    if (!method) return;
    setMarkingId(invoice.id);
    try {
      await billing.markPaid(invoice.id, { paymentMethod: method });
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoice.id ? { ...inv, status: "paid", paymentMethod: method, paidAt: new Date().toISOString() } : inv))
      );
      setRevenue(null); // trigger refetch
      billing.revenue({ from, to }).then((r) => setRevenue(r as RevenueData)).catch(() => null);
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "⬇ Export CSV"}
        </button>
      </div>

      {/* Revenue summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="This Month Revenue" value={revenue ? `₹${Number(revenue.totalRevenue).toLocaleString("en-IN")}` : "—"} />
        <StatCard label="Invoices" value={revenue ? String(revenue.invoiceCount) : "—"} />
        <StatCard label="GST Collected" value={revenue ? `₹${Number(revenue.gstCollected).toLocaleString("en-IN")}` : "—"} />
        <StatCard label="Consultation Fees" value={revenue ? `₹${Number(revenue.consultationFees).toLocaleString("en-IN")}` : "—"} />
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="py-20 text-center text-sm text-gray-400">No invoices found.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Date", "Patient", "Fees", "GST", "Total", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{inv.patient.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">₹{Number(inv.amount).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">₹{Number(inv.gstAmount).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">₹{Number(inv.total).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {inv.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {inv.status === "pending" && (
                        <button
                          onClick={() => handleMarkPaid(inv)}
                          disabled={markingId === inv.id}
                          className="text-xs text-green-600 hover:underline disabled:opacity-50"
                        >
                          {markingId === inv.id ? "Saving…" : "Mark Paid"}
                        </button>
                      )}
                      {inv.status === "paid" && (
                        <span className="text-xs text-gray-400">
                          {inv.paymentMethod} · {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("en-IN") : ""}
                        </span>
                      )}
                      <a
                        href={`/dashboard/billing/invoices/${inv.id}/print`}
                        target="_blank"
                        className="text-xs text-gray-400 hover:text-gray-700"
                        title="Print Invoice"
                      >
                        🖨
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
            <span>{meta.total} invoice{meta.total !== 1 ? "s" : ""}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded px-2 py-1 disabled:opacity-40 hover:bg-gray-100">← Prev</button>
              <span>Page {page} / {meta.pages}</span>
              <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className="rounded px-2 py-1 disabled:opacity-40 hover:bg-gray-100">Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
