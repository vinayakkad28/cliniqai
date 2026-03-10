"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionType = "CREATE" | "UPDATE" | "DELETE" | "VIEW" | "LOGIN" | "LOGOUT";
type ResourceType = "patient" | "appointment" | "consultation" | "prescription" | "billing";

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: ActionType;
  resource: ResourceType;
  details: string;
  ip: string;
}

// ─── Action badge config ────────────────────────────────────────────────────

const ACTION_CONFIG: Record<ActionType, { bg: string; text: string }> = {
  CREATE: { bg: "bg-green-100", text: "text-green-700" },
  VIEW:   { bg: "bg-blue-100", text: "text-blue-700" },
  UPDATE: { bg: "bg-yellow-100", text: "text-yellow-700" },
  DELETE: { bg: "bg-red-100", text: "text-red-700" },
  LOGIN:  { bg: "bg-primary-50", text: "text-primary-700" },
  LOGOUT: { bg: "bg-slate-100", text: "text-slate-600" },
};

const ALL_ACTIONS: ActionType[] = ["CREATE", "UPDATE", "DELETE", "VIEW", "LOGIN", "LOGOUT"];
const ALL_RESOURCES: ResourceType[] = ["patient", "appointment", "consultation", "prescription", "billing"];

// ─── Mock data generator ────────────────────────────────────────────────────

const MOCK_USERS = [
  "Dr. Mehta", "Dr. Shah", "Dr. Priya", "Nurse Kavita", "Admin Ravi", "Receptionist Neha",
];

const DETAIL_TEMPLATES: Record<ActionType, Record<ResourceType, string[]>> = {
  CREATE: {
    patient:       ["Registered new patient Ramesh K.", "Registered new patient Sunita D.", "Added patient Arjun M. via walk-in"],
    appointment:   ["Scheduled appointment for 10:30 AM", "Created follow-up appointment", "Booked teleconsult slot"],
    consultation:  ["Started new consultation #C-4521", "Initiated teleconsult session", "Opened walk-in consultation"],
    prescription:  ["Generated e-prescription with 3 medications", "Created prescription for antibiotics course", "Issued prescription with lab orders"],
    billing:       ["Created invoice INV-2026-0892 for Rs.1500", "Generated bill for consultation + labs", "Created invoice INV-2026-0893 for Rs.800"],
  },
  UPDATE: {
    patient:       ["Updated contact details for patient ID P-1122", "Modified allergy information", "Updated insurance details"],
    appointment:   ["Rescheduled appointment to 3:00 PM", "Changed appointment status to confirmed", "Updated appointment notes"],
    consultation:  ["Added diagnosis: Type 2 Diabetes Mellitus", "Updated vitals: BP 130/85", "Attached lab results to consultation"],
    prescription:  ["Modified dosage for Metformin 500mg", "Added medication to existing prescription", "Changed prescription frequency"],
    billing:       ["Marked invoice INV-2026-0891 as paid (UPI)", "Applied discount of Rs.200", "Updated payment method to card"],
  },
  DELETE: {
    patient:       ["Archived inactive patient record P-0987", "Removed duplicate patient entry", "Deactivated patient account"],
    appointment:   ["Cancelled appointment due to no-show", "Removed duplicate booking", "Cancelled appointment per patient request"],
    consultation:  ["Voided draft consultation #C-4519", "Cancelled incomplete consultation", "Removed test consultation entry"],
    prescription:  ["Cancelled prescription before dispensing", "Voided duplicate prescription", "Revoked prescription per doctor order"],
    billing:       ["Cancelled invoice INV-2026-0890", "Issued refund for Rs.500", "Voided duplicate billing entry"],
  },
  VIEW: {
    patient:       ["Viewed patient record for Anita S.", "Accessed patient history for Vikram R.", "Opened patient demographics"],
    appointment:   ["Viewed today's appointment schedule", "Checked appointment queue", "Reviewed weekly calendar"],
    consultation:  ["Reviewed consultation notes #C-4520", "Opened past consultation history", "Viewed consultation summary"],
    prescription:  ["Viewed prescription history for patient P-1100", "Checked prescription details", "Reviewed medication list"],
    billing:       ["Viewed invoice INV-2026-0889", "Checked revenue dashboard", "Reviewed payment history"],
  },
  LOGIN: {
    patient:       ["Patient portal login successful", "Patient accessed health records", "Patient portal session started"],
    appointment:   ["Logged in to manage appointments", "Session started from appointments page", "Access via appointment link"],
    consultation:  ["Logged in for teleconsult session", "Authenticated for video consultation", "Session started for consultation"],
    prescription:  ["Logged in to view prescriptions", "Authenticated for e-prescription access", "Session started for Rx module"],
    billing:       ["Logged in to billing dashboard", "Authenticated for payment processing", "Session started for invoicing"],
  },
  LOGOUT: {
    patient:       ["Session ended after 45 minutes", "User logged out manually", "Session expired due to inactivity"],
    appointment:   ["Session ended from appointment view", "Logged out after scheduling", "Session timeout"],
    consultation:  ["Session ended post-consultation", "Logged out after completing notes", "Session expired"],
    prescription:  ["Session ended from pharmacy module", "Logged out after dispensing", "Session timeout"],
    billing:       ["Session ended from billing module", "Logged out after payment reconciliation", "Session expired"],
  },
};

const MOCK_IPS = [
  "192.168.1.10", "192.168.1.22", "10.0.0.5", "172.16.0.101",
  "192.168.1.45", "10.0.0.12", "203.0.113.42", "198.51.100.7",
];

