"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { appointments, type Appointment } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-gray-100 text-gray-600",
};

const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-yellow-400",
  confirmed: "bg-blue-400",
  in_progress: "bg-purple-400",
  completed: "bg-green-400",
  cancelled: "bg-red-300",
  no_show: "bg-gray-300",
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function AppointmentsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState<"list" | "calendar">("list");

  // List view state
  const [date, setDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState("");
  const [listData, setListData] = useState<{ data: Appointment[]; meta: { total: number } } | null>(null);
  const [listLoading, setListLoading] = useState(false);

  // Calendar view state
  const now = new Date();
  const [calMonth, setCalMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [calData, setCalData] = useState<Appointment[]>([]);
  const [calLoading, setCalLoading] = useState(false);

  // List fetch
  useEffect(() => {
    if (view !== "list") return;
    setListLoading(true);
    appointments
      .list({ date, ...(statusFilter ? { status: statusFilter } : {}) })
      .then((r) => setListData(r as { data: Appointment[]; meta: { total: number } }))
      .catch(() => null)
      .finally(() => setListLoading(false));
  }, [date, statusFilter, view]);

  // Calendar fetch
  useEffect(() => {
    if (view !== "calendar") return;
    setCalLoading(true);
    const from = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
    const to = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    appointments
      .list({ from, to, limit: 200 })
      .then((r) => setCalData((r as { data: Appointment[] }).data))
      .catch(() => null)
      .finally(() => setCalLoading(false));
  }, [view, calMonth]);

  // Group calendar appointments by date string
  const apptByDate: Record<string, Appointment[]> = {};
  for (const a of calData) {
    const d = new Date(a.scheduledAt).toISOString().slice(0, 10);
    if (!apptByDate[d]) apptByDate[d] = [];
    apptByDate[d].push(a);
  }

  // Build month grid (Mon-first, null = empty cell)
  function buildGrid(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  const grid = buildGrid(calMonth.year, calMonth.month);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-sm">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              ☰ List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-1.5 ${view === "calendar" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              📅 Calendar
            </button>
          </div>
          <Link
            href="/dashboard/appointments/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Book Appointment
          </Link>
        </div>
      </div>

      {/* ── List view ── */}
      {view === "list" && (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {listLoading ? (
            <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
          ) : !listData?.data.length ? (
            <div className="py-20 text-center text-sm text-gray-400">No appointments for this date.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["Time", "Patient", "Type", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {listData.data.map((appt) => (
                    <tr key={appt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(appt.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <Link href={`/dashboard/patients/${appt.patientId}`} className="hover:text-blue-600 hover:underline font-medium">
                          {appt.patient?.name || appt.patient?.phone || `${appt.patientId.slice(0, 8)}…`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{appt.type.replace("_", " ")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[appt.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {appt.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/appointments/${appt.id}`} className="text-xs text-blue-600 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
                {listData.meta.total} appointment{listData.meta.total !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Calendar view ── */}
      {view === "calendar" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Month navigation */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <button
              onClick={() => setCalMonth((m) => { const d = new Date(m.year, m.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ← Prev
            </button>
            <h2 className="text-base font-semibold text-gray-800">
              {MONTH_NAMES[calMonth.month]} {calMonth.year}
            </h2>
            <button
              onClick={() => setCalMonth((m) => { const d = new Date(m.year, m.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Next →
            </button>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          {calLoading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
              {grid.map((day, i) => {
                const dateStr = day
                  ? `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  : null;
                const dayAppts = dateStr ? (apptByDate[dateStr] ?? []) : [];
                const isToday = dateStr === today;

                return (
                  <div key={i} className={`min-h-[100px] p-2 ${!day ? "bg-gray-50" : "bg-white"}`}>
                    {day && (
                      <>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-blue-600 text-white" : "text-gray-700"}`}>
                            {day}
                          </span>
                          {dayAppts.length > 0 && (
                            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                              {dayAppts.length}
                            </span>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {dayAppts.slice(0, 3).map((a) => (
                            <Link
                              key={a.id}
                              href={`/dashboard/appointments/${a.id}`}
                              className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-xs hover:bg-blue-50"
                            >
                              <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_DOT[a.status] ?? "bg-gray-300"}`} />
                              <span className="truncate text-gray-600">
                                {new Date(a.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </Link>
                          ))}
                          {dayAppts.length > 3 && (
                            <button
                              onClick={() => { setDate(dateStr!); setView("list"); }}
                              className="pl-1 text-xs text-blue-600 hover:underline"
                            >
                              +{dayAppts.length - 3} more
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 border-t border-gray-100 px-5 py-3">
            {(["scheduled", "confirmed", "completed", "cancelled"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
                <span className="capitalize">{s}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
