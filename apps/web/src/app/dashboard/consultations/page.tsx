"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { consultations } from "@/lib/api";

interface ConsultationItem {
  id: string;
  patientId: string;
  startedAt: string;
  endedAt?: string;
  chiefComplaint?: string;
  status: string;
  patient: { id: string; phone: string; name?: string | null };
  prescriptions: { id: string }[];
  labOrders: { id: string }[];
  invoices: { id: string; status: string; total: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function ConsultationsPage() {
  const [data, setData] = useState<{ data: ConsultationItem[]; meta: { total: number; pages: number } } | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    consultations
      .list({ status: statusFilter || undefined, page, limit: 20 })
      .then((r) => setData(r as typeof data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Consultations</h1>
      </div>

      <div className="mb-4 flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
      ) : !data?.data.length ? (
        <div className="py-20 text-center text-sm text-gray-400">No consultations found.</div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Date & Time", "Patient", "Chief Complaint", "Status", "Rx / Labs / Invoice", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(c.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      <span className="ml-2 text-xs text-gray-400">
                        {new Date(c.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/dashboard/patients/${c.patientId}`} className="text-blue-600 hover:underline font-medium">
                        {c.patient.name || c.patient.phone}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {c.chiefComplaint ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {c.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      <span className="mr-3">💊 {c.prescriptions.length}</span>
                      <span className="mr-3">🔬 {c.labOrders.length}</span>
                      <span>{c.invoices.length > 0 ? (c.invoices[0]!.status === "paid" ? "✅ Paid" : "🧾 Pending") : "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/consultations/${c.id}`} className="text-xs text-blue-600 hover:underline">
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
              <span>{data.meta.total} consultation{data.meta.total !== 1 ? "s" : ""}</span>
              {data.meta.pages > 1 && (
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="disabled:opacity-40 hover:text-gray-700">
                    ← Prev
                  </button>
                  <span>Page {page} / {data.meta.pages}</span>
                  <button onClick={() => setPage((p) => Math.min(data.meta.pages, p + 1))} disabled={page === data.meta.pages} className="disabled:opacity-40 hover:text-gray-700">
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
