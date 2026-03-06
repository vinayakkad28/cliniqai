"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { patients, type Patient } from "@/lib/api";

interface TimelineItem {
  id: string;
  startedAt: string;
  endedAt?: string;
  chiefComplaint?: string;
  status: string;
  prescriptions?: { id: string; status: string }[];
  labOrders?: { id: string; tests: string[]; status: string }[];
}

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [patient, setPatient] = useState<(Patient & { fhir?: Record<string, unknown> }) | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      patients.get(id),
      patients.timeline(id),
    ])
      .then(([pt, tl]) => {
        setPatient(pt as Patient & { fhir?: Record<string, unknown> });
        const data = tl as { consultations?: TimelineItem[] } | TimelineItem[];
        setTimeline(Array.isArray(data) ? data : (data.consultations ?? []));
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-400">Loading…</div>;
  }

  if (!patient) {
    return <div className="py-20 text-center text-sm text-red-500">Patient not found.</div>;
  }

  const fhirName = extractFhirName(patient.fhir);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/patients" className="text-sm text-gray-500 hover:text-gray-900">
          ← Patients
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{fhirName ?? patient.phone}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Patient info card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Demographics</h2>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Phone" value={patient.phone} />
            <InfoRow label="FHIR ID" value={patient.fhirPatientId.slice(0, 12) + "…"} />
            {extractFhirDob(patient.fhir) && (
              <InfoRow label="Date of Birth" value={extractFhirDob(patient.fhir)!} />
            )}
            {extractFhirGender(patient.fhir) && (
              <InfoRow label="Gender" value={extractFhirGender(patient.fhir)!} />
            )}
            <InfoRow label="Registered" value={new Date(patient.createdAt).toLocaleDateString("en-IN")} />
          </dl>
          {patient.tags.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {patient.tags.map(({ tag }) => (
                  <span key={tag} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 space-y-2">
            <Link
              href={`/dashboard/appointments/new?patientId=${id}`}
              className="block w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              Book Appointment
            </Link>
            <Link
              href={`/dashboard/patients/${id}/documents`}
              className="block w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Medical Documents
            </Link>
            <Link
              href={`/dashboard/patients/${id}/intelligence`}
              className="block w-full rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-center text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              AI Clinical Intelligence
            </Link>
          </div>
        </div>

        {/* Consultation timeline */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Consultation History</h2>
          {timeline.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400">
              No consultations yet.
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(item.startedAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                      {item.chiefComplaint && (
                        <p className="mt-0.5 text-sm text-gray-600">{item.chiefComplaint}</p>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.status === "completed" ? "bg-green-100 text-green-700" :
                      item.status === "in_progress" ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {item.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-3 flex-wrap">
                    {(item.prescriptions?.length ?? 0) > 0 && (
                      <span className="text-xs text-gray-500">
                        💊 {item.prescriptions!.length} prescription{item.prescriptions!.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {(item.labOrders?.length ?? 0) > 0 && (
                      <span className="text-xs text-gray-500">
                        🔬 {item.labOrders!.length} lab order{item.labOrders!.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    <Link
                      href={`/dashboard/consultations/${item.id}`}
                      className="ml-auto text-xs text-blue-600 hover:underline"
                    >
                      Open →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800 text-right">{value}</dd>
    </div>
  );
}

function extractFhirName(fhir?: Record<string, unknown>): string | null {
  const nameArr = (fhir?.["name"] as Array<{ given?: string[]; family?: string }> | undefined) ?? [];
  if (!nameArr.length) return null;
  const n = nameArr[0];
  if (!n) return null;
  return [n.given?.join(" "), n.family].filter(Boolean).join(" ") || null;
}

function extractFhirDob(fhir?: Record<string, unknown>): string | null {
  const dob = fhir?.["birthDate"] as string | undefined;
  if (!dob) return null;
  return new Date(dob).toLocaleDateString("en-IN");
}

function extractFhirGender(fhir?: Record<string, unknown>): string | null {
  const g = fhir?.["gender"] as string | undefined;
  if (!g) return null;
  return g.charAt(0).toUpperCase() + g.slice(1);
}
