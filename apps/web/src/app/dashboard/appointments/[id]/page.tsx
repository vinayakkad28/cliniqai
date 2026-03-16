"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { appointments, consultations } from "@/lib/api";

interface AppointmentDetail {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  status: string;
  type: string;
  notes: string | null;
  patient: { id: string; phone: string; fhirPatientId: string };
  consultation: { id: string; status: string; startedAt: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-gray-100 text-gray-600",
};

export default function AppointmentDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [appt, setAppt] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingConsult, setStartingConsult] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    appointments.get(id)
      .then(setAppt)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStartConsultation() {
    if (!appt) return;
    setStartingConsult(true);
    try {
      const result = await consultations.start(appt.id) as { id: string };
      router.push(`/dashboard/consultations/${result.id}`);
    } catch (e: unknown) {
      const msg = (e as { data?: { error?: string } }).data?.error ?? "Failed to start consultation";
      alert(msg);
    } finally {
      setStartingConsult(false);
    }
  }

  async function handleCancel() {
    if (!appt || !confirm("Cancel this appointment?")) return;
    setCancelling(true);
    try {
      await appointments.update(appt.id, { status: "cancelled" });
      setAppt({ ...appt, status: "cancelled" });
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">Loading…</div>;
  if (!appt) return <div className="py-20 text-center text-sm text-red-500">Appointment not found.</div>;

  const canAct = appt.status === "scheduled" || appt.status === "confirmed";

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Appointment</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[appt.status] ?? "bg-gray-100 text-gray-600"}`}>
          {appt.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <Row label="Date & Time">
          {new Date(appt.scheduledAt).toLocaleString("en-IN", {
            dateStyle: "long", timeStyle: "short",
          })}
        </Row>
        <Row label="Patient">
          <Link href={`/dashboard/patients/${appt.patientId}`} className="text-blue-600 hover:underline font-mono">
            {appt.patient.phone}
          </Link>
        </Row>
        <Row label="Type">{appt.type.replace(/_/g, " ")}</Row>
        {appt.notes && <Row label="Notes">{appt.notes}</Row>}

        {appt.consultation && (
          <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-800">Consultation exists</p>
              <p className="text-xs text-purple-600 mt-0.5">
                Started {new Date(appt.consultation.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                {" · "}{appt.consultation.status.replace("_", " ")}
              </p>
            </div>
            <Link
              href={`/dashboard/consultations/${appt.consultation.id}`}
              className="text-sm font-semibold text-purple-700 hover:underline"
            >
              Open →
            </Link>
          </div>
        )}
      </div>

      {canAct && !appt.consultation && (
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleStartConsultation}
            disabled={startingConsult}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {startingConsult ? "Starting…" : "Start Consultation"}
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="rounded-lg bg-white border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {cancelling ? "Cancelling…" : "Cancel Appointment"}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="w-28 shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{children}</span>
    </div>
  );
}
