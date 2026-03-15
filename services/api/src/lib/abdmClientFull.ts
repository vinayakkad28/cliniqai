import crypto from 'crypto';

const ABDM_BASE_URL = process.env.ABDM_BASE_URL || 'https://dev.abdm.gov.in/gateway';
const ABDM_CLIENT_ID = process.env.ABDM_CLIENT_ID || '';
const ABDM_CLIENT_SECRET = process.env.ABDM_CLIENT_SECRET || '';

let accessToken = '';
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  if (process.env.NODE_ENV === 'development') {
    accessToken = 'dev-mock-token';
    tokenExpiry = Date.now() + 3600000;
    return accessToken;
  }

  const res = await fetch(`${ABDM_BASE_URL}/v0.5/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: ABDM_CLIENT_ID, clientSecret: ABDM_CLIENT_SECRET }),
  });

  if (!res.ok) throw new Error(`ABDM auth failed: ${res.status}`);

  const data = (await res.json()) as { accessToken: string; expiresIn?: number };
  accessToken = data.accessToken;
  tokenExpiry = Date.now() + (data.expiresIn ?? 1800) * 1000;
  return accessToken;
}

async function abdmFetch(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();

  if (process.env.NODE_ENV === 'development') {
    console.log(`[ABDM Dev] ${options.method || 'GET'} ${path}`);
    return getMockResponse(path);
  }

  const res = await fetch(`${ABDM_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-CM-ID': 'sbx',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ABDM API error [${res.status}]: ${err}`);
  }

  return res.json();
}

function getMockResponse(path: string): any {
  if (path.includes('/v1/registration/aadhaar/generateOtp')) {
    return { txnId: `mock-txn-${Date.now()}` };
  }
  if (path.includes('/v1/registration/aadhaar/verifyOtp')) {
    return { healthIdNumber: '91-1234-5678-9012', healthId: 'mockuser@abdm' };
  }
  if (path.includes('/v0.5/patients/profile')) {
    return { valid: true, name: 'Mock Patient', abhaAddress: 'mock@abdm' };
  }
  if (path.includes('/v0.5/consent-requests/init')) {
    return { requestId: `consent-req-${Date.now()}` };
  }
  if (path.includes('/v0.5/health-information/hip/request')) {
    return { transactionId: `txn-${Date.now()}` };
  }
  if (path.includes('/hip/register')) {
    return { hipId: `hip-${Date.now()}` };
  }
  return {};
}

export const abdmClient = {
  // Aadhaar-based ABHA creation
  generateAadhaarOtp: (aadhaarNumber: string) =>
    abdmFetch('/v1/registration/aadhaar/generateOtp', {
      method: 'POST',
      body: JSON.stringify({ aadhaar: encryptAadhaar(aadhaarNumber) }),
    }),

  verifyAadhaarOtp: (txnId: string, otp: string) =>
    abdmFetch('/v1/registration/aadhaar/verifyOtp', {
      method: 'POST',
      body: JSON.stringify({ txnId, otp: encryptOtp(otp) }),
    }),

  // ABHA verification
  verifyAbhaNumber: (abhaNumber: string) =>
    abdmFetch(`/v0.5/patients/profile/${abhaNumber}`, { method: 'GET' }),

  // HIP registration
  registerAsHip: (facility: { facilityName: string; facilityId: string; address: string; type: string }) =>
    abdmFetch('/v0.5/hip/register', {
      method: 'POST',
      body: JSON.stringify({
        id: facility.facilityId,
        name: facility.facilityName,
        type: facility.type.toUpperCase(),
        address: facility.address,
        active: true,
      }),
    }),

  // Consent management
  requestConsent: (params: {
    patientAbhaAddress: string;
    purpose: string;
    dateRange: { from: string; to: string };
    healthInfoTypes: string[];
    hipId: string;
  }) =>
    abdmFetch('/v0.5/consent-requests/init', {
      method: 'POST',
      body: JSON.stringify({
        consent: {
          purpose: { text: params.purpose, code: params.purpose },
          patient: { id: params.patientAbhaAddress },
          hip: { id: params.hipId },
          hiu: { id: params.hipId }, // We're both HIP and HIU
          requester: { name: 'CliniqAI', identifier: { type: 'REGNO', value: params.hipId } },
          hiTypes: params.healthInfoTypes,
          permission: {
            accessMode: 'VIEW',
            dateRange: params.dateRange,
            dataEraseAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            frequency: { unit: 'HOUR', value: 0, repeats: 0 },
          },
        },
      }),
    }),

  // Health record exchange
  fetchHealthRecords: (consentArtefactId: string) =>
    abdmFetch('/v0.5/health-information/cm/request', {
      method: 'POST',
      body: JSON.stringify({
        hiRequest: {
          consent: { id: consentArtefactId },
          dateRange: { from: '2020-01-01', to: new Date().toISOString().split('T')[0] },
          dataPushUrl: `${process.env.APP_URL}/api/abdm/records/callback`,
          keyMaterial: generateKeyMaterial(),
        },
      }),
    }),

  pushHealthRecords: (params: {
    patientAbhaAddress: string;
    bundle: any;
    careContextReference: string;
  }) =>
    abdmFetch('/v0.5/health-information/hip/request', {
      method: 'POST',
      body: JSON.stringify({
        transaction: {
          patient: { id: params.patientAbhaAddress },
          careContext: { careContextReference: params.careContextReference },
          data: params.bundle,
        },
      }),
    }),
};

function encryptAadhaar(aadhaar: string): string {
  if (process.env.NODE_ENV === 'development' && process.env.ALLOW_ABDM_DEV_BYPASS === 'true') return aadhaar;
  // RSA encrypt with ABDM public key
  const publicKey = process.env.ABDM_PUBLIC_KEY || '';
  if (!publicKey) return aadhaar;
  return crypto.publicEncrypt(publicKey, Buffer.from(aadhaar)).toString('base64');
}

function encryptOtp(otp: string): string {
  if (process.env.NODE_ENV === 'development' && process.env.ALLOW_ABDM_DEV_BYPASS === 'true') return otp;
  const publicKey = process.env.ABDM_PUBLIC_KEY || '';
  if (!publicKey) return otp;
  return crypto.publicEncrypt(publicKey, Buffer.from(otp)).toString('base64');
}

function generateKeyMaterial() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    cryptoAlg: 'ECDH',
    curve: 'Curve25519',
    dhPublicKey: { expiry: new Date(Date.now() + 3600000).toISOString(), parameters: 'Curve25519/32byte random key', keyValue: ecdh.getPublicKey('base64') },
    nonce: crypto.randomBytes(32).toString('base64'),
  };
}

export default abdmClient;
