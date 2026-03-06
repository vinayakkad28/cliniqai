/**
 * Internal FHIR client — calls the FHIR service (services/fhir) which
 * proxies to Google Cloud Healthcare API. Only the FHIR service talks
 * directly to GCP; this client handles service-to-service auth.
 */

const FHIR_SERVICE_URL = process.env["FHIR_SERVICE_URL"] ?? "http://localhost:3002";
const INTERNAL_TOKEN = process.env["AI_INTERNAL_TOKEN"] ?? "";

async function fhirRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${FHIR_SERVICE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": INTERNAL_TOKEN,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FHIR service error ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Patient ─────────────────────────────────────────────────────────────────

interface FhirPatientInput {
  name: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
}

interface FhirResource {
  id: string;
  resourceType: string;
  [key: string]: unknown;
}

export const fhirClient = {
  async createPatient(data: FhirPatientInput): Promise<FhirResource> {
    return fhirRequest("POST", "/fhir/Patient", data) as Promise<FhirResource>;
  },

  async getPatient(fhirId: string): Promise<FhirResource> {
    return fhirRequest("GET", `/fhir/Patient/${fhirId}`) as Promise<FhirResource>;
  },

  async updatePatient(fhirId: string, data: Partial<FhirPatientInput>): Promise<FhirResource> {
    return fhirRequest("PUT", `/fhir/Patient/${fhirId}`, data) as Promise<FhirResource>;
  },

  // ─── Encounter ─────────────────────────────────────────────────────────────

  async createEncounter(data: {
    patientFhirId: string;
    practitionerId: string;
    startedAt: string;
    chiefComplaint?: string;
  }): Promise<FhirResource> {
    return fhirRequest("POST", "/fhir/Encounter", data) as Promise<FhirResource>;
  },

  async updateEncounter(fhirId: string, data: unknown): Promise<FhirResource> {
    return fhirRequest("PUT", `/fhir/Encounter/${fhirId}`, data) as Promise<FhirResource>;
  },

  // ─── MedicationRequest ─────────────────────────────────────────────────────

  async createMedicationRequest(data: {
    patientFhirId: string;
    encounterId: string;
    medications: Array<{ drug: string; dose: string; frequency: string; duration: string; route: string }>;
  }): Promise<FhirResource> {
    return fhirRequest("POST", "/fhir/MedicationRequest", data) as Promise<FhirResource>;
  },

  // ─── ServiceRequest (Lab order) ────────────────────────────────────────────

  async createServiceRequest(data: {
    patientFhirId: string;
    encounterId: string;
    tests: string[];
  }): Promise<FhirResource> {
    return fhirRequest("POST", "/fhir/ServiceRequest", data) as Promise<FhirResource>;
  },

  // ─── DiagnosticReport (Lab result) ────────────────────────────────────────

  async createDiagnosticReport(data: {
    patientFhirId: string;
    serviceRequestId: string;
    resultFileUrl: string;
    aiSummary?: string;
  }): Promise<FhirResource> {
    return fhirRequest("POST", "/fhir/DiagnosticReport", data) as Promise<FhirResource>;
  },

  // ─── Condition (Diagnosis) ─────────────────────────────────────────────────

  async createCondition(data: {
    patientFhirId: string;
    encounterId: string;
    icd10Code: string;
    description: string;
  }): Promise<FhirResource> {
    return fhirRequest("POST", "/fhir/Condition", data) as Promise<FhirResource>;
  },
};
