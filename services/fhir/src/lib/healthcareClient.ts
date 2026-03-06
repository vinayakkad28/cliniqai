/**
 * Google Cloud Healthcare API client (FHIR R4).
 * All reads/writes to GCP Healthcare go through this module.
 */
import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = process.env["GOOGLE_CLOUD_PROJECT_ID"] ?? "";
const REGION = process.env["GCP_REGION"] ?? "asia-south1";
const DATASET_ID = process.env["FHIR_DATASET_ID"] ?? "cliniqai-dataset";
const STORE_ID = process.env["FHIR_STORE_ID"] ?? "cliniqai-fhir";

const FHIR_BASE = `https://healthcare.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/datasets/${DATASET_ID}/fhirStores/${STORE_ID}/fhir`;

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-healthcare"],
  keyFilename: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
});

async function getAuthHeaders(): Promise<Record<string, string>> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return {
    Authorization: `Bearer ${token.token ?? ""}`,
    "Content-Type": "application/fhir+json",
    Accept: "application/fhir+json",
  };
}

export async function fhirCreate(resourceType: string, resource: unknown): Promise<unknown> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FHIR_BASE}/${resourceType}`, {
    method: "POST",
    headers,
    body: JSON.stringify(resource),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FHIR create ${resourceType} failed ${res.status}: ${text}`);
  }

  return res.json();
}

export async function fhirRead(resourceType: string, id: string): Promise<unknown> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FHIR_BASE}/${resourceType}/${id}`, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FHIR read ${resourceType}/${id} failed ${res.status}: ${text}`);
  }

  return res.json();
}

export async function fhirUpdate(resourceType: string, id: string, resource: unknown): Promise<unknown> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FHIR_BASE}/${resourceType}/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(resource),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FHIR update ${resourceType}/${id} failed ${res.status}: ${text}`);
  }

  return res.json();
}

export async function fhirSearch(
  resourceType: string,
  params: Record<string, string>,
): Promise<unknown> {
  const headers = await getAuthHeaders();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${FHIR_BASE}/${resourceType}?${qs}`, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FHIR search ${resourceType} failed ${res.status}: ${text}`);
  }

  return res.json();
}
