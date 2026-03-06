/**
 * ABDM (Ayushman Bharat Digital Mission) integration client.
 * Implements the India Health Stack (IHS) gateway protocol.
 *
 * References:
 * - https://sandbox.abdm.gov.in/docs
 * - ABDM Gateway: https://dev.abdm.gov.in/gateway
 *
 * Phase 4 — currently stubs that log intent and return mock responses.
 * Production implementation requires:
 *   1. ABDM registration (HMIS entity)
 *   2. Client ID + Client Secret from NHA
 *   3. RSA key pair for request signing
 *   4. HIU (Health Information User) consent flow
 *
 * Legal note: All health data access via ABDM requires patient consent
 * per the Digital Personal Data Protection Act 2023 (DPDP Act).
 */

const ABDM_GATEWAY_URL = process.env["ABDM_GATEWAY_URL"] ?? "https://dev.abdm.gov.in/gateway";
const ABDM_CLIENT_ID = process.env["ABDM_CLIENT_ID"] ?? "";
const ABDM_CLIENT_SECRET = process.env["ABDM_CLIENT_SECRET"] ?? "";
const IS_ABDM_ENABLED = Boolean(ABDM_CLIENT_ID && ABDM_CLIENT_SECRET);

interface AbdmSession {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

let _cachedSession: AbdmSession | null = null;
let _sessionExpiresAt = 0;

async function getAbdmToken(): Promise<string> {
  if (_cachedSession && Date.now() < _sessionExpiresAt - 60_000) {
    return _cachedSession.accessToken;
  }

  const res = await fetch(`${ABDM_GATEWAY_URL}/v0.5/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: ABDM_CLIENT_ID, clientSecret: ABDM_CLIENT_SECRET }),
  });

  if (!res.ok) throw new Error(`ABDM auth failed: ${res.status}`);
  const session = (await res.json()) as AbdmSession;
  _cachedSession = session;
  _sessionExpiresAt = Date.now() + session.expiresIn * 1000;
  return session.accessToken;
}

async function abdmPost(path: string, body: unknown): Promise<unknown> {
  const token = await getAbdmToken();
  const res = await fetch(`${ABDM_GATEWAY_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-CM-ID": "sbx",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ABDM error ${res.status}`);
  return res.json();
}

// ─── ABDM Health ID (ABHA number) ─────────────────────────────────────────────

export const abdmClient = {
  /**
   * Verify an ABHA (Ayushman Bharat Health Account) number.
   * Used during patient registration to link ABHA number to patient record.
   */
  async verifyAbhaNumber(abhaNumber: string): Promise<{ valid: boolean; name?: string; yearOfBirth?: string; gender?: string }> {
    if (!IS_ABDM_ENABLED) {
      console.log(`[abdm] DEV — Verify ABHA: ${abhaNumber}`);
      return { valid: true, name: "Dev Patient", yearOfBirth: "1990", gender: "M" };
    }
    const result = await abdmPost("/v1/hip/patient-care-contexts/discover", {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      patient: { id: `${abhaNumber}@sbx` },
    });
    return result as { valid: boolean; name?: string };
  },

  /**
   * Initiate ABDM consent request for accessing a patient's health records.
   * Patient must approve via their PHR app before records can be fetched.
   */
  async requestConsent(params: {
    patientAbha: string;
    purpose: "CAREMGT" | "BTG" | "PKD" | "PATRQT" | "PUBHLTH" | "HRESCH";
    hiTypes: string[];
    dateRange: { from: string; to: string };
    requesterName: string;
  }): Promise<{ consentRequestId: string }> {
    if (!IS_ABDM_ENABLED) {
      const id = `dev-consent-${Date.now()}`;
      console.log(`[abdm] DEV — Consent request: ${id} for ${params.patientAbha}`);
      return { consentRequestId: id };
    }
    const result = await abdmPost("/v0.5/consent-requests/init", {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      consent: {
        purpose: { code: params.purpose },
        patient: { id: params.patientAbha },
        hiu: { id: ABDM_CLIENT_ID },
        requester: { name: params.requesterName, identifier: { type: "REGNO", value: ABDM_CLIENT_ID } },
        hiTypes: params.hiTypes,
        permission: {
          accessMode: "VIEW",
          dateRange: params.dateRange,
          dataEraseAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          frequency: { unit: "HOUR", value: 1, repeats: 0 },
        },
      },
    });
    return result as { consentRequestId: string };
  },

  /**
   * Fetch patient health records after consent has been granted.
   * Returns FHIR Bundle (R4).
   */
  async fetchHealthRecords(consentArtefactId: string): Promise<unknown> {
    if (!IS_ABDM_ENABLED) {
      console.log(`[abdm] DEV — Fetch records for consent: ${consentArtefactId}`);
      return { resourceType: "Bundle", entry: [] };
    }
    return abdmPost("/v0.5/health-information/cm/request", {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      hiRequest: {
        consent: { id: consentArtefactId },
        dateRange: { from: "2020-01-01", to: new Date().toISOString() },
        dataPushUrl: `${process.env["API_BASE_URL"] ?? ""}/api/abdm/callback/health-info`,
        keyMaterial: {
          cryptoAlg: "ECDH",
          curve: "Curve25519",
          dhPublicKey: { expiry: new Date(Date.now() + 900_000).toISOString(), parameters: "Curve25519/32byte random key", keyValue: "placeholder" },
          nonce: crypto.randomUUID(),
        },
      },
    });
  },
};
