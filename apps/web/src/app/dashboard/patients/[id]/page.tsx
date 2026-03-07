"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { patients, insights, type Patient, type MedicalHistory } from "@/lib/api";

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
  const [longitudinalSummary, setLongitudinalSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  // AI record search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ chunkText: string; score: number }> | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Medical history state
  const [editingHistory, setEditingHistory] = useState(false);
  const [historyForm, setHistoryForm] = useState<MedicalHistory>({});
  const [savingHistory, setSavingHistory] = useState(false);

  useEffect(() => {
    Promise.all([
      patients.get(id),
      patients.timeline(id),
    ])
      .then(([pt, tl]) => {
        const p = pt as Patient & { fhir?: Record<string, unknown> };
        setPatient(p);
        if (p.medicalHistory) setHistoryForm(p.medicalHistory);
        const data = tl as { consultations?: TimelineItem[] } | TimelineItem[];
        setTimeline(Array.isArray(data) ? data : (data.consultations ?? []));
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">Loading…</div>;
  if (!patient) return <div className="py-20 text-center text-sm text-red-500">Patient not found.</div>;

  const fhirName = extractFhirName(patient.fhir);
  const mh = patient.medicalHistory;
  const hasAllergies = (mh?.allergies?.length ?? 0) > 0;

  async function handleGenerateSummary() {
    setSummaryLoading(true); setSummaryError("");
    try {
      const r = await insights.longitudinal(id);
      setLongitudinalSummary(r.insight.content);
    } catch {
      setSummaryError("AI service unavailable");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 3) return;
    setSearching(true); setSearchError(""); setSearchResults(null);
    try {
      const res = await patients.search(id, searchQuery);
      setSearchResults(res.answer ?? []);
      if ((res.answer ?? []).length === 0) setSearchError("No matching records found. AI search requires the AI service to be configured.");
    } catch {
      setSearchError("AI service unavailable.");
    } finally {
      setSearching(false);
    }
  }

  async function handleSaveHistory() {
    setSavingHistory(true);
    try {
      const updated = await patients.patch(id, { medicalHistory: historyForm });
      setPatient((prev) => prev ? { ...prev, medicalHistory: updated.medicalHistory } : prev);
      setEditingHistory(false);
    } catch {
      // silent
    } finally {
      setSavingHistory(false);
    }
  }

  function arrayField(key: keyof MedicalHistory) {
    const val = historyForm[key];
    return Array.isArray(val) ? val.join(", ") : "";
  }
  function setArrayField(key: keyof MedicalHistory, raw: string) {
    setHistoryForm((f) => ({ ...f, [key]: raw.split(",").map((s) => s.trim()).filter(Boolean) }));
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/patients" className="text-sm text-gray-500 hover:text-gray-900">
          ← Patients
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {fhirName ?? patient.phone}
          {hasAllergies && (
            <span title="Has known allergies" className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">!</span>
          )}
        </h1>
      </div>

      {/* AI Longitudinal Summary Card */}
      <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-indigo-800">AI Clinical Summary</h2>
          {!longitudinalSummary ? (
            <button type="button" onClick={handleGenerateSummary} disabled={summaryLoading}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {summaryLoading ? "Generating…" : "Generate Summary"}
            </button>
          ) : (
            <button type="button" onClick={() => setLongitudinalSummary(null)} className="text-xs text-indigo-500 hover:text-indigo-700">Refresh</button>
          )}
        </div>
        {summaryError && <p className="text-xs text-red-600">{summaryError}</p>}
        {longitudinalSummary ? (
          <div>
            <p className="text-sm text-indigo-900 whitespace-pre-wrap">{longitudinalSummary}</p>
            <p className="mt-2 text-xs text-indigo-400 italic">AI-generated — verify before clinical use</p>
          </div>
        ) : !summaryError ? (
          <p className="text-sm text-indigo-600">Generate a comprehensive AI summary of this patient&apos;s health history.</p>
        ) : null}
      </div>

      {/* AI Record Search */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">AI Record Search</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ask about this patient's history… e.g. 'Any allergies?' or 'Past medications'"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching || searchQuery.length < 3}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {searching ? "…" : "Search"}
          </button>
        </form>
        {searchError && <p className="mt-2 text-xs text-gray-500">{searchError}</p>}
        {searchResults && searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((r, i) => (
              <div key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {r.chunkText}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Medical History card */}
      <div className="mb-6 rounded-xl border border-orange-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Medical History</h2>
          {!editingHistory ? (
            <button type="button" onClick={() => setEditingHistory(true)}
              className="text-xs text-blue-600 hover:underline">
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={handleSaveHistory} disabled={savingHistory}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {savingHistory ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => { setEditingHistory(false); if (patient.medicalHistory) setHistoryForm(patient.medicalHistory); }}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          )}
        </div>

        {editingHistory ? (
          <div className="space-y-3">
            {[
              { key: "allergies" as const, label: "Allergies", placeholder: "Penicillin, Sulfa drugs" },
              { key: "chronicConditions" as const, label: "Chronic Conditions", placeholder: "Type 2 Diabetes, Hypertension" },
              { key: "currentMedications" as const, label: "Current Medications", placeholder: "Metformin 500mg, Amlodipine 5mg" },
              { key: "pastSurgeries" as const, label: "Past Surgeries", placeholder: "Appendectomy 2015, Knee replacement 2021" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label} <span className="text-gray-400">(comma-separated)</span></label>
                <input
                  type="text"
                  value={arrayField(key)}
                  onChange={(e) => setArrayField(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Family History</label>
              <textarea
                rows={2}
                value={historyForm.familyHistory ?? ""}
                onChange={(e) => setHistoryForm((f) => ({ ...f, familyHistory: e.target.value }))}
                placeholder="Father: heart disease, Mother: diabetes…"
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        ) : mh && (mh.allergies?.length || mh.chronicConditions?.length || mh.currentMedications?.length || mh.pastSurgeries?.length || mh.familyHistory) ? (
          <div className="space-y-3 text-sm">
            {mh.allergies && mh.allergies.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Allergies</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {mh.allergies.map((a) => (
                    <span key={a} className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {mh.chronicConditions && mh.chronicConditions.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Chronic Conditions</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {mh.chronicConditions.map((c) => (
                    <span key={c} className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {mh.currentMedications && mh.currentMedications.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Medications</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {mh.currentMedications.map((m) => (
                    <span key={m} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{m}</span>
                  ))}
                </div>
              </div>
            )}
            {mh.pastSurgeries && mh.pastSurgeries.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Past Surgeries</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {mh.pastSurgeries.map((s) => (
                    <span key={s} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {mh.familyHistory && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Family History</span>
                <p className="mt-1 text-sm text-gray-700">{mh.familyHistory}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No medical history recorded. Click <button type="button" onClick={() => setEditingHistory(true)} className="text-blue-600 hover:underline">Edit</button> to add allergies, conditions, and medications.</p>
        )}
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
                  <span key={tag} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700">{tag}</span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 space-y-2">
            <Link href={`/dashboard/appointments/new?patientId=${id}`}
              className="block w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700">
              Book Appointment
            </Link>
            <Link href={`/dashboard/patients/${id}/documents`}
              className="block w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">
              Medical Documents
            </Link>
            <Link href={`/dashboard/patients/${id}/intelligence`}
              className="block w-full rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-center text-sm font-medium text-indigo-700 hover:bg-indigo-100">
              AI Clinical Intelligence
            </Link>
            <Link href={`/dashboard/patients/${id}/imaging`}
              className="block w-full rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-center text-sm font-medium text-teal-700 hover:bg-teal-100">
              AI Imaging Analysis
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
                        {new Date(item.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
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
                  <div className="mt-3 flex flex-wrap gap-3">
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
                    <Link href={`/dashboard/consultations/${item.id}`} className="ml-auto text-xs text-blue-600 hover:underline">
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