function generateMockAuditEntries(count: number): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const action = ALL_ACTIONS[Math.floor(Math.random() * ALL_ACTIONS.length)]!;
    const resource = ALL_RESOURCES[Math.floor(Math.random() * ALL_RESOURCES.length)]!;
    const templates = DETAIL_TEMPLATES[action][resource];
    const detail = templates[Math.floor(Math.random() * templates.length)]!;
    const hoursAgo = Math.random() * 720; // up to 30 days

    entries.push({
      id: `audit-${i.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(now - hoursAgo * 3600 * 1000).toISOString(),
      user: MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)]!,
      action,
      resource,
      details: detail,
      ip: MOCK_IPS[Math.floor(Math.random() * MOCK_IPS.length)]!,
    });
  }

  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ─── Component ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const { token } = useAuth();

  const [allEntries] = useState<AuditEntry[]>(() => generateMockAuditEntries(200));
  const [actionFilter, setActionFilter] = useState<ActionType | "">("");
  const [resourceFilter, setResourceFilter] = useState<ResourceType | "">("");
  const [userFilter, setUserFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [actionFilter, resourceFilter, userFilter, searchText, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    return allEntries.filter((entry) => {
      if (actionFilter && entry.action !== actionFilter) return false;
      if (resourceFilter && entry.resource !== resourceFilter) return false;
      if (userFilter && !entry.user.toLowerCase().includes(userFilter.toLowerCase())) return false;
      if (searchText && !entry.details.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (dateFrom && entry.timestamp < `${dateFrom}T00:00:00`) return false;
      if (dateTo && entry.timestamp > `${dateTo}T23:59:59`) return false;
      return true;
    });
  }, [allEntries, actionFilter, resourceFilter, userFilter, searchText, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportToCsv() {
    const headers = ["Timestamp", "User", "Action", "Resource", "Details", "IP"];
    const rows = filtered.map((e) => [
      new Date(e.timestamp).toLocaleString("en-IN"),
      e.user,
      e.action,
      e.resource,
      `"${e.details.replace(/"/g, '""')}"`,
      e.ip,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track all system activity and user actions
          </p>
        </div>
        <button
          onClick={exportToCsv}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="cliniq-card-elevated p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Action filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as ActionType | "")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Actions</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Resource filter */}
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value as ResourceType | "")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Resources</option>
            {ALL_RESOURCES.map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>

          {/* User filter */}
          <input
            type="text"
            placeholder="Filter by user..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />

          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />

          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />

          {/* Search */}
          <input
            type="text"
            placeholder="Search details..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Active filter summary */}
        {(actionFilter || resourceFilter || userFilter || searchText || dateFrom || dateTo) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">Filters:</span>
            {actionFilter && (
              <span className="cliniq-badge bg-primary-50 text-primary-700 text-xs">
                Action: {actionFilter}
                <button onClick={() => setActionFilter("")} className="ml-1 hover:text-primary-900">&times;</button>
              </span>
            )}
            {resourceFilter && (
              <span className="cliniq-badge bg-primary-50 text-primary-700 text-xs">
                Resource: {resourceFilter}
                <button onClick={() => setResourceFilter("")} className="ml-1 hover:text-primary-900">&times;</button>
              </span>
            )}
            {userFilter && (
              <span className="cliniq-badge bg-primary-50 text-primary-700 text-xs">
                User: {userFilter}
                <button onClick={() => setUserFilter("")} className="ml-1 hover:text-primary-900">&times;</button>
              </span>
            )}
            {searchText && (
              <span className="cliniq-badge bg-primary-50 text-primary-700 text-xs">
                Search: &quot;{searchText}&quot;
                <button onClick={() => setSearchText("")} className="ml-1 hover:text-primary-900">&times;</button>
              </span>
            )}
            {dateFrom && (
              <span className="cliniq-badge bg-primary-50 text-primary-700 text-xs">
                From: {dateFrom}
                <button onClick={() => setDateFrom("")} className="ml-1 hover:text-primary-900">&times;</button>
              </span>
            )}
            {dateTo && (
              <span className="cliniq-badge bg-primary-50 text-primary-700 text-xs">
                To: {dateTo}
                <button onClick={() => setDateTo("")} className="ml-1 hover:text-primary-900">&times;</button>
              </span>
            )}
            <button
              onClick={() => {
                setActionFilter("");
                setResourceFilter("");
                setUserFilter("");
                setSearchText("");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs text-red-600 hover:text-red-800 ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-slate-500">
        Showing {pageEntries.length} of {filtered.length} entries
      </div>

      {/* Table */}
      <div className="cliniq-card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr className="bg-primary-900 text-white">
                {["Timestamp", "User", "Action", "Resource", "Details", "IP"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pageEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                    No audit entries match the current filters.
                  </td>
                </tr>
              ) : (
                pageEntries.map((entry) => {
                  const cfg = ACTION_CONFIG[entry.action];
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        <span className="text-slate-400 font-mono text-xs">
                          {new Date(entry.timestamp).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {entry.user}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`cliniq-badge ${cfg.bg} ${cfg.text} text-xs font-semibold`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 capitalize">
                        {entry.resource}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate" title={entry.details}>
                        {entry.details}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 font-mono text-xs">
                        {entry.ip}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          <span>
            {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"} total
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded px-2 py-1 disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              Prev
            </button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`rounded px-2 py-1 min-w-[28px] transition-colors ${
                    page === pageNum
                      ? "bg-primary-600 text-white font-medium"
                      : "hover:bg-slate-100"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded px-2 py-1 disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
