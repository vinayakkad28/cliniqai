/**
 * ABDM (Ayushman Bharat Digital Mission) integration client.
 * Implements the India Health Stack (IHS) gateway protocol.
 *
 * References:
 * - https://sandbox.abdm.gov.in/docs
 * - ABDM Gateway: https://dev.abdm.gov.in/gateway
 *
 * Legal note: All health data access via ABDM requires patient consent
 * per the Digital Personal Data Protection Act 2023 (DPDP Act).
 */

import { createECDH, randomUUID } from "crypto";
import { createLogger } from "./logger.js";

const log = createLogger("abdm");

const ABDM_GATEWAY_URL = process.env["ABDM_GATEWAY_URL"] ?? "https://dev.abdm.gov.in/gateway";
const ABDM_CLIENT_ID = process.env["ABDM_CLIENT_ID"] ?? "";
const ABDM_CLIENT_SECRET = process.env["ABDM_CLIENT_SECRET"] ?? "";
const ABDM_HMIS_ID = process.env["ABDM_HMIS_ID"] ?? ABDM_CLIENT_ID;
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

  if (!res.ok) {
    // Retry once on 401 (token may have expired server-side)
    if (res.status === 401 && _cachedSession) {
      _cachedSession = null;
      _sessionExpiresAt = 0;
      return getAbdmToken();
    }
    throw new Error(`ABDM auth failed: ${res.status}`);
  }

  const session = (await res.json()) as AbdmSession;
  _cachedSession = session;
  _sessionExpiresAt = Date.now() + session.expiresIn * 1000;
  log.info("abdm_session_renewed");
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

  if (!res.ok) {
    const text = await res.text();
    log.error({ path, status: res.status, body: text }, "abdm_request_failed");
    throw new Error(`ABDM error ${res.status}: ${text}`);
  }

  return res.json();
}

/** Generate ECDH key pair for health record encryption */
function generateKeyMaterial() {
  const ecdh = createECDH("prime256v1"); // ABDM supports P-256
  ecdh.generateKeys();
  const nonce = randomUUID();

  return {
    publicKey: ecdh.getPublicKey("base64"),
    privateKey: ecdh.getPrivateKey("base64"),
    nonce,
    keyMaterial: {
      cryptoAlg: "ECDH",
      curve: "Curve25519",
      dhPublicKey: {
        expiry: new Date(Date.now() + 900_000).toISOString(),
        parameters: "Curve25519/32byte random key",
        keyValue: ecdh.getPublicKey("base64"),
      },
      nonce,
    },
  };
}

// ─── Exported client ────────────────────────────────────────────────────────

