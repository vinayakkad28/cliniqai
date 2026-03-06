/**
 * Typed API client for CliniqAI Core API.
 * All requests include the Bearer token from localStorage.
 */

const BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cliniqai_access_token");
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

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
  patchMe: (data: { name?: string; bio?: string; specialties?: string[] }) =>
    request("PATCH", "/doctors/me", data),
  getWorkingHours: () => request<WorkingHour[]>("GET", "/doctors/me/working-hours"),
  putWorkingHours: (hours: Omit<WorkingHour, "id">[]) =>
    request("PUT", "/doctors/me/working-hours", hours),
};

// ─── Patients ─────────────────────────────────────────────────────────────────

export interface Patient {
  id: string;
  phone: string;
  fhirPatientId: string;
  tags: { tag: string }[];
  createdAt: string;
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
  timeline: (id: string) => request<unknown[]>("GET", `/patients/${id}/timeline`),
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
}

export interface AppointmentListResponse {
  data: Appointment[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export const appointments = {
  list: (params?: { date?: string; status?: string; page?: number }) => {
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
