"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { followups, type FollowUp } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

type FollowupStatus = "pending" | "sent" | "acknowledged" | "cancelled";
type Channel = "sms" | "whatsapp" | "email";
type TabKey = "due_today" | "this_week" | "all" | "overdue";
type ViewMode = "list" | "calendar";

// ─── Config ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FollowupStatus, { bg: string; text: string; label: string }> = {
  pending:      { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending" },
  sent:         { bg: "bg-blue-100", text: "text-blue-700", label: "Sent" },
  acknowledged: { bg: "bg-green-100", text: "text-green-700", label: "Acknowledged" },
  cancelled:    { bg: "bg-slate-100", text: "text-slate-500", label: "Cancelled" },
};

const CHANNEL_CONFIG: Record<Channel, { icon: string; label: string }> = {
  sms:      { icon: "SMS", label: "SMS" },
  whatsapp: { icon: "WA", label: "WhatsApp" },
  email:    { icon: "@", label: "Email" },
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "due_today", label: "Due Today" },
  { key: "this_week", label: "This Week" },
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FollowupsPage() {
  const [allFollowups, setAllFollowups] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("due_today");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ total: number; pages: number }>({ total: 0, pages: 1 });

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    try {
      const result = await followups.list({ page, limit: 100 });
      setAllFollowups(result.data);
      setMeta({ total: result.meta.total, pages: result.meta.pages });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  const tabFiltered = useMemo(() => {
    switch (activeTab) {
      case "due_today":
        return allFollowups.filter(
          (f) => f.status === "pending" && new Date(f.scheduledDate) >= todayStart && new Date(f.scheduledDate) <= todayEnd
        );
      case "this_week":
        return allFollowups.filter(
          (f) => f.status === "pending" && new Date(f.scheduledDate) >= todayStart && new Date(f.scheduledDate) < weekEnd
        );
      case "overdue":
        return allFollowups.filter(
          (f) => f.status === "pending" && new Date(f.scheduledDate) < todayStart
        );
      case "all":
      default:
        return allFollowups;
    }
  }, [allFollowups, activeTab]);

  // Tab counts
  const counts = useMemo(() => ({
    due_today: allFollowups.filter((f) => f.status === "pending" && new Date(f.scheduledDate) >= todayStart && new Date(f.scheduledDate) <= todayEnd).length,
    this_week: allFollowups.filter((f) => f.status === "pending" && new Date(f.scheduledDate) >= todayStart && new Date(f.scheduledDate) < weekEnd).length,
    all: allFollowups.length,
    overdue: allFollowups.filter((f) => f.status === "pending" && new Date(f.scheduledDate) < todayStart).length,
  }), [allFollowups]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === tabFiltered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tabFiltered.map((f) => f.id)));
    }
  }

  async function handleMarkSent(id: string) {
    setUpdatingIds((prev) => new Set(prev).add(id));
    try {
      await followups.update(id, { status: "sent" });
      setAllFollowups((prev) => prev.map((f) => (f.id === id ? { ...f, status: "sent" as const } : f)));
    } catch {
      // silently fail
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleSendAllDue() {
    setSendingAll(true);
    const dueToday = allFollowups.filter(
      (f) => f.status === "pending" && new Date(f.scheduledDate) >= todayStart && new Date(f.scheduledDate) <= todayEnd
    );
    try {
      await Promise.all(dueToday.map((f) => followups.update(f.id, { status: "sent" })));
      setAllFollowups((prev) =>
        prev.map((f) => {
          if (f.status === "pending" && new Date(f.scheduledDate) >= todayStart && new Date(f.scheduledDate) <= todayEnd) {
            return { ...f, status: "sent" as const };
          }
          return f;
        })
      );
      setSelectedIds(new Set());
    } catch {
      // silently fail
    } finally {
      setSendingAll(false);
    }
  }

  async function handleCancelSelected() {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => followups.update(id, { status: "cancelled" })));
      setAllFollowups((prev) =>
        prev.map((f) => (selectedIds.has(f.id) ? { ...f, status: "cancelled" as const } : f))
      );
    } catch {
      // silently fail
    }
    setSelectedIds(new Set());
  }

  // ─── Calendar view data ─────────────────────────────────────────────────

  const calendarData = useMemo(() => {
    const calStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const calEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startDay = calStart.getDay(); // 0 = Sunday
    const daysInMonth = calEnd.getDate();

    const dayCounts: { date: Date; count: number; isToday: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(now.getFullYear(), now.getMonth(), d);
      const count = allFollowups.filter(
        (f) => f.status === "pending" && isSameDay(new Date(f.scheduledDate), date)
      ).length;
      dayCounts.push({ date, count, isToday: isSameDay(date, now) });
    }

    return { startDay, dayCounts, monthLabel: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
  }, [allFollowups]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Follow-ups</h1>
          <p className="text-sm text-slate-500 mt-1">Manage patient follow-up reminders</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "list" ? "bg-white text-primary-700 shadow-xs" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "calendar" ? "bg-white text-primary-700 shadow-xs" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="cliniq-card-elevated p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">{counts.due_today}</p>
          <p className="text-xs text-slate-500 mt-1">Due Today</p>
        </div>
        <div className="cliniq-card-elevated p-4 text-center">
          <p className="text-3xl font-bold text-primary-600">{counts.this_week}</p>
          <p className="text-xs text-slate-500 mt-1">This Week</p>
        </div>
        <div className="cliniq-card-elevated p-4 text-center">
          <p className="text-3xl font-bold text-red-600">{counts.overdue}</p>
          <p className="text-xs text-slate-500 mt-1">Overdue</p>
        </div>
        <div className="cliniq-card-elevated p-4 text-center">
          <p className="text-3xl font-bold text-slate-700">{counts.all}</p>
          <p className="text-xs text-slate-500 mt-1">Total</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()); }}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${
              activeTab === tab.key ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-500"
            }`}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {(activeTab === "due_today" || selectedIds.size > 0) && (
        <div className="flex items-center gap-3">
          {activeTab === "due_today" && counts.due_today > 0 && (
            <button
              onClick={handleSendAllDue}
              disabled={sendingAll}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {sendingAll ? "Sending..." : `Send All Due (${counts.due_today})`}
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={handleCancelSelected}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Cancel Selected ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="cliniq-card-elevated p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">{calendarData.monthLabel}</h3>
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-2">
                {d}
              </div>
            ))}
            {/* Empty cells before first day */}
            {Array.from({ length: calendarData.startDay }, (_, i) => (
              <div key={`empty-${i}`} className="h-16" />
            ))}
            {/* Day cells */}
            {calendarData.dayCounts.map(({ date, count, isToday }) => (
              <div
                key={date.getDate()}
                className={`h-16 rounded-lg border p-1.5 transition-colors ${
                  isToday
                    ? "border-primary-300 bg-primary-50"
                    : count > 0
                    ? "border-slate-200 bg-white hover:border-primary-200"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <div className={`text-xs font-medium ${isToday ? "text-primary-700" : "text-slate-600"}`}>
                  {date.getDate()}
                </div>
                {count > 0 && (
                  <div className={`mt-1 text-center rounded text-xs font-bold py-0.5 ${
                    count >= 3
                      ? "bg-red-100 text-red-700"
                      : count >= 2
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-primary-100 text-primary-700"
                  }`}>
                    {count}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="cliniq-card-elevated overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-primary-900 text-white">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={tabFiltered.length > 0 && selectedIds.size === tabFiltered.length}
                        onChange={toggleSelectAll}
                        className="rounded border-white/30"
                      />
                    </th>
                    {["Patient", "Reason", "Scheduled Date", "Channel", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tabFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-400">
                        No follow-ups in this view.
                      </td>
                    </tr>
                  ) : (
                    tabFiltered.map((fu) => {
                      const sCfg = STATUS_CONFIG[fu.status as FollowupStatus] ?? STATUS_CONFIG.pending;
                      const cCfg = CHANNEL_CONFIG[fu.channel as Channel] ?? CHANNEL_CONFIG.sms;
                      const isOverdue = fu.status === "pending" && new Date(fu.scheduledDate) < todayStart;
                      return (
                        <tr
                          key={fu.id}
                          className={`hover:bg-slate-50 transition-colors ${isOverdue ? "bg-red-50/50" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(fu.id)}
                              onChange={() => toggleSelect(fu.id)}
                              className="rounded border-slate-300"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-800">{fu.patientName || "Unknown"}</div>
                            <div className="text-xs text-slate-400">{fu.patientPhone || ""}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate" title={fu.reason}>
                            {fu.reason}
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <span className={isOverdue ? "text-red-600 font-medium" : "text-slate-600"}>
                              {new Date(fu.scheduledDate).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            {isOverdue && (
                              <span className="ml-1.5 text-xs text-red-500 font-medium">Overdue</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="cliniq-badge bg-slate-100 text-slate-600 text-xs">
                              {cCfg.icon} {cCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`cliniq-badge ${sCfg.bg} ${sCfg.text} text-xs font-semibold`}>
                              {sCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {fu.status === "pending" && (
                              <button
                                onClick={() => handleMarkSent(fu.id)}
                                disabled={updatingIds.has(fu.id)}
                                className="text-xs text-primary-600 hover:text-primary-800 font-medium hover:underline disabled:opacity-50"
                              >
                                {updatingIds.has(fu.id) ? "Saving..." : "Mark Sent"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            <span>{tabFiltered.length} follow-up{tabFiltered.length !== 1 ? "s" : ""}</span>
            {meta.pages > 1 && (
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded px-2 py-1 disabled:opacity-40 hover:bg-slate-100"
                >
                  Prev
                </button>
                <span>Page {page} / {meta.pages}</span>
                <button
                  disabled={page >= meta.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded px-2 py-1 disabled:opacity-40 hover:bg-slate-100"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
