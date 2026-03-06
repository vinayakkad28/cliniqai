/**
 * Internal AI client — calls the AI service (services/ai) via X-Internal-Token.
 * All AI inference lives in the Python FastAPI service; this is just the bridge.
 */

const AI_SERVICE_URL = process.env["AI_SERVICE_URL"] ?? "http://localhost:8001";
const INTERNAL_TOKEN = process.env["AI_INTERNAL_TOKEN"] ?? process.env["INTERNAL_API_TOKEN"] ?? "";
const IS_DEV = process.env["NODE_ENV"] === "development";

async function aiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": INTERNAL_TOKEN,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI service error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

function devMock<T>(fallback: T): T {
  return fallback;
}

export interface DdiAlert {
  drug_a: string;
  drug_b: string;
  severity: "major" | "moderate" | "minor";
  description: string;
  recommendation: string;
}

export interface PrescriptionSuggestion {
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  rationale: string;
}

export interface DiagnosisCandidate {
  condition: string;
  icd10_code: string;
  probability: string;
  rationale: string;
  suggested_workup: string[];
}

export const aiClient = {
  async checkDdi(drugs: string[], patientId?: string): Promise<DdiAlert[]> {
    if (IS_DEV) return devMock<DdiAlert[]>([]);
    const result = await aiPost<{ alerts: DdiAlert[] }>("/ddi/check", { drugs, patient_id: patientId });
    return result.alerts;
  },

  async prescriptionAssist(params: {
    patientId: string;
    symptoms: string[];
    chiefComplaint: string;
    historySummary?: string;
    currentMedications?: string[];
  }): Promise<{ suggestions: PrescriptionSuggestion[]; warnings: string[]; icd10Codes: string[] }> {
    if (IS_DEV) return devMock({ suggestions: [], warnings: [], icd10Codes: [] });
    const result = await aiPost<{
      suggestions: PrescriptionSuggestion[];
      warnings: string[];
      icd10_codes: string[];
    }>("/prescription/assist", {
      patient_id: params.patientId,
      symptoms: params.symptoms,
      chief_complaint: params.chiefComplaint,
      history_summary: params.historySummary,
      current_medications: params.currentMedications ?? [],
    });
    return { suggestions: result.suggestions, warnings: result.warnings, icd10Codes: result.icd10_codes };
  },

  async suggestDiagnosis(params: {
    patientId: string;
    symptoms: string[];
    vitals?: Record<string, unknown>;
    historySummary?: string;
    age?: number;
    gender?: string;
  }): Promise<{ differential: DiagnosisCandidate[]; redFlags: string[] }> {
    if (IS_DEV) return devMock({ differential: [], redFlags: [] });
    const result = await aiPost<{ differential: DiagnosisCandidate[]; red_flags: string[] }>(
      "/diagnosis/suggest",
      {
        patient_id: params.patientId,
        symptoms: params.symptoms,
        vitals: params.vitals,
        history_summary: params.historySummary,
        age: params.age,
        gender: params.gender,
      },
    );
    return { differential: result.differential, redFlags: result.red_flags };
  },

  async interpretLabResults(params: {
    patientId: string;
    labOrderId: string;
    results: Array<{ name: string; value: number | string; unit: string; referenceRange?: string; flag?: string }>;
    patientAge?: number;
    patientGender?: string;
  }): Promise<{ plainLanguageSummary: string; abnormalFindings: string[]; suggestedFollowUp: string[] }> {
    if (IS_DEV) return devMock({ plainLanguageSummary: "[DEV] Lab results look normal", abnormalFindings: [], suggestedFollowUp: [] });
    const result = await aiPost<{
      plain_language_summary: string;
      abnormal_findings: string[];
      suggested_follow_up: string[];
    }>("/lab/interpret", {
      patient_id: params.patientId,
      lab_order_id: params.labOrderId,
      results: params.results.map((r) => ({
        name: r.name,
        value: r.value,
        unit: r.unit,
        reference_range: r.referenceRange,
        flag: r.flag,
      })),
      patient_age: params.patientAge,
      patient_gender: params.patientGender,
    });
    return {
      plainLanguageSummary: result.plain_language_summary,
      abnormalFindings: result.abnormal_findings,
      suggestedFollowUp: result.suggested_follow_up,
    };
  },

  // ─── Phase 2/3 methods ──────────────────────────────────────────────────────

  async longitudinalSummary(params: {
    patientId: string;
    consultations: Array<{ id: string; startedAt: Date; chiefComplaint: string | null; notes: string | null; status: string }>;
    approvedInsights: Array<{ type: string; content: string; createdAt: Date }>;
  }): Promise<string> {
    if (IS_DEV) return `[DEV] Longitudinal summary for patient ${params.patientId}. ${params.consultations.length} consultations reviewed.`;
    const result = await aiPost<{ summary: string }>("/longitudinal/summary", params);
    return result.summary;
  },

  async evaluateClinicalAlert(params: {
    patientId: string;
    consultationId?: string;
    vitals?: Record<string, unknown>;
    medications?: string[];
    recentResults?: Record<string, unknown>;
  }): Promise<{ hasAlert: boolean; severity: "low" | "medium" | "high" | "critical"; message: string }> {
    if (IS_DEV) return { hasAlert: false, severity: "low", message: "[DEV] No alerts" };
    return aiPost("/alerts/evaluate", params);
  },

  async documentExtract(params: {
    documentId: string;
    gcsPath: string;
    mimeType: string;
    documentType: string;
  }): Promise<{ extractedData: Record<string, unknown>; summary: string }> {
    if (IS_DEV) return { extractedData: {}, summary: `[DEV] Extracted data for ${params.documentId}` };
    return aiPost("/documents/extract", params);
  },

  async vectorSearch(params: {
    query: string;
    patientId?: string;
    topK?: number;
  }): Promise<Array<{ documentId: string; chunkText: string; score: number }>> {
    if (IS_DEV) return [];
    return aiPost("/records/search", params);
  },

  async explainForPatient(params: { content: string; language?: string }): Promise<string> {
    if (IS_DEV) return `[DEV] Patient explanation: ${params.content.slice(0, 100)}`;
    const result = await aiPost<{ explanation: string }>("/explain/patient", params);
    return result.explanation;
  },
};
