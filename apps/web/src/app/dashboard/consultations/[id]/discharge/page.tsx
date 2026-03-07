"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { consultations, insights, type AiInsight } from "@/lib/api";

interface ConsultationBasic {
  id: string;
  patientId: string;
  status: string;
  chiefComplaint?: string;
  notes?: string;
  startedAt: string;
  endedAt?: string;
}

export default function DischargeSummaryPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [consultation, setConsultation] = useState<ConsultationBasic | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<AiInsight | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    consultations
      .get(id)
      .then((c) => setConsultation(c as ConsultationBasic))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleGenerate() {
    if (!consultation) return;
    setGenerating(true);
    setError("");
    setSummary(null);
    try {
      const result = await insights.request({
        patientId: consultation.patientId,
        consultationId: id,
        type: "discharge_summary",
        context: {
          chiefComplaint: consultation.chiefComplaint,
          notes: consultation.notes,
        },
      });

      // Check if result is an insight or a queued message
      if ("content" in result) {
        setSummary(result as AiInsight);
      } else {
        // Queued — poll longitudinal once
        await new Promise((r) => setTimeout(r, 3000));
        const longitudinal = await insights.longitudinal(consultation.patientId);
        if (longitudinal.insight) {
          setSummary(longitudinal.insight);
        } else {
          setError("Summary is being generated. Please refresh in a moment.");
        }
      }
    } catch {
      setError("AI service unavailable. Please ensure the AI service is running.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">Loading…</div>;
  if (!consultation) return <div className="py-20 text-center text-sm text-red-500">Consultation not found.</div>;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="max-w-3xl">
        <div className="mb-6 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <Link href={`/dashboard/consultations/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
              ← Back to Consultation
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Discharge Summary</h1>
          </div>
          {summary && (
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              🖨 Print
            </button>
          )}
        </div>

        {/* Consultation info */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</dt>
              <dd className="mt-1 text-gray-900">{new Date(consultation.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</dt>
              <dd className="mt-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${consultation.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {consultation.status.replace("_", " ")}
                </span>
              </dd>
            </div>
            {consultation.chiefComplaint && (
              <div className="col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Chief Complaint</dt>
                <dd className="mt-1 text-gray-900">{consultation.chiefComplaint}</dd>
              </div>
            )}
          </dl>
        </div>

        {consultation.status !== "completed" && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Discharge summaries are only available for completed consultations.
          </div>
        )}

        {consultation.status === "completed" && !summary && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50 px-6 py-16 text-center">
            <p className="mb-2 text-sm font-medium text-indigo-800">Generate an AI-powered discharge summary</p>
            <p className="mb-6 text-xs text-indigo-600">The AI will summarize the consultation, prescriptions, and lab orders into a structured discharge document.</p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {generating ? "Generating…" : "✨ Generate Discharge Summary"}
            </button>
            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          </div>
        )}

        {summary && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Discharge Summary</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  Generated {new Date(summary.createdAt).toLocaleDateString("en-IN")}
                </span>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="no-print text-xs text-indigo-600 hover:underline disabled:opacity-50"
                >
                  {generating ? "Regenerating…" : "Regenerate"}
                </button>
              </div>
            </div>

            <div className="prose prose-sm max-w-none text-gray-800">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">{summary.content}</pre>
            </div>

            <p className="mt-4 text-xs text-gray-400 italic">AI-generated — verify all information before use. Not a substitute for professional medical judgment.</p>
          </div>
        )}
      </div>
    </>
  );
}
