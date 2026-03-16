/**
 * Typed API client for CliniqAI Core API.
 * All requests include the Bearer token from localStorage.
 */

// Use relative /api path in browser (Vercel rewrites to Railway API)
// Only use full URL for server-side rendering
const envUrl = process.env["NEXT_PUBLIC_API_URL"];
const BASE = typeof window !== "undefined"
  ? "/api"
  : envUrl ? `${envUrl.replace(/\/$/, "")}/api` : "http://localhost:3001/api";
export const AI_BASE = process.env["NEXT_PUBLIC_AI_URL"] ?? "http://localhost:8001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cliniqai_access_token");
}

let refreshPromise: Promise<void> | null = null;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const doRequest = async (): Promise<Response> => {
    const token = getToken();
    return fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  };

  let res = await doRequest();

  // On 401, attempt token refresh once
  if (res.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const refreshToken = typeof window !== "undefined" ? localStorage.getItem("cliniqai_refresh_token") : null;
        if (!refreshToken) throw new Error("No refresh token");
        try {
          const refreshRes = await fetch(`${BASE}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          if (!refreshRes.ok) throw new Error("Refresh failed");
          const data = await refreshRes.json();
          localStorage.setItem("cliniqai_access_token", data.accessToken);
          if (data.refreshToken) localStorage.setItem("cliniqai_refresh_token", data.refreshToken);
        } catch {
          localStorage.removeItem("cliniqai_access_token");
          localStorage.removeItem("cliniqai_refresh_token");
          if (typeof window !== "undefined") window.location.href = "/login";
          throw new Error("Session expired");
        }
      })().finally(() => { refreshPromise = null; });
    }
    try {
      await refreshPromise;
      res = await doRequest();
    } catch {
      // refresh failed, throw original 401
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? "Request failed"), { status: res.status, data: err });
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  role: string;
  userId: string;
}

export const auth = {
  sendOtp: (phone: string) =>
    request<{ message: string; dev_otp?: string }>("POST", "/auth/send-otp", { phone }),

  verifyOtp: (phone: string, otp: string) =>
    request<AuthTokens>("POST", "/auth/verify-otp", { phone, otp }),

  login: (email: string, password: string) =>
    request<AuthTokens>("POST", "/auth/login", { email, password }),

  refresh: (refreshToken: string) =>
    request<Pick<AuthTokens, "accessToken" | "refreshToken">>("POST", "/auth/refresh", { refreshToken }),

  register: (data: { phone: string; name: string; licenseNumber: string; email?: string }) =>
    request<{ message: string; userId: string; dev_otp?: string }>("POST", "/auth/register", data),

  logout: (refreshToken?: string) =>
    request<{ message: string }>("POST", "/auth/logout", refreshToken ? { refreshToken } : {}),

  me: () =>
    request<{
      id: string;
      email: string | null;
      phone: string;
      role: string;
      doctor: { id: string; name: string; specialties: string[]; licenseNumber: string; bio: string | null } | null;
    }>("GET", "/auth/me"),
};

// ─── Doctors ──────────────────────────────────────────────────────────────────

export interface WorkingHour {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDurationMins: number;
}

export const doctors = {
  getMe: () => request<{ id: string; name: string; specialties: string[]; bio: string | null; workingHours: WorkingHour[] }>("GET", "/doctors/me"),
  patchMe: (data: { name?: string; bio?: string; specialties?: string[]; licenseNumber?: string }) =>
    request("PATCH", "/doctors/me", data),
  getWorkingHours: () => request<WorkingHour[]>("GET", "/doctors/me/working-hours"),
  putWorkingHours: (hours: Omit<WorkingHour, "id">[]) =>
    request("PUT", "/doctors/me/working-hours", hours),
};

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface StaffMember {
  id: string;
  phone: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export const staff = {
  list: () => request<{ data: StaffMember[] }>("GET", "/doctors/staff"),
  create: (data: { phone: string; name: string; role: string }) =>
    request<StaffMember & { setupCode: string }>("POST", "/doctors/staff", data),
  remove: (userId: string) => request<{ message: string }>("DELETE", `/doctors/staff/${userId}`),
};

// ─── Patients ─────────────────────────────────────────────────────────────────

export interface MedicalHistory {
  allergies?: string[];
  chronicConditions?: string[];
  pastSurgeries?: string[];
  currentMedications?: string[];
  familyHistory?: string;
}

export interface Patient {
  id: string;
  phone: string;
  name?: string | null;
  fhirPatientId: string;
  tags: { tag: string }[];
  createdAt: string;
  medicalHistory?: MedicalHistory | null;
}

export interface PatientListResponse {
  data: Patient[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export const patients = {
  list: (params?: { search?: string; tag?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<PatientListResponse>("GET", `/patients${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<Patient & { fhir?: Record<string, unknown> }>("GET", `/patients/${id}`),
  create: (data: { phone: string; name: string; dateOfBirth?: string; gender?: string; address?: string }) =>
    request<Patient>("POST", "/patients", data),
  patch: (id: string, data: { medicalHistory?: MedicalHistory }) =>
    request<Patient>("PATCH", `/patients/${id}`, data),
  timeline: (id: string) => request<unknown[]>("GET", `/patients/${id}/timeline`),
  search: (id: string, query: string) =>
    request<{ answer: Array<{ documentId: string; chunkText: string; score: number }>; query: string }>(
      "POST", `/patients/${id}/search`, { query }
    ),
};

// ─── Appointments ─────────────────────────────────────────────────────────────

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  status: string;
  type: string;
  notes: string | null;
  patient?: { id: string; phone: string; name?: string | null };
}

export interface AppointmentListResponse {
  data: Appointment[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export const appointments = {
  list: (params?: { date?: string; from?: string; to?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<AppointmentListResponse>("GET", `/appointments${qs ? `?${qs}` : ""}`);
  },
  create: (data: { patientId: string; scheduledAt: string; type?: string; notes?: string }) =>
    request<Appointment>("POST", "/appointments", data),
  update: (id: string, data: { status?: string; notes?: string }) =>
    request<Appointment>("PATCH", `/appointments/${id}`, data),
};

// ─── Consultations ────────────────────────────────────────────────────────────

export const consultations = {
  list: (params?: { patientId?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request("GET", `/consultations${qs ? `?${qs}` : ""}`);
  },
  start: (appointmentId: string, chiefComplaint?: string) =>
    request("POST", "/consultations", { appointmentId, chiefComplaint }),
  get: (id: string) => request("GET", `/consultations/${id}`),
  update: (id: string, data: { chiefComplaint?: string; notes?: string }) =>
    request("PATCH", `/consultations/${id}`, data),
  end: (id: string) => request("POST", `/consultations/${id}/end`),
};

// ─── Billing ──────────────────────────────────────────────────────────────────

export const billing = {
  createInvoice: (data: { consultationId: string; amount: number; gstPercent?: number }) =>
    request("POST", "/billing/invoices", data),
  listInvoices: (params?: { status?: string; from?: string; to?: string; page?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request("GET", `/billing/invoices${qs ? `?${qs}` : ""}`);
  },
  markPaid: (id: string, data: { paymentMethod: string; transactionId?: string; amount?: number }) =>
    request("PATCH", `/billing/invoices/${id}`, data),
  revenue: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request("GET", `/billing/reports/revenue${qs ? `?${qs}` : ""}`);
  },
  dailyRevenue: (days = 30) => request<{ days: Record<string, number> }>("GET", `/billing/reports/daily?days=${days}`),
  exportCsvUrl: (params?: { from?: string; to?: string; status?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return `/billing/invoices/export${qs ? `?${qs}` : ""}`;
  },
  downloadInvoicePdf: (id: string) => {
    const token = getToken();
    return fetch(`${BASE}/billing/invoices/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => r.blob());
  },
};

// ─── Clinic ───────────────────────────────────────────────────────────────────

export interface ClinicProfile {
  id: string;
  name: string;
  address: string;
  gstNumber: string | null;
  logoUrl: string | null;
}

export const clinic = {
  get: () => request<ClinicProfile | null>("GET", "/clinic/me"),
  patch: (data: { name?: string; address?: string; gstNumber?: string; logoUrl?: string }) =>
    request<ClinicProfile>("PATCH", "/clinic/me", data),
};

// ─── Documents (Phase 2) ──────────────────────────────────────────────────────

export interface Document {
  id: string;
  patientId: string;
  fileName: string;
  mimeType: string;
  type: string;
  status: string;
  aiSummary: string | null;
  createdAt: string;
}

export const documents = {
  requestUploadUrl: (data: { patientId: string; fileName: string; mimeType: string; type?: string }) =>
    request<{ document: Document; uploadUrl: string }>("POST", "/documents/upload-url", data),

  confirm: (id: string) =>
    request<{ message: string; documentId: string }>("POST", `/documents/${id}/confirm`),

  list: (patientId: string) =>
    request<{ data: Document[] }>("GET", `/documents?patientId=${patientId}`),

  get: (id: string) =>
    request<Document & { readUrl: string | null }>("GET", `/documents/${id}`),

  delete: (id: string) =>
    fetch(`${BASE}/documents/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then((r) => { if (!r.ok) throw new Error("Delete failed"); }),
};

// ─── Labs ─────────────────────────────────────────────────────────────────────

export const labs = {
  createOrder: (data: { consultationId: string; tests: string[] }) =>
    request<{ id: string }>("POST", "/labs/orders", data),

  listOrders: (params: { consultationId?: string; patientId?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request("GET", `/labs/orders${qs ? `?${qs}` : ""}`);
  },
  getOrder: (id: string) => request("GET", `/labs/orders/${id}`),
};

// ─── Pharmacy ─────────────────────────────────────────────────────────────────

export const pharmacy = {
  listMedicines: (params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request("GET", `/pharmacy/medicines${qs ? `?${qs}` : ""}`);
  },
  createMedicine: (data: { name: string; genericName?: string; manufacturer?: string; form?: string; strength?: string; unit?: string }) =>
    request("POST", "/pharmacy/medicines", data),
  getInventory: () => request("GET", "/pharmacy/inventory"),
  getLowStock: () => request("GET", "/pharmacy/inventory/low-stock"),
  updateInventory: (id: string, data: { stockQuantity?: number; reorderLevel?: number; expiryDate?: string; batchNumber?: string; costPrice?: number; sellingPrice?: number }) =>
    request("PATCH", `/pharmacy/inventory/${id}`, data),
};

// ─── Prescriptions ─────────────────────────────────────────────────────────────

export const prescriptions = {
  list: (consultationId: string) =>
    request("GET", `/prescriptions?consultationId=${consultationId}`),
  get: (id: string) => request("GET", `/prescriptions/${id}`),
  downloadPdf: (id: string) => {
    const token = getToken();
    return fetch(`${BASE}/prescriptions/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => r.blob());
  },
};

// ─── Pharmacy Queue (Phase 2) ─────────────────────────────────────────────────

export interface RxQueueItem {
  id: string;
  sentAt: string | null;
  sentVia: string | null;
  status: string;
  patient: { id: string; phone: string };
  consultation: { id: string; chiefComplaint: string | null } | null;
  dispensing: Array<{
    id: string;
    quantityDispensed: number;
    medicine: { id: string; name: string };
  }>;
}

export const pharmacyQueue = {
  list: () => request<{ data: RxQueueItem[] }>("GET", "/pharmacy/queue"),
};

// ─── Telemedicine (Phase 2) ───────────────────────────────────────────────────

export const telemedicine = {
  createRoom: (consultationId: string) =>
    request<{ roomUrl: string; roomName: string }>(
      "POST", `/consultations/${consultationId}/telemedicine/room`
    ),
};

// ─── AI Insights (Phase 3) ────────────────────────────────────────────────────

export interface AiInsight {
  id: string;
  patientId: string;
  consultationId: string | null;
  documentId: string | null;
  type: string;
  content: string;
  metadata: Record<string, unknown> | null;
  doctorApproved: boolean | null;
  approvedAt: string | null;
  createdAt: string;
}

export const insights = {
  list: (params: { patientId?: string; type?: string; pending?: boolean; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<{ data: AiInsight[]; meta: { total: number; page: number; limit: number; pages: number } }>(
      "GET", `/insights?${qs}`
    );
  },

  request: (data: { patientId: string; consultationId?: string; type: string; context?: Record<string, unknown> }) =>
    request<AiInsight | { message: string }>("POST", "/insights/request", data),

  approve: (id: string, approved: boolean) =>
    request<AiInsight>("PATCH", `/insights/${id}/approve`, { approved }),

  longitudinal: (patientId: string) =>
    request<{ insight: AiInsight; cached: boolean }>("GET", `/insights/longitudinal/${patientId}`),
};

// ─── Follow-ups ──────────────────────────────────────────────────────────────

export interface FollowUp {
  id: string;
  patientId: string;
  consultationId: string | null;
  scheduledDate: string;
  reason: string;
  channel: 'sms' | 'whatsapp' | 'email';
  status: 'pending' | 'sent' | 'acknowledged' | 'cancelled';
  patientPhone?: string;
  patientName?: string;
  createdAt: string;
}

export const followups = {
  list: (params?: { status?: string; patientId?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<{ data: FollowUp[]; meta: { total: number; page: number; limit: number; pages: number } }>(
      "GET", `/followups${qs ? `?${qs}` : ""}`
    );
  },
  create: (data: { patientId: string; consultationId?: string; scheduledDate: string; reason: string; channel: string }) =>
    request<FollowUp>("POST", "/followups", data),
  update: (id: string, data: { status?: string }) =>
    request<FollowUp>("PATCH", `/followups/${id}`, data),
  delete: (id: string) =>
    request<{ message: string }>("DELETE", `/followups/${id}`),
  due: (params?: { range?: string }) => {
    const qs = params?.range ? `?range=${params.range}` : '';
    return request<{ data: FollowUp[] }>("GET", `/followups/due${qs}`);
  },
  autoGenerate: (data: { consultationId: string }) =>
    request<{ generated: FollowUp[] }>("POST", "/followups/auto-generate", data),
};

// ─── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  ip: string;
}

export const auditLog = {
  list: (params?: { action?: string; resource?: string; search?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<{ data: AuditEntry[]; meta: { total: number; page: number; limit: number; pages: number } }>(
      "GET", `/audit-log${qs ? `?${qs}` : ""}`
    );
  },
  stats: () => request<{ today: number; total: number; byAction: Record<string, number>; byResource: Record<string, number> }>(
    "GET", "/audit-log/stats"
  ),
  exportUrl: (params?: { from?: string; to?: string; action?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return `/audit-log/export${qs ? `?${qs}` : ""}`;
  },
};

// ─── ABDM v2 ─────────────────────────────────────────────────────────────────

export const abdm = {
  createAbha: (data: { patientId: string; aadhaarNumber: string }) =>
    request<{ txnId: string; message: string }>("POST", "/abdm-v2/abha/create", data),
  verifyAbhaOtp: (data: { patientId: string; txnId: string; otp: string }) =>
    request<{ success: boolean; abhaNumber: string; abhaAddress: string }>("POST", "/abdm-v2/abha/verify-otp", data),
  linkAbha: (data: { patientId: string; abhaNumber: string }) =>
    request<{ success: boolean; abhaNumber: string }>("POST", "/abdm-v2/abha/link", data),
  registerHip: () =>
    request<{ success: boolean; hipId: string }>("POST", "/abdm-v2/hip/register"),
  requestConsent: (data: { patientId: string; purpose?: string; healthInfoTypes?: string[] }) =>
    request<{ requestId: string; status: string }>("POST", "/abdm-v2/consent/request", data),
  getConsents: (patientId: string) =>
    request<Array<{ id: string; status: string; purpose: string; createdAt: string }>>("GET", `/abdm-v2/consent/${patientId}`),
  pushRecords: (data: { patientId: string; consultationId: string }) =>
    request<{ success: boolean; transactionId: string }>("POST", "/abdm-v2/records/push", data),
};

// ─── Analytics ──────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  totalPatients: number;
  totalConsultations: number;
  totalRevenue: number;
  avgConsultationDuration: number;
  topDiagnoses: { diagnosis: string; count: number }[];
  appointmentsByType: { type: string; count: number }[];
  consultationsByHour: { hour: number; count: number }[];
}

export const analytics = {
  summary: (days = 30) =>
    request<AnalyticsSummary>("GET", `/analytics/summary?days=${days}`),
};

// Unified API namespace for pages that import { api }
export const api = { auth, doctors, staff, patients, appointments, consultations, billing, clinic, documents, labs, pharmacy, prescriptions, pharmacyQueue, telemedicine, insights, followups, auditLog, abdm, analytics };
