"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { appointments, patients, type Patient } from "@/lib/api";

function NewAppointmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetPatientId = searchParams.get("patientId");

  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [type, setType] = useState("scheduled");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Pre-load patient if patientId is in URL
  useEffect(() => {
    if (!presetPatientId) return;
    patients.get(presetPatientId).then((p) => setSelectedPatient(p)).catch(() => null);
  }, [presetPatientId]);

  // Debounced patient search
  useEffect(() => {
    if (!patientSearch.trim() || patientSearch.length < 3) {
      setPatientResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      patients
        .list({ search: patientSearch, limit: 5 })
        .then((r) => setPatientResults(r.data))
        .catch(() => null)
        .finally(() => setSearchLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient) {
      setError("Please select a patient.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const appt = await appointments.create({ patientId: selectedPatient.id, scheduledAt, type, notes: notes || undefined });
      router.push(`/dashboard/appointments/${appt.id}`);
    } catch (e: unknown) {
      setError((e as { data?: { error?: string } }).data?.error ?? "Failed to book appointment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Book Appointment</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        {/* Patient picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          {selectedPatient ? (
            <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedPatient.phone}</p>
                <p className="text-xs text-gray-500">{selectedPatient.id.slice(0, 8)}…</p>
              </div>
              <button type="button" onClick={() => setSelectedPatient(null)} className="text-xs text-red-500 hover:underline">Change</button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search by phone number…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              {searchLoading && (
                <p className="mt-1 text-xs text-gray-400">Searching…</p>
              )}
              {patientResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPatient(p); setPatientSearch(""); setPatientResults([]); }}
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      <span className="font-medium">{p.phone}</span>
                      <span className="ml-2 text-xs text-gray-400">{p.id.slice(0, 8)}…</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="scheduled">Scheduled</option>
            <option value="walk_in">Walk-in</option>
            <option value="follow_up">Follow-up</option>
            <option value="teleconsult">Teleconsult</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for visit, special instructions…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !selectedPatient}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Booking…" : "Book Appointment"}
        </button>
      </form>
    </div>
  );
}

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-gray-400">Loading…</div>}>
      <NewAppointmentForm />
    </Suspense>
  );
}
