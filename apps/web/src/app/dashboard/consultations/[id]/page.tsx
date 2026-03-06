"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { consultations } from "@/lib/api";

const AI_BASE = process.env["NEXT_PUBLIC_AI_URL"] ?? "http://localhost:8001";

interface ConsultationDetail {
  id: string;
  patientId: string;
  doctorId: string;
  fhirEncounterId?: string;
  startedAt: string;
  endedAt?: string;
  chiefComplaint?: string;
  notes?: string;
  status: string;
  prescriptions: Array<{ id: string; status: string; sentAt?: string }>;
  labOrders: Array<{ id: string; tests: string[]; status: string }>;
  invoices: Array<{ id: string; total: string; status: string }>;
}

interface DiagnosisSuggestion {
  condition: string;
  icd10_code: string;
  probability: string;
  rationale: string;
}

interface NotesStructured {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export default function ConsultationPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  const [consultation, setConsultation] = useState<ConsultationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Notes
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // AI panels
  const [diagnosisInput, setDiagnosisInput] = useState("");
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState<DiagnosisSuggestion[]>([]);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  const [notesAiInput, setNotesAiInput] = useState("");
  const [structuredNotes, setStructuredNotes] = useState<NotesStructured | null>(null);
  const [notesAiLoading, setNotesAiLoading] = useState(false);

  const [endLoading, setEndLoading] = useState(false);

  useEffect(() => {
    consultations
      .get(id)
      .then((c) => {
        const data = c as ConsultationDetail;
        setConsultation(data);
        setNotes(data.notes ?? "");
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSaveNotes() {
    if (!consultation) return;
    setSavingNotes(true);
    try {
      await consultations.update(id, { notes });
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleEnd() {
    if (!consultation || !confirm("End this consultation?")) return;
    setEndLoading(true);
    try {
      await handleSaveNotes();
      await consultations.end(id);
      router.replace(`/dashboard/patients/${consultation.patientId}`);
    } finally {
      setEndLoading(false);
    }
  }

  async function handleDiagnosisSuggest() {
    if (!diagnosisInput.trim()) return;
    setDiagnosisLoading(true);
    setDiagnosisSuggestions([]);
    try {
      const token = localStorage.getItem("cliniqai_access_token") ?? "";
      const res = await fetch(`${AI_BASE}/diagnosis/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Token": token },
        body: JSON.stringify({ symptoms: diagnosisInput, patient_id: consultation?.patientId }),
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnosisSuggestions(data.suggestions ?? []);
      }
    } finally {
      setDiagnosisLoading(false);
    }
  }

  async function handleStructureNotes() {
    if (!notesAiInput.trim()) return;
    setNotesAiLoading(true);
    setStructuredNotes(null);
    try {
      const token = localStorage.getItem("cliniqai_access_token") ?? "";
      const res = await fetch(`${AI_BASE}/notes/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Token": token },
        body: JSON.stringify({ raw_notes: notesAiInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setStructuredNotes(data);
        // Auto-fill notes editor with SOAP text
        if (data.plain_text) setNotes(data.plain_text);
      }
    } finally {
      setNotesAiLoading(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">Loading…</div>;
  if (!consultation) return <div className="py-20 text-center text-sm text-red-500">Consultation not found.</div>;

  const isActive = consultation.status === "in_progress";

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
          <h1 className="text-xl font-bold text-gray-900">
            Consultation — {new Date(consultation.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isActive ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
          }`}>
            {consultation.status.replace("_", " ")}
          </span>
        </div>
        {isActive && (
          <button
            onClick={handleEnd}
            disabled={endLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {endLoading ? "Ending…" : "End Consultation"}
          </button>
        )}
      </div>

      {consultation.chiefComplaint && (
        <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          <span className="font-medium">Chief Complaint:</span> {consultation.chiefComplaint}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Notes editor */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Clinical Notes</h2>
            <textarea
              rows={10}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!isActive}
              placeholder="Enter clinical notes, findings, plan…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
            />
            {isActive && (
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="mt-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60"
              >
                {savingNotes ? "Saving…" : "Save Notes"}
              </button>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard
              label="Prescriptions"
              count={consultation.prescriptions.length}
              href={`/dashboard/consultations/${id}/prescriptions/new`}
              addLabel={isActive ? "+ Add" : undefined}
            />
            <SummaryCard
              label="Lab Orders"
              count={consultation.labOrders.length}
              href={`/dashboard/consultations/${id}/labs/new`}
              addLabel={isActive ? "+ Add" : undefined}
            />
            <SummaryCard
              label="Invoices"
              count={consultation.invoices.length}
              href={`/dashboard/consultations/${id}/invoice/new`}
              addLabel={isActive ? "+ Create" : undefined}
            />
          </div>
        </div>

        {/* AI Assist panel */}
        <div className="space-y-4">
          {/* Diagnosis suggest */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-blue-700 uppercase tracking-wide">AI Diagnosis Assist</h2>
            <textarea
              rows={4}
              value={diagnosisInput}
              onChange={(e) => setDiagnosisInput(e.target.value)}
              placeholder="Describe symptoms, vitals, history…"
              className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleDiagnosisSuggest}
              disabled={diagnosisLoading || !diagnosisInput.trim()}
              className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {diagnosisLoading ? "Analysing…" : "Suggest Diagnoses"}
            </button>
            {diagnosisSuggestions.length > 0 && (
              <div className="mt-4 space-y-2">
                {diagnosisSuggestions.map((d, i) => (
                  <div key={i} className="rounded-lg bg-white border border-blue-100 px-3 py-2.5">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium text-gray-900">{d.condition}</p>
                      <span className="text-xs font-mono text-gray-400 ml-2 shrink-0">{d.icd10_code}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{d.probability} probability — {d.rationale}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SOAP notes structurer */}
          <div className="rounded-xl border border-green-100 bg-green-50 p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-green-700 uppercase tracking-wide">AI Notes Structurer</h2>
            <textarea
              rows={4}
              value={notesAiInput}
              onChange={(e) => setNotesAiInput(e.target.value)}
              placeholder="Paste raw dictation or unstructured notes…"
              className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
            />
            <button
              onClick={handleStructureNotes}
              disabled={notesAiLoading || !notesAiInput.trim()}
              className="mt-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {notesAiLoading ? "Structuring…" : "Structure to SOAP"}
            </button>
            {structuredNotes && (
              <div className="mt-4 space-y-2 text-sm">
                {Object.entries(structuredNotes)
                  .filter(([k]) => ["subjective", "objective", "assessment", "plan"].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-white border border-green-100 px-3 py-2.5">
                      <p className="text-xs font-semibold text-green-700 uppercase mb-0.5">{k}</p>
                      <p className="text-gray-700 text-xs">{v as string}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label, count, href, addLabel,
}: { label: string; count: number; href: string; addLabel?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-center">
      <p className="text-2xl font-bold text-gray-900">{count}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {addLabel && (
        <a href={href} className="mt-2 block text-xs text-blue-600 hover:underline">{addLabel}</a>
      )}
    </div>
  );
}
