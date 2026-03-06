# CliniqAI — System Architecture

This document describes the technical architecture of CliniqAI: how services are structured, how they communicate, and why each decision was made.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Service Breakdown](#2-service-breakdown)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [Database Architecture](#4-database-architecture)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [AI Pipeline Architecture](#6-ai-pipeline-architecture)
7. [Offline Strategy](#7-offline-strategy)
8. [File Storage Strategy](#8-file-storage-strategy)
9. [Notification Architecture](#9-notification-architecture)
10. [Infrastructure & Deployment](#10-infrastructure--deployment)
11. [Security Architecture](#11-security-architecture)
12. [Tech Stack Decisions](#12-tech-stack-decisions)

---

## 1. High-Level Overview

CliniqAI is a **monorepo, microservices-adjacent platform** with a clear separation between:
- Client apps (web dashboard, doctor mobile app, patient companion app)
- Core API (business logic, auth, data persistence)
- AI services (MedGemma, voice, imaging — in Python for ML ecosystem compatibility)
- Shared FHIR data layer (Google Cloud Healthcare API as the source of truth for patient records)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│                                                                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐ │
│  │  Doctor Web App  │  │  Doctor Mobile   │  │    Patient Mobile App   │ │
│  │   (Next.js 14)   │  │  (React Native)  │  │     (React Native)      │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬────────────┘ │
└───────────┼──────────────────────┼──────────────────────────┼─────────────┘
            │                      │                          │
            └──────────────┬───────┘                          │
                           │  HTTPS / WebSocket               │  HTTPS
                           ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY LAYER                               │
│                  (Node.js + Express — port 3001)                         │
│                                                                          │
│   Auth Middleware → Rate Limiting → Request Routing → Audit Logging      │
└──────┬──────────────────────┬──────────────────────────┬─────────────────┘
       │                      │                          │
       ▼                      ▼                          ▼
┌─────────────┐   ┌──────────────────────┐   ┌────────────────────────────┐
│  Core API   │   │     AI Service       │   │   Notification Service     │
│  (Node.js)  │   │  (Python / FastAPI)  │   │   (Node.js / Bull queue)   │
│             │   │                      │   │                            │
│ - Patients  │   │ - MedGemma NLP       │   │ - SMS (MSG91)              │
│ - Appts     │   │ - Voice transcription│   │ - WhatsApp                 │
│ - Billing   │   │ - DDI alerts         │   │ - Push (FCM)               │
│ - Pharmacy  │   │ - CXR analysis       │   │ - Email (Resend)           │
│ - Reports   │   │ - Lab interpretation │   │                            │
└──────┬──────┘   └──────────┬───────────┘   └────────────────────────────┘
       │                     │
       ▼                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                      │
│                                                                          │
│  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐│
│  │  PostgreSQL 15   │  │  Redis 7         │  │  Google Cloud            ││
│  │  (operational    │  │  (sessions,      │  │  Healthcare API          ││
│  │   data: doctors, │  │   rate limits,   │  │  (FHIR R4 — patient      ││
│  │   billing, appts)│  │   queues, cache) │  │   clinical records)      ││
│  └──────────────────┘  └─────────────────┘  └──────────────────────────┘│
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │  Google Cloud Storage (medical images, PDFs, X-rays, lab reports)   ││
│  └──────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Breakdown

### 2.1 Core API (`services/api`)
**Runtime:** Node.js 20 + Express
**Responsibility:** All business logic that is not AI-specific

| Router Module | Responsibility |
|--------------|----------------|
| `auth`       | Doctor registration, login, JWT issuance, refresh tokens |
| `doctors`    | Doctor profiles, clinic settings, working hours |
| `patients`   | Patient CRUD, demographics, deduplication |
| `appointments` | Scheduling, calendar, walk-in queue |
| `consultations` | Consultation sessions, linking to FHIR Encounters |
| `prescriptions` | Write, update, send digital prescriptions |
| `billing`    | Invoice creation, payment status, revenue reports |
| `pharmacy`   | Inventory CRUD, low-stock alerts |
| `labs`       | Test orders, result uploads, partner lab webhooks |
| `notifications` | Enqueue SMS/WhatsApp/push jobs |
| `admin`      | Multi-doctor clinic management, role assignments |

### 2.2 AI Service (`services/ai`)
**Runtime:** Python 3.11 + FastAPI
**Responsibility:** All ML/AI inference — kept separate so it can scale independently and use Python's ML ecosystem

| Endpoint | Model Used | Description |
|----------|-----------|-------------|
| `POST /voice/transcribe` | MedASR | Voice audio → structured prescription JSON |
| `POST /prescription/assist` | MedGemma 4B | Symptoms + history → prescription suggestions |
| `POST /ddi/check` | MedGemma 4B + DDI DB | Drug list → interaction alerts |
| `POST /diagnosis/suggest` | MedGemma 27B | Symptoms → differential diagnosis list |
| `POST /notes/summarize` | MedGemma 27B | Unstructured notes → structured summary |
| `POST /imaging/cxr` | CXR Foundation | Chest X-ray image → preliminary report |
| `POST /imaging/analyze` | MedSigLIP | Dermatology/wound image → analysis notes |
| `POST /lab/interpret` | MedGemma 4B | Lab result values → plain-language explanation |
| `POST /records/search` | Vertex AI Healthcare Search | Natural language query → FHIR resources |
| `POST /discharge/draft` | MedGemma 27B | IPD encounter data → discharge summary draft |

### 2.3 FHIR Service (`services/fhir`)
**Runtime:** Node.js 20 (thin wrapper around Google Healthcare API)
**Responsibility:** All reads/writes to Google Cloud Healthcare API (FHIR R4)

This service is a dedicated adapter — no business logic lives here. It:
- Translates internal domain objects → FHIR Resources
- Translates FHIR Resources → internal domain objects
- Manages FHIR versioning and resource references
- Handles FHIR bundles for bulk operations

### 2.4 Notification Service (`services/notifications`)
**Runtime:** Node.js + Bull (Redis-backed queue)
**Responsibility:** Async delivery of all outbound communications

Queue names:
- `sms.otp` — OTP messages (high priority)
- `sms.reminder` — Appointment reminders
- `whatsapp.prescription` — Send prescription PDF via WhatsApp
- `push.alert` — Push notifications
- `email.receipt` — Billing email receipts

---

## 3. Data Flow Diagrams

### 3.1 Doctor Writes a Prescription (AI-Assisted)

```
Doctor (Voice Input)
        │
        ▼
  Mobile App records audio
        │
        ▼
  POST /ai/voice/transcribe ──────► AI Service (MedASR)
                                          │
                                    Transcribed text
                                          │
                            POST /ai/prescription/assist
                                          │
                                    MedGemma 4B
                                          │
                               Structured Rx JSON
                                   ┌──────┴──────┐
                                   │             │
                           DDI Check             Display to Doctor
                      (MedGemma 4B)              for review/edit
                                   │
                              Alerts (if any)
                                   │
                       Doctor confirms → saves
                                   │
                          POST /api/prescriptions
                                   │
                          ┌────────┴────────┐
                          │                 │
                    PostgreSQL          FHIR Store
                  (operational)    (MedicationRequest
                                      Resource)
                                         │
                                 Notification enqueued
                                         │
                              WhatsApp / SMS → Patient
```

### 3.2 Patient Record Lookup (Natural Language)

```
Doctor types: "Does this patient have a history of diabetes?"
        │
        ▼
  POST /ai/records/search
  { query: "diabetes history", patient_id: "P123" }
        │
        ▼
  AI Service → Vertex AI Search for Healthcare
        │
        ▼
  FHIR Store queried (Conditions, Observations, Encounters)
        │
        ▼
  Ranked FHIR resources returned
        │
        ▼
  MedGemma 27B summarizes results into readable paragraph
        │
        ▼
  Displayed inline in consultation screen
```

---

## 4. Database Architecture

### 4.1 Dual-Store Strategy

CliniqAI uses **two data stores** with distinct roles:

| Store | What Goes Here | Why |
|-------|---------------|-----|
| **PostgreSQL** | Operational data: doctor profiles, billing, appointments, pharmacy inventory, clinic config, users | Relational, transactional, fast for operational queries |
| **FHIR Store (GCP Healthcare API)** | Clinical records: Patient demographics (canonical), Encounters, Prescriptions (MedicationRequests), Lab results (DiagnosticReports), Observations, Conditions | FHIR R4 standard, interoperable, patient-owned data |

### 4.2 Key Rule: No Clinical Duplication

- Clinical data (diagnoses, prescriptions, observations) is written **only to FHIR**.
- PostgreSQL stores a reference (`fhir_resource_id`) pointing to the FHIR resource.
- Billing, scheduling, and operational data live **only in PostgreSQL**.

### 4.3 PostgreSQL Schema Groups

```
cliniqai (database)
│
├── auth
│   ├── users              (id, email, phone, password_hash, role, created_at)
│   ├── refresh_tokens     (id, user_id, token_hash, expires_at)
│   └── otp_codes          (id, phone, code_hash, expires_at, used)
│
├── clinic
│   ├── doctors            (id, user_id, name, specialties[], license_number, bio)
│   ├── clinics            (id, name, address, gst_number, logo_url)
│   ├── clinic_doctors     (clinic_id, doctor_id, role)
│   └── working_hours      (doctor_id, day_of_week, start_time, end_time, slot_duration_mins)
│
├── patients
│   ├── patients           (id, fhir_patient_id, phone, created_by_doctor_id, created_at)
│   └── patient_tags       (patient_id, tag)           -- e.g. "diabetic", "hypertensive"
│
├── appointments
│   ├── appointments       (id, patient_id, doctor_id, scheduled_at, status, type, notes)
│   └── appointment_queue  (id, clinic_id, patient_id, token_number, arrived_at, status)
│
├── consultations
│   └── consultations      (id, appointment_id, doctor_id, patient_id, fhir_encounter_id,
│                           started_at, ended_at, chief_complaint, notes, status)
│
├── prescriptions
│   └── prescriptions      (id, consultation_id, patient_id, doctor_id, fhir_medication_request_id,
│                           sent_via, sent_at, pdf_url, status)
│
├── billing
│   ├── invoices           (id, consultation_id, patient_id, doctor_id, amount, gst_amount,
│                           total, status, paid_at, payment_method)
│   └── payment_methods    (id, invoice_id, provider, transaction_id, amount)
│
├── pharmacy
│   ├── medicines          (id, name, generic_name, manufacturer, form, strength, unit)
│   ├── inventory          (id, clinic_id, medicine_id, stock_quantity, reorder_level,
│                           expiry_date, batch_number, cost_price, selling_price)
│   └── dispensing         (id, prescription_id, medicine_id, quantity_dispensed, dispensed_at)
│
└── labs
    ├── lab_orders         (id, consultation_id, patient_id, tests[], status, fhir_service_request_id)
    └── lab_results        (id, lab_order_id, fhir_diagnostic_report_id, result_file_url,
                            uploaded_at, ai_summary)
```

---

## 5. Authentication & Authorization

### 5.1 Auth Flow

```
Doctor registers / logs in
        │
        ▼
  Phone OTP (MSG91) or Email/Password
        │
        ▼
  Core API verifies OTP / password
        │
        ▼
  Issues: accessToken (JWT, 7d) + refreshToken (JWT, 30d, stored in DB)
        │
        ▼
  Client stores both in secure storage (Keychain/Keystore on mobile, httpOnly cookie on web)
        │
        ▼
  All API calls: Authorization: Bearer <accessToken>
        │
        ▼
  Auth middleware validates JWT, attaches req.user
        │
        ▼
  Role/scope middleware checks permissions
```

### 5.2 JWT Payload Structure

```json
{
  "sub": "doctor_uuid",
  "role": "doctor",
  "clinic_id": "clinic_uuid",
  "scope": ["patients:read", "patients:write", "prescriptions:write", "billing:read"],
  "iat": 1700000000,
  "exp": 1700604800
}
```

### 5.3 Role Definitions

| Role | Scope |
|------|-------|
| `doctor` | Full access to all clinical features |
| `nurse` | patients:read, appointments:write, vitals:write |
| `admin` | billing:*, pharmacy:*, reports:*, no clinical access |
| `receptionist` | appointments:*, patients:read |
| `patient` | own_records:read, appointments:book |

---

## 6. AI Pipeline Architecture

### 6.1 Synchronous vs. Asynchronous AI Calls

| AI Feature | Mode | Latency Budget | Why |
|-----------|------|----------------|-----|
| DDI Alerts | Sync | < 2s | Blocks prescription save — must be real-time |
| Prescription assist | Sync | < 3s | Doctor waiting for suggestions |
| Voice transcription | Async (streaming) | < 5s | Streamed tokens back to UI |
| Diagnosis hints | Sync | < 4s | Inline suggestion during consultation |
| CXR analysis | Async (job) | < 30s | Doctor submits, result arrives later |
| Lab interpretation | Async (job) | < 10s | Non-blocking, shown when ready |
| Notes summarization | Async (job) | < 15s | Pre-consultation prep, not real-time |
| Discharge summary | Async (job) | < 20s | Doctor reviews and edits before saving |

### 6.2 AI Service Request Authentication

All AI service requests from the Core API include:
- Internal service-to-service auth header: `X-Internal-Token: <shared-secret>`
- Never exposed to clients
- AI service validates this header before processing

### 6.3 Fallback Strategy

If the AI service is unavailable or times out:
- DDI alerts: Fall back to local drug interaction DB (pre-loaded SQLite)
- Prescription assist: Show empty template, let doctor fill manually
- Voice transcription: Display raw transcript without structuring
- All fallbacks are logged to Sentry with `ai.fallback` tag

---

## 7. Offline Strategy

### 7.1 Mobile (Android) — FHIR SDK Offline

Uses **Google Open Health Stack Android FHIR SDK** which provides:
- Local FHIR R4 resource store (SQLite-backed)
- Offline-capable patient CRUD
- Prescription creation without connectivity
- Conflict resolution on sync

```
Mobile App (Offline)
        │
        ▼
  Android FHIR SDK (local SQLite FHIR store)
        │
  ┌─────┴──────────────┐
  │  Online?            │
  │  Yes → sync to      │
  │  Cloud Healthcare   │
  │  API immediately   │
  │                     │
  │  No → queue writes, │
  │  sync when online  │
  └────────────────────┘
```

### 7.2 Web (Progressive Web App)
- Service Worker caches app shell and last 50 patients
- IndexedDB stores pending writes
- Shows "Offline Mode" banner with sync status
- Syncs on reconnect via background sync API

---

## 8. File Storage Strategy

All files stored in **Google Cloud Storage** with these buckets:

| Bucket | Contents | Access | Retention |
|--------|---------|--------|-----------|
| `cliniqai-prescriptions` | Generated prescription PDFs | Signed URL (24h expiry) | 10 years |
| `cliniqai-medical-images` | X-rays, lab reports, photos | Signed URL (1h expiry) | 10 years |
| `cliniqai-documents` | Patient-uploaded documents | Signed URL (1h expiry) | 10 years |
| `cliniqai-exports` | CSV/PDF report exports | Signed URL (15min expiry) | 7 days |
| `cliniqai-backups` | Database backups | No public access | 90 days |

All buckets:
- AES-256 encryption at rest (Google-managed keys)
- Object versioning enabled
- Lifecycle rules to move to Coldline after 1 year

---

## 9. Notification Architecture

```
Event occurs (e.g. appointment booked)
        │
        ▼
  Core API publishes to Redis queue
  { type: "appointment.reminder", payload: { ... }, send_at: "2024-01-01T09:00:00Z" }
        │
        ▼
  Notification Worker (Bull) picks up job
        │
        ├── SMS → MSG91 API
        ├── WhatsApp → MSG91 WhatsApp API
        ├── Push → Firebase Cloud Messaging (FCM)
        └── Email → Resend API
        │
  Delivery status written back to PostgreSQL
  (notifications table: id, type, recipient, status, sent_at, provider_message_id)
```

### Notification Templates

All templates are stored in `services/notifications/templates/`:
- `appointment-reminder.{sms,whatsapp}.{en,hi,ta,te,kn}.hbs` — Handlebars templates per language
- Template variables: `{{ patient_name }}`, `{{ doctor_name }}`, `{{ appointment_time }}`, `{{ clinic_name }}`

---

## 10. Infrastructure & Deployment

### 10.1 Google Cloud Services Used

| Service | Used For |
|---------|---------|
| **Cloud Run** | Core API, AI Service, Notification Service (containerized, auto-scaling) |
| **Cloud SQL (PostgreSQL 15)** | Operational database with private IP, automated backups |
| **Cloud Healthcare API** | FHIR R4 store |
| **Cloud Storage** | Files, images, exports |
| **Vertex AI** | MedGemma model serving |
| **Cloud Pub/Sub** | Async event bus (lab result webhooks, inter-service events) |
| **Secret Manager** | All credentials and API keys |
| **Cloud CDN + Load Balancer** | Web app and API traffic distribution |
| **Cloud Armor** | WAF, DDoS protection |
| **Firebase Auth** | Web and mobile authentication |
| **Firebase Cloud Messaging** | Push notifications |
| **Cloud Monitoring + Logging** | Metrics, logs, alerting |

### 10.2 Deployment Environments

| Env | Branch | Domain | Purpose |
|-----|--------|--------|---------|
| `development` | `main` (local) | localhost | Local dev |
| `staging` | `staging` | staging.cliniqai.com | QA + integration testing |
| `production` | `prod` | app.cliniqai.com | Live users |

### 10.3 CI/CD Pipeline (Cloud Build)

```
Git push to staging / prod branch
        │
        ▼
  Cloud Build trigger fires
        │
        ▼
  1. Run tests (Jest + Pytest)
  2. Run ESLint + type-check
  3. Build Docker images
  4. Push to Artifact Registry
  5. Deploy to Cloud Run (zero-downtime rolling deploy)
  6. Run smoke tests
  7. Notify Slack on success/failure
```

---

## 11. Security Architecture

### 11.1 Defense Layers

```
Internet
    │
Cloud Armor (WAF + DDoS)
    │
Cloud Load Balancer (TLS termination)
    │
Cloud Run (Core API)
    │   ├── JWT auth middleware
    │   ├── Rate limiter (100 req/min per IP, 1000 req/min per doctor)
    │   ├── Input validation (Zod schemas on all endpoints)
    │   └── Audit logger (every request logged with user + IP)
    │
PostgreSQL (VPC-only, private IP, no public access)
FHIR Store (GCP Healthcare API, IAM-controlled)
Cloud Storage (IAM + signed URLs, no public buckets)
```

### 11.2 Patient Data Handling Rules

1. **No PHI in logs** — Middleware strips patient names, phone numbers, diagnoses from all log lines before writing
2. **No PHI in URLs** — Patient IDs are UUIDs, never names or phone numbers
3. **Signed URLs only** — Medical files are never served from public URLs
4. **Audit trail** — Every read/write of a patient record is logged: `{ doctor_id, patient_id, action, timestamp, ip }`
5. **Data residency** — All India patient data in `asia-south1` region

### 11.3 Encryption

| Data | Encryption |
|------|-----------|
| Database (at rest) | AES-256 (Cloud SQL manages keys) |
| Files (at rest) | AES-256 (Cloud Storage manages keys) |
| Data in transit | TLS 1.3 minimum |
| JWT tokens | HS256 (symmetric) with 256-bit secret |
| Sensitive DB fields (phone, national ID) | AES-256-GCM at application level before storage |

---

## 12. Tech Stack Decisions

### Why Node.js for Core API?
- Large ecosystem for REST API development (Express, Prisma, Zod)
- Same language as frontend (TypeScript throughout) reduces context switching
- Excellent async I/O performance for an API-heavy application
- Strong FHIR client libraries available

### Why Python for AI Service?
- Google's MedGemma SDK, Vertex AI Python SDK, and all ML libraries are Python-native
- Avoids bridging complexity of calling Python ML from Node
- Can be independently scaled and deployed from Core API
- FastAPI gives OpenAPI docs automatically — useful for AI endpoint documentation

### Why Next.js for Web?
- Server-side rendering for faster initial load (critical for clinic dashboards)
- App Router with Server Components reduces client-side JS
- Excellent TypeScript support
- API Routes for lightweight BFF (Backend For Frontend) pattern if needed

### Why React Native for Mobile?
- Single codebase for iOS and Android
- Large community, mature ecosystem
- Works well with FHIR SDK wrappers
- Allows sharing component library with web (React Native Web)

### Why FHIR R4?
- Industry standard for medical data interoperability
- Google Cloud Healthcare API natively supports FHIR R4
- Patients can take their data to any FHIR-compatible system
- Open Health Stack (Android FHIR SDK) provides offline support out of the box

### Why PostgreSQL over MongoDB?
- Patient-doctor relationships, billing, appointments are inherently relational
- ACID transactions essential for billing accuracy
- Strong support in Prisma ORM
- Easier to audit and query for compliance reporting

### Why Separate FHIR Store and PostgreSQL?
- FHIR store is the canonical home for clinical records (prescriptions, diagnoses, lab results)
- PostgreSQL handles operational/non-clinical data (billing, inventory, scheduling)
- Keeps clinical data in a compliant, interoperable store without polluting it with billing tables
- If we ever need to export patient records to another system, FHIR store is the clean source

---

*Last updated: Phase 1 setup*
*See [DATA_MODEL.md](DATA_MODEL.md) for detailed FHIR resource schemas and PostgreSQL table definitions.*
