"use client";

import { useState } from "react";
import { insights, type AiInsight } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  diagnosis_suggestion: "Diagnosis Suggestion",
  drug_interaction: "Drug Interaction Alert",
  lab_interpretation: "Lab Interpretation",
  clinical_alert: "Clinical Alert",
  discharge_summary: "Discharge Summary",
  longitudinal_summary: "Longitudinal Summary",
  document_extraction: "Document Analysis",
};

const TYPE_COLORS: Record<string, string> = {
  diagnosis_suggestion: "border-purple-200 bg-purple-50",
  drug_interaction: "border-orange-200 bg-orange-50",
  lab_interpretation: "border-blue-200 bg-blue-50",
  clinical_alert: "border-red-200 bg-red-50",
  discharge_summary: "border-teal-200 bg-teal-50",
  longitudinal_summary: "border-indigo-200 bg-indigo-50",
  document_extraction: "border-gray-200 bg-gray-50",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-700 bg-red-100",
  high: "text-orange-700 bg-orange-100",
  medium: "text-yellow-700 bg-yellow-100",
  low: "text-green-700 bg-green-100",
};

interface Props {
  insight: AiInsight;
  onApproved?: (updated: AiInsight) => void;
}

export function AiInsightCard({ insight, onApproved }: Props) {
  const [approving, setApproving] = useState(false);
  const [localInsight, setLocalInsight] = useState(insight);

  const severity = (localInsight.metadata?.["severity"] as string) ?? null;

  async function handleApprove(approved: boolean) {
    setApproving(true);
    try {
      const updated = await insights.approve(localInsight.id, approved);
      setLocalInsight(updated);
      onApproved?.(updated);
    } catch {
      // ignore
    } finally {
      setApproving(false);
    }
  }

  const colorClass = TYPE_COLORS[localInsight.type] ?? "border-gray-200 bg-gray-50";

  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-700">
            {TYPE_LABELS[localInsight.type] ?? localInsight.type}
          </span>
          {severity && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[severity] ?? "bg-gray-100 text-gray-600"}`}>
              {severity.toUpperCase()}
            </span>
          )}
          {localInsight.doctorApproved === true && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
              Approved
            </span>
          )}
          {localInsight.doctorApproved === false && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
              Dismissed
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {new Date(localInsight.createdAt).toLocaleString()}
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{localInsight.content}</p>

      <p className="mt-2 text-xs text-gray-500 italic">
        AI-generated — doctor must verify before acting on this insight
      </p>

      {localInsight.doctorApproved === null && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleApprove(true)}
            disabled={approving}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {approving ? "..." : "Approve"}
          </button>
          <button
            onClick={() => handleApprove(false)}
            disabled={approving}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
