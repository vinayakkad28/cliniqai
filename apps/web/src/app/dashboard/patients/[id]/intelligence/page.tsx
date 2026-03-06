"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { insights, type AiInsight } from "@/lib/api";
import { AiInsightCard } from "@/components/AiInsightCard";

export default function PatientIntelligencePage() {
  const { id: patientId } = useParams<{ id: string }>();
  const router = useRouter();

  const [longitudinalInsight, setLongitudinalInsight] = useState<AiInsight | null>(null);
  const [pendingInsights, setPendingInsights] = useState<AiInsight[]>([]);
  const [allInsights, setAllInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"pending" | "all">("pending");

  useEffect(() => {
    loadInsights();
  }, [patientId]);

  async function loadInsights() {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        insights.list({ patientId, pending: true, limit: 50 }),
        insights.list({ patientId, limit: 50 }),
      ]);
      setPendingInsights(pendingRes.data);
      setAllInsights(allRes.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function generateLongitudinalSummary() {
    setGenerating(true);
    setError("");
    try {
      const res = await insights.longitudinal(patientId);
      setLongitudinalInsight(res.insight);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function requestInsight(type: string) {
    try {
      await insights.request({ patientId, type });
      await loadInsights();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const displayed = tab === "pending" ? pendingInsights : allInsights;

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-1"
        >
          Back to Patient
        </button>
        <h1 className="text-xl font-semibold text-gray-900">AI Clinical Intelligence</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All AI insights require doctor approval before acting. AI is advisory only.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Longitudinal Summary */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 text-sm">Longitudinal Health Summary</h2>
          <button
            onClick={generateLongitudinalSummary}
            disabled={generating}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : longitudinalInsight ? "Refresh Summary" : "Generate Summary"}
          </button>
        </div>
        {longitudinalInsight ? (
          <div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{longitudinalInsight.content}</p>
            <p className="mt-2 text-xs text-gray-500 italic">
              Generated {new Date(longitudinalInsight.createdAt).toLocaleString()} — AI-generated, doctor verification required
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Generate a comprehensive AI summary of this patient's health history across all consultations.
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Request AI Analysis</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { type: "clinical_alert", label: "Check Clinical Alerts" },
            { type: "diagnosis_suggestion", label: "Diagnosis Suggestions" },
            { type: "lab_interpretation", label: "Interpret Latest Labs" },
          ].map(({ type, label }) => (
            <button
              key={type}
              onClick={() => requestInsight(type)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Insights List */}
      <div>
        <div className="flex items-center gap-4 mb-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setTab("pending")}
              className={`px-3 py-1.5 text-xs font-medium ${tab === "pending" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              Pending Review ({pendingInsights.length})
            </button>
            <button
              onClick={() => setTab("all")}
              className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 ${tab === "all" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              All Insights ({allInsights.length})
            </button>
          </div>
          <button
            onClick={loadInsights}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading insights...</div>
        ) : displayed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
            <p className="text-sm text-gray-500">
              {tab === "pending" ? "No insights pending review." : "No AI insights yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((insight) => (
              <AiInsightCard
                key={insight.id}
                insight={insight}
                onApproved={() => loadInsights()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