export const abdmClient = {
  get isEnabled() {
    return IS_ABDM_ENABLED;
  },

  /**
   * Verify an ABHA (Ayushman Bharat Health Account) number.
   * Uses the ABHA v3 patient status API.
   */
  async verifyAbhaNumber(abhaNumber: string): Promise<{
    valid: boolean;
    name?: string;
    yearOfBirth?: string;
    gender?: string;
    healthId?: string;
  }> {
    if (!IS_ABDM_ENABLED) {
      log.debug({ abhaNumber }, "abdm_verify_dev_mock");
      return { valid: true, name: "Dev Patient", yearOfBirth: "1990", gender: "M", healthId: abhaNumber };
    }

    const result = await abdmPost("/v1/registration/aadhaar/searchByHealthId", {
      healthId: abhaNumber,
    }) as { status?: boolean; healthIdNumber?: string; name?: string; yearOfBirth?: string; gender?: string };

    return {
      valid: result.status !== false,
      name: result.name,
      yearOfBirth: result.yearOfBirth,
      gender: result.gender,
      healthId: result.healthIdNumber,
    };
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
    requesterLicense?: string;
  }): Promise<{ consentRequestId: string }> {
    if (!IS_ABDM_ENABLED) {
      const id = `dev-consent-${Date.now()}`;
      log.debug({ id, patientAbha: params.patientAbha }, "abdm_consent_dev_mock");
      return { consentRequestId: id };
    }

    const requestId = randomUUID();
    const result = await abdmPost("/v0.5/consent-requests/init", {
      requestId,
      timestamp: new Date().toISOString(),
      consent: {
        purpose: { text: `Clinical ${params.purpose}`, code: params.purpose },
        patient: { id: params.patientAbha },
        hiu: { id: ABDM_HMIS_ID },
        requester: {
          name: params.requesterName,
          identifier: {
            type: "REGNO",
            value: params.requesterLicense ?? ABDM_HMIS_ID,
            system: "https://www.mciindia.org",
          },
        },
        hiTypes: params.hiTypes,
        permission: {
          accessMode: "VIEW",
          dateRange: params.dateRange,
          dataEraseAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          frequency: { unit: "HOUR", value: 1, repeats: 0 },
        },
      },
    }) as { consentRequest?: { id?: string } };

    return { consentRequestId: result.consentRequest?.id ?? requestId };
  },

  /**
   * Check the status of a consent request.
   */
  async checkConsentStatus(consentRequestId: string): Promise<{
    status: "REQUESTED" | "GRANTED" | "DENIED" | "EXPIRED" | "REVOKED";
    consentArtefactId?: string;
  }> {
    if (!IS_ABDM_ENABLED) {
      log.debug({ consentRequestId }, "abdm_consent_status_dev_mock");
      return { status: "GRANTED", consentArtefactId: `dev-artefact-${consentRequestId}` };
    }

    const result = await abdmPost("/v0.5/consent-requests/status", {
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      consentRequestId,
    }) as { status?: { status?: string; consentArtefactId?: string } };

    return {
      status: (result.status?.status ?? "REQUESTED") as "REQUESTED" | "GRANTED" | "DENIED" | "EXPIRED" | "REVOKED",
      consentArtefactId: result.status?.consentArtefactId,
    };
  },

  /**
   * Fetch the consent artefact details after consent is granted.
   */
  async fetchConsentArtefact(consentArtefactId: string): Promise<{
    consentDetail: { hiTypes: string[]; patient: { id: string }; permission: unknown };
  }> {
    if (!IS_ABDM_ENABLED) {
      return { consentDetail: { hiTypes: [], patient: { id: "dev" }, permission: {} } };
    }

    return abdmPost("/v0.5/consents/fetch", {
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      consentId: consentArtefactId,
    }) as Promise<{ consentDetail: { hiTypes: string[]; patient: { id: string }; permission: unknown } }>;
  },

  /**
   * Request patient health records after consent has been granted.
   * Returns key material for decrypting the response.
   */
  async fetchHealthRecords(consentArtefactId: string): Promise<{
    transactionId: string;
    privateKey: string;
    nonce: string;
  }> {
    if (!IS_ABDM_ENABLED) {
      log.debug({ consentArtefactId }, "abdm_fetch_records_dev_mock");
      return { transactionId: `dev-txn-${Date.now()}`, privateKey: "", nonce: "" };
    }

    const keys = generateKeyMaterial();
    const dataPushUrl = `${process.env["API_BASE_URL"] ?? ""}/api/abdm/callback/health-info`;

    const result = await abdmPost("/v0.5/health-information/cm/request", {
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      hiRequest: {
        consent: { id: consentArtefactId },
        dateRange: { from: "2010-01-01T00:00:00.000Z", to: new Date().toISOString() },
        dataPushUrl,
        keyMaterial: keys.keyMaterial,
      },
    }) as { hiRequest?: { transactionId?: string } };

    return {
      transactionId: result.hiRequest?.transactionId ?? randomUUID(),
      privateKey: keys.privateKey,
      nonce: keys.nonce,
    };
  },

  /**
   * Revoke a previously granted consent.
   */
  async revokeConsent(consentArtefactId: string): Promise<{ status: string }> {
    if (!IS_ABDM_ENABLED) {
      return { status: "REVOKED" };
    }

    await abdmPost("/v0.5/consents/revoke", {
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      consentId: consentArtefactId,
    });

    return { status: "REVOKED" };
  },
};
