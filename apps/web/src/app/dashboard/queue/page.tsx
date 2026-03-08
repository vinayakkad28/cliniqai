"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";

interface QueueEntry {
  tokenNo: number;
  patientName: string;
  doctorName: string;
  status: "waiting" | "in-progress" | "called" | "completed";
  estimatedTime?: string;
  appointmentType: string;
}

const MOCK_QUEUE: QueueEntry[] = [
  { tokenNo: 5, patientName: "Kavita R.", doctorName: "Dr. Mehta", status: "completed", appointmentType: "Follow-up" },
  { tokenNo: 6, patientName: "Suresh K.", doctorName: "Dr. Mehta", status: "completed", appointmentType: "Consultation" },
  { tokenNo: 7, patientName: "Deepa I.", doctorName: "Dr. Mehta", status: "completed", appointmentType: "Lab Review" },
  { tokenNo: 8, patientName: "Priya S.", doctorName: "Dr. Mehta", status: "in-progress", appointmentType: "Follow-up" },
  { tokenNo: 9, patientName: "Rahul V.", doctorName: "Dr. Mehta", status: "called", estimatedTime: "Next", appointmentType: "New Visit" },
  { tokenNo: 10, patientName: "Anita D.", doctorName: "Dr. Shah", status: "waiting", estimatedTime: "~15 min", appointmentType: "Lab Review" },
  { tokenNo: 11, patientName: "Vikram S.", doctorName: "Dr. Mehta", status: "waiting", estimatedTime: "~25 min", appointmentType: "Consultation" },
  { tokenNo: 12, patientName: "Meena P.", doctorName: "Dr. Shah", status: "waiting", estimatedTime: "~35 min", appointmentType: "Follow-up" },
  { tokenNo: 13, patientName: "Arjun N.", doctorName: "Dr. Mehta", status: "waiting", estimatedTime: "~45 min", appointmentType: "New Visit" },
];

const STATUS_CONFIG: Record<QueueEntry["status"], { bg: string; text: string; label: string }> = {
  "in-progress": { bg: "bg-blue-100", text: "text-blue-700", label: "In Progress" },
  called: { bg: "bg-green-100", text: "text-green-700", label: "Called" },
  waiting: { bg: "bg-gray-100", text: "text-gray-600", label: "Waiting" },
  completed: { bg: "bg-gray-50", text: "text-gray-400", label: "Done" },
};

function CurrentToken({ entry }: { entry: QueueEntry }) {
  return (
    <div className="bg-blue-600 text-white rounded-2xl p-8 text-center">
      <p className="text-sm uppercase tracking-wide opacity-80 mb-1">Now Serving</p>
      <p className="text-8xl font-bold my-4">{entry.tokenNo}</p>
      <p className="text-2xl font-semibold">{entry.patientName}</p>
      <p className="text-lg opacity-80 mt-1">{entry.doctorName} &middot; {entry.appointmentType}</p>
    </div>
  );
}

function NextToken({ entry }: { entry: QueueEntry }) {
  return (
    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
      <p className="text-xs uppercase tracking-wide text-green-600 font-medium mb-1">Next</p>
      <p className="text-5xl font-bold text-green-700 my-2">{entry.tokenNo}</p>
      <p className="text-lg font-semibold text-gray-800">{entry.patientName}</p>
      <p className="text-sm text-gray-500">{entry.doctorName}</p>
    </div>
  );
}

export default function QueueDisplayPage() {
  const { token } = useAuth();
  const [queue, setQueue] = useState(MOCK_QUEUE);
  const [clock, setClock] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Update clock every second
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // SSE for real-time queue updates
  useEffect(() => {
    if (!token) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const es = new EventSource(`${apiBase}/api/events?token=${token}`);

    es.addEventListener("queue:update", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.queue) setQueue(data.queue);
      } catch {
        // ignore parse errors
      }
    });

    return () => es.close();
  }, [token]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const current = queue.find((q) => q.status === "in-progress");
  const next = queue.find((q) => q.status === "called");
  const waiting = queue.filter((q) => q.status === "waiting");
  const completed = queue.filter((q) => q.status === "completed");

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clinic Queue</h1>
          <p className="text-gray-500 mt-1">
            {clock.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" "}&middot;{" "}
            {clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        <button
          onClick={toggleFullscreen}
          className="px-4 py-2 bg-white border rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen (TV Mode)"}
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Now Serving + Next */}
        <div className="col-span-1 space-y-6">
          {current && <CurrentToken entry={current} />}
          {next && <NextToken entry={next} />}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-3xl font-bold text-gray-900">{waiting.length}</p>
              <p className="text-xs text-gray-500 mt-1">Waiting</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <p className="text-3xl font-bold text-gray-900">{completed.length}</p>
              <p className="text-xs text-gray-500 mt-1">Completed</p>
            </div>
          </div>
        </div>

        {/* Right: Queue List */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gray-800 text-white px-6 py-3 grid grid-cols-5 text-sm font-medium">
              <span>Token</span>
              <span>Patient</span>
              <span>Doctor</span>
              <span>Type</span>
              <span className="text-right">Est. Wait</span>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Current + Called first, then waiting */}
              {[...(current ? [current] : []), ...(next ? [next] : []), ...waiting].map((entry) => {
                const cfg = STATUS_CONFIG[entry.status];
                return (
                  <div
                    key={entry.tokenNo}
                    className={`px-6 py-4 grid grid-cols-5 items-center text-sm ${
                      entry.status === "in-progress" ? "bg-blue-50" : entry.status === "called" ? "bg-green-50" : ""
                    }`}
                  >
                    <span className="text-2xl font-bold text-gray-900">{entry.tokenNo}</span>
                    <span className="font-medium text-gray-800">{entry.patientName}</span>
                    <span className="text-gray-600">{entry.doctorName}</span>
                    <span className="text-gray-600">{entry.appointmentType}</span>
                    <span className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                        {entry.status === "in-progress" || entry.status === "called"
                          ? cfg.label
                          : entry.estimatedTime ?? "—"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Completed (collapsed) */}
          {completed.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                {completed.length} completed today
              </summary>
              <div className="mt-2 bg-white rounded-xl shadow-sm overflow-hidden opacity-60">
                {completed.map((entry) => (
                  <div key={entry.tokenNo} className="px-6 py-3 grid grid-cols-5 items-center text-sm border-b border-gray-50">
                    <span className="font-bold text-gray-400">{entry.tokenNo}</span>
                    <span className="text-gray-400">{entry.patientName}</span>
                    <span className="text-gray-400">{entry.doctorName}</span>
                    <span className="text-gray-400">{entry.appointmentType}</span>
                    <span className="text-right text-gray-400 text-xs">Done</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
