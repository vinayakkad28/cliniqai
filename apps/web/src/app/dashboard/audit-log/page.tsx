"use client";

import { useState, useEffect, useCallback } from "react";
import { auditLog, API_BASE as BASE, type AuditEntry } from "@/lib/api";

// ─── Action badge config ────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { bg: string; text: string }> = {
  CREATE: { bg: "bg-green-100", text: "text-green-700" },
  VIEW:   { bg: "bg-blue-100", text: "text-blue-700" },
  UPDATE: { bg: "bg-yellow-100", text: "text-yellow-700" },
  DELETE: { bg: "bg-red-100", text: "text-red-700" },
  LOGIN:  { bg: "bg-primary-50", text: "text-primary-700" },
  LOGOUT: { bg: "bg-slate-100", text: "text-slate-600" },
};

const ALL_ACTIONS = ["CREATE", "UPDATE", "DELETE", "VIEW", "LOGIN", "LOGOUT"];
const ALL_RESOURCES = ["patient", "appointment", "consultation", "prescription", "billing"];

// ─── Component ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ total: number; pages: number }>({ total: 0, pages: 1 });
  const [exporting, setExporting] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [actionFilter, resourceFilter, searchText, dateFrom, dateTo]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource = resourceFilter;
      if (searchText) params.search = searchText;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const result = await auditLog.list(params as Parameters<typeof auditLog.list>[0]);
      setEntries(result.data);
      setMeta({ total: result.meta.total, pages: result.meta.pages });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceFilter, searchText, dateFrom, dateTo]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const totalPages = meta.pages;

  async function handleExportCsv() {
    setExporting(true);
    try {
      const token = localStorage.getItem("cliniqai_access_token") ?? "";
      const exportPath = auditLog.exportUrl({
        ...(dateFrom ? { from: dateFrom } : {}),
        ...(dateTo ? { to: dateTo } : {}),
        ...(actionFilter ? { action: actionFilter } : {}),
      });
      const res = await fetch(`${BASE}${exportPath}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
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
          onClick={handleExportCsv}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {/* Filters */}
      <div className="cliniq-card-elevated p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Action filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
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
            onChange={(e) => setResourceFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All Resources</option>
            {ALL_RESOURCES.map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>

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
        {(actionFilter || resourceFilter || searchText || dateFrom || dateTo) && (
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
        Showing {entries.length} of {meta.total} entries
      </div>

      {/* Table */}
      <div className="cliniq-card-elevated overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading...</div>
        ) : (
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
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-400">
                      No audit entries match the current filters.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const cfg = ACTION_CONFIG[entry.action] ?? { bg: "bg-slate-100", text: "text-slate-600" };
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
                          {entry.userName || entry.userId}
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
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          <span>
            {meta.total} entr{meta.total !== 1 ? "ies" : "y"} total
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
