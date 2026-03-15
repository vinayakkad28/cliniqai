"use client";

import { useEffect, useState } from "react";
import { billing } from "@/lib/api";
import { toast } from "sonner";
import { CardSkeleton, TableSkeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import { CreditCardIcon, PrinterIcon } from "@heroicons/react/24/outline";

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
  patient: { id: string; phone: string; name?: string | null };
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
  partially_paid: "bg-primary/10 text-primary",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-muted text-muted-foreground",
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
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const token = localStorage.getItem("cliniqai_access_token") ?? "";
      const url = `${BASE}/billing/invoices/export?from=${from}&to=${to}${statusFilter ? `&status=${statusFilter}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error("Export failed"); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `invoices-${from}-to-${to}.csv`;
      a.click();
      toast.success("CSV exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    setRevenueLoading(true);
    billing.revenue({ from, to }).then((r) => setRevenue(r as RevenueData)).catch(() => null).finally(() => setRevenueLoading(false));
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
      toast.success("Invoice marked as paid");
      billing.revenue({ from, to }).then((r) => setRevenue(r as RevenueData)).catch(() => null);
    } catch {
      toast.error("Failed to update payment");
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">Billing</h1>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={exporting}
          className="cursor-pointer flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {/* Revenue summary */}
      {revenueLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="This Month Revenue" value={revenue ? `₹${Number(revenue.totalRevenue).toLocaleString("en-IN")}` : "₹0"} />
          <StatCard label="Invoices" value={revenue ? String(revenue.invoiceCount) : "0"} />
          <StatCard label="GST Collected" value={revenue ? `₹${Number(revenue.gstCollected).toLocaleString("en-IN")}` : "₹0"} />
          <StatCard label="Consultation Fees" value={revenue ? `₹${Number(revenue.consultationFees).toLocaleString("en-IN")}` : "₹0"} />
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by status"
          className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
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
        <TableSkeleton rows={5} cols={7} />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon className="h-8 w-8 text-muted-foreground" />}
          title="No invoices found"
          description={statusFilter ? "Try a different status filter" : "Invoices will appear here after consultations"}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  {["Date", "Patient", "Fees", "GST", "Total", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-sm text-card-foreground">{inv.patient.name || inv.patient.phone}</td>
                    <td className="px-4 py-3 text-sm text-card-foreground tabular-nums">₹{Number(inv.amount).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">₹{Number(inv.gstAmount).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-card-foreground tabular-nums">₹{Number(inv.total).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] ?? "bg-muted text-muted-foreground"}`}>
                        {inv.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {inv.status === "pending" && (
                          <button
                            onClick={() => handleMarkPaid(inv)}
                            disabled={markingId === inv.id}
                            className="cursor-pointer text-xs text-accent hover:underline disabled:opacity-50"
                          >
                            {markingId === inv.id ? "Saving…" : "Mark Paid"}
                          </button>
                        )}
                        {inv.status === "paid" && (
                          <span className="text-xs text-muted-foreground">
                            {inv.paymentMethod} · {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("en-IN") : ""}
                          </span>
                        )}
                        <a
                          href={`/dashboard/billing/invoices/${inv.id}/print`}
                          target="_blank"
                          className="text-muted-foreground hover:text-card-foreground"
                          aria-label="Print invoice"
                        >
                          <PrinterIcon className="h-4 w-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>{meta.total} invoice{meta.total !== 1 ? "s" : ""}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="cursor-pointer rounded px-2 py-1 disabled:opacity-40 hover:bg-muted">← Prev</button>
              <span>Page {page} / {meta.pages}</span>
              <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className="cursor-pointer rounded px-2 py-1 disabled:opacity-40 hover:bg-muted">Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-card-foreground tabular-nums">{value}</p>
    </div>
  );
}
