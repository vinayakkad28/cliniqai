"use client";

import { useState } from "react";
import { insights, type AiInsight } from "@/lib/api";
import { toast } from "sonner";

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
  lab_interpretation: "border-primary/20 bg-primary/5",
  clinical_alert: "border-red-200 bg-red-50",
  discharge_summary: "border-teal-200 bg-teal-50",
  longitudinal_summary: "border-indigo-200 bg-indigo-50",
  document_extraction: "border-border bg-muted/50",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-700 bg-red-100",
  high: "text-orange-700 bg-orange-100",
  medium: "text-yellow-700 bg-yellow-100",
  low: "text-accent bg-green-100",
};

interface Props {
  insight: AiInsight;
  onApproved?: (updated: AiInsight) => void;
}

export function AiInsightCard({ insight, onApproved }: Props) {
  const [approving, setApproving] = useState(false);
  const [localInsight, setLocalInsight] = useState(insight);

  const severity = (localInsight.metadata?.["severity"] as string) ?? null;
  const isCritical = severity === "critical";

  async function handleApprove(approved: boolean) {
    setApproving(true);
    try {
      const updated = await insights.approve(localInsight.id, approved);
      setLocalInsight(updated);
      onApproved?.(updated);
      toast.success(approved ? "Insight approved" : "Insight dismissed");
    } catch {
      toast.error("Failed to update insight");
    } finally {
      setApproving(false);
    }
  }

  const colorClass = TYPE_COLORS[localInsight.type] ?? "border-border bg-muted/50";

  return (
    <div
      className={`rounded-xl border p-4 ${colorClass}`}
      role={isCritical ? "alert" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-card-foreground">
            {TYPE_LABELS[localInsight.type] ?? localInsight.type}
          </span>
          {severity && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[severity] ?? "bg-muted text-muted-foreground"}`}>
              {severity.toUpperCase()}
            </span>
          )}
          {localInsight.doctorApproved === true && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-accent">
              Approved
            </span>
          )}
          {localInsight.doctorApproved === false && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              Dismissed
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(localInsight.createdAt).toLocaleString()}
        </span>
      </div>

      <p className="mt-2 text-sm text-card-foreground whitespace-pre-wrap">{localInsight.content}</p>

      <p className="mt-2 text-xs text-muted-foreground italic">
        AI-generated — doctor must verify before acting on this insight
      </p>

      {localInsight.doctorApproved === null && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => handleApprove(true)}
            disabled={approving}
            aria-label="Approve this AI insight"
            className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {approving ? "..." : "Approve"}
          </button>
          <button
            onClick={() => handleApprove(false)}
            disabled={approving}
            aria-label="Dismiss this AI insight"
            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
