# CliniqAI — API Reference

This document defines the REST API conventions, authentication, and all endpoint specifications for the Core API (`services/api`).

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Standard Response Shapes](#3-standard-response-shapes)
4. [Error Codes](#4-error-codes)
5. [Endpoints by Module](#5-endpoints-by-module)
   - [Auth](#51-auth)
   - [Doctors](#52-doctors)
   - [Clinics](#53-clinics)
   - [Patients](#54-patients)
   - [Appointments](#55-appointments)
   - [Consultations](#56-consultations)
   - [Prescriptions](#57-prescriptions)
   - [Billing](#58-billing)
   - [Pharmacy](#59-pharmacy)
   - [Labs](#510-labs)
   - [Analytics](#511-analytics)
   - [Notifications](#512-notifications)
6. [Pagination](#6-pagination)
7. [Rate Limiting](#7-rate-limiting)
8. [Versioning](#8-versioning)

---

## 1. Conventions

| Convention | Value |
|-----------|-------|
| Base URL | `https://api.cliniqai.com/v1` |
| Protocol | HTTPS only (HTTP redirects to HTTPS) |
| Format | JSON (`Content-Type: application/json`) |
| Timestamps | ISO 8601 UTC (`2024-01-15T10:30:00Z`) |
| IDs | UUID v4 strings |
| Phone numbers | E.164 format (`+919876543210`) |
| Currency | Amount in paise/cents as integer (₹100.50 → `10050`) |
| Nulls | Omitted from responses (not `null`) |
| Enums | snake_case strings |

---

## 2. Authentication

All endpoints (except `/auth/*`) require a valid JWT in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Token Lifecycle

```
POST /auth/send-otp        → Send OTP to doctor's phone
POST /auth/verify-otp      → Verify OTP → returns access_token + refresh_token
POST /auth/refresh          → Exchange refresh_token → new access_token
POST /auth/logout           → Revoke refresh token
```

Access token: valid **7 days**
Refresh token: valid **30 days**

---

## 3. Standard Response Shapes

### Success

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 142
  }
}
```

`meta` is only present for paginated list endpoints.

### Error

```json
{
  "success": false,
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "Patient with ID abc123 not found",
    "field": "patient_id"
  }
}
```

---

## 4. Error Codes

| HTTP Status | Code | Meaning |
|------------|------|---------|
| 400 | `VALIDATION_ERROR` | Request body/params failed validation |
| 400 | `INVALID_OTP` | OTP is wrong or expired |
| 401 | `UNAUTHORIZED` | Missing or invalid auth token |
| 401 | `TOKEN_EXPIRED` | Access token expired — refresh it |
| 403 | `FORBIDDEN` | Authenticated but insufficient role/scope |
| 404 | `NOT_FOUND` | Resource does not exist |
| 404 | `PATIENT_NOT_FOUND` | Specific patient not found |
| 404 | `DOCTOR_NOT_FOUND` | Specific doctor not found |
| 409 | `DUPLICATE` | Resource already exists (e.g. duplicate phone) |
| 409 | `SLOT_TAKEN` | Appointment slot already booked |
| 422 | `DDI_CRITICAL` | Prescription has critical drug interaction |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `AI_UNAVAILABLE` | AI service is temporarily unavailable (non-blocking features degraded) |

---

## 5. Endpoints by Module

---

### 5.1 Auth

#### `POST /auth/send-otp`
Send OTP to a phone number.

**Request:**
```json
{
  "phone": "+919876543210",
  "purpose": "login"
}
```
`purpose`: `registration` | `login` | `reset`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "otp_expires_in": 300,
    "masked_phone": "+91987****210"
  }
}
```

---

#### `POST /auth/verify-otp`
Verify OTP and issue tokens.

**Request:**
```json
{
  "phone": "+919876543210",
  "otp": "482910",
  "purpose": "login"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 604800,
    "user": {
      "id": "uuid",
      "role": "doctor",
      "is_onboarded": true
    }
  }
}
```

---

#### `POST /auth/refresh`
**Request:**
```json
{ "refresh_token": "eyJ..." }
```
**Response `200`:** Same shape as verify-otp but without `refresh_token`.

---

#### `POST /auth/logout`
**Request:** `{}` (uses Authorization header)
**Response `200`:** `{ "success": true }`

---

### 5.2 Doctors

#### `GET /doctors/me`
Get the authenticated doctor's profile.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "full_name": "Dr. Priya Nair",
    "specialties": ["general_physician", "diabetologist"],
    "license_number": "MH-12345",
    "qualification": "MBBS, MD",
    "bio": "...",
    "profile_photo": "https://storage.cliniqai.com/photos/uuid.jpg",
    "languages": ["en", "hi", "ml"],
    "years_of_exp": 8,
    "clinics": [
      {
        "id": "clinic-uuid",
        "name": "Nair Clinic",
        "role": "owner"
      }
    ]
  }
}
```

---

#### `PATCH /doctors/me`
Update doctor profile.

**Request:** Any subset of doctor fields:
```json
{
  "bio": "General physician with 8 years of experience.",
  "languages": ["en", "hi", "ml"],
  "signature_url": "https://storage.cliniqai.com/sigs/uuid.png"
}
```

---

#### `GET /doctors/me/working-hours`
**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "day_of_week": 1,
      "day_name": "Monday",
      "start_time": "09:00",
      "end_time": "13:00",
      "slot_duration_mins": 15,
      "max_patients": 20,
      "is_active": true
    }
  ]
}
```

---

#### `PUT /doctors/me/working-hours`
Replace all working hours for the doctor.

**Request:**
```json
{
  "clinic_id": "clinic-uuid",
  "hours": [
    {
      "day_of_week": 1,
      "start_time": "09:00",
      "end_time": "13:00",
      "slot_duration_mins": 15
    }
  ]
}
```

---

### 5.3 Clinics

#### `POST /clinics`
Create a new clinic (first-time setup).

**Request:**
```json
{
  "name": "Nair Family Clinic",
  "address_line1": "45, 2nd Cross, Koramangala",
  "city": "Bengaluru",
  "state": "Karnataka",
  "pincode": "560034",
  "phone": "+918022334455",
  "gst_number": "29ABCDE1234F1Z5"
}
```

---

#### `GET /clinics/:clinic_id`
Get clinic details. Requires membership in the clinic.

---

#### `PATCH /clinics/:clinic_id`
Update clinic details. Requires `owner` role.

---

#### `GET /clinics/:clinic_id/members`
List all doctors/staff in a clinic.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "doctor_id": "uuid",
      "full_name": "Dr. Priya Nair",
      "role": "owner",
      "specialties": ["general_physician"],
      "joined_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### 5.4 Patients

#### `POST /patients`
Register a new patient.

**Request:**
```json
{
  "phone": "+919876543210",
  "full_name": "Rajesh Sharma",
  "date_of_birth": "1985-06-20",
  "gender": "male",
  "address": {
    "line1": "123, MG Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560001"
  },
  "blood_group": "B+",
  "preferred_language": "kn",
  "emergency_contact": "+919876543211"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "patient_number": "P-20240001",
    "fhir_patient_id": "fhir-uuid",
    "full_name": "Rajesh Sharma",
    "phone": "+919876543210",
    "age": 38,
    "gender": "male"
  }
}
```

---

#### `GET /patients`
List/search patients for the authenticated doctor's clinic.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search by name or phone |
| `page` | int | Page number (default: 1) |
| `per_page` | int | Results per page (max: 50, default: 20) |
| `tag` | string | Filter by tag (e.g. `diabetic`) |

---

#### `GET /patients/:patient_id`
Get full patient profile including FHIR-sourced history summary.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "patient_number": "P-20240001",
    "full_name": "Rajesh Sharma",
    "age": 38,
    "gender": "male",
    "blood_group": "B+",
    "preferred_language": "kn",
    "tags": ["diabetic", "hypertensive"],
    "visit_count": 12,
    "last_visit": "2024-01-10T10:00:00Z",
    "allergies": ["Penicillin"],
    "active_conditions": ["Type 2 Diabetes", "Hypertension"],
    "current_medications": ["Metformin 500mg", "Amlodipine 5mg"],
    "recent_visits": [...]
  }
}
```

---

#### `GET /patients/:patient_id/timeline`
Chronological timeline of all clinical events.

**Query params:** `from_date`, `to_date`, `type` (consultation|prescription|lab|vital)

---

#### `PATCH /patients/:patient_id`
Update patient demographic information.

---

#### `POST /patients/:patient_id/tags`
Add a tag to a patient.
**Request:** `{ "tag": "diabetic" }`

---

#### `DELETE /patients/:patient_id/tags/:tag`
Remove a tag.

---

### 5.5 Appointments

#### `POST /appointments`
Book an appointment.

**Request:**
```json
{
  "patient_id": "uuid",
  "doctor_id": "uuid",
  "clinic_id": "uuid",
  "scheduled_at": "2024-01-20T10:00:00Z",
  "type": "in_person",
  "chief_complaint": "Fever and headache for 2 days"
}
```

---

#### `GET /appointments`
List appointments for the authenticated doctor.

**Query params:**
| Param | Description |
|-------|-------------|
| `date` | Filter by date (`2024-01-20`) |
| `status` | Filter by status |
| `patient_id` | Filter by patient |

---

#### `PATCH /appointments/:appointment_id`
Update appointment (reschedule, cancel, update status).

**Request:**
```json
{
  "status": "cancelled",
  "cancel_reason": "Patient requested cancellation"
}
```

---

#### `GET /appointments/slots`
Get available time slots for booking.

**Query params:** `doctor_id`, `clinic_id`, `date`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-20",
    "slots": [
      { "time": "09:00", "available": true },
      { "time": "09:15", "available": false },
      { "time": "09:30", "available": true }
    ]
  }
}
```

---

#### `GET /appointments/queue`
Get current walk-in queue for a clinic.

**Query params:** `clinic_id`, `doctor_id`, `date`

---

#### `POST /appointments/queue/next`
Call next patient from queue (updates status to `called`).

---

### 5.6 Consultations

#### `POST /consultations`
Start a new consultation (creates FHIR Encounter).

**Request:**
```json
{
  "appointment_id": "uuid",
  "patient_id": "uuid",
  "chief_complaint": "Fever and headache"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fhir_encounter_id": "fhir-uuid",
    "patient": { ... },
    "ai_pre_summary": "Patient has Type 2 Diabetes and Hypertension. Last HbA1c was 7.8% (3 months ago). Current medications: Metformin 500mg, Amlodipine 5mg.",
    "allergies": ["Penicillin"],
    "started_at": "2024-01-20T10:00:00Z"
  }
}
```

---

#### `POST /consultations/:consultation_id/vitals`
Record vitals during consultation (creates FHIR Observations).

**Request:**
```json
{
  "blood_pressure": { "systolic": 128, "diastolic": 82 },
  "heart_rate": 78,
  "temperature": 99.1,
  "spo2": 98,
  "weight_kg": 72,
  "height_cm": 168
}
```

---

#### `POST /consultations/:consultation_id/diagnoses`
Add a diagnosis (creates FHIR Condition).

**Request:**
```json
{
  "icd10_code": "J06.9",
  "name": "Acute upper respiratory infection",
  "status": "active",
  "onset_date": "2024-01-18"
}
```

---

#### `PATCH /consultations/:consultation_id`
Update consultation notes or mark complete.

**Request:**
```json
{
  "notes": "Patient presented with URTI symptoms...",
  "status": "completed"
}
```

---

#### `POST /consultations/:consultation_id/ai-assist`
Get AI clinical decision support for the current consultation.

**Request:**
```json
{
  "symptoms": ["fever", "headache", "sore throat"],
  "duration_days": 2
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "suggested_diagnoses": [...],
    "suggested_medications": [...],
    "red_flags": [],
    "follow_up_advice": "Return if fever persists beyond 5 days or worsens.",
    "ai_assisted": true
  }
}
```

---

### 5.7 Prescriptions

#### `POST /prescriptions`
Create a prescription (links to FHIR MedicationRequests).

**Request:**
```json
{
  "consultation_id": "uuid",
  "language": "kn",
  "medications": [
    {
      "name": "Amoxicillin 500mg",
      "generic_name": "Amoxicillin",
      "dosage": "500mg",
      "frequency": "thrice_daily",
      "duration": "7 days",
      "route": "oral",
      "instructions": "After meals. Complete full course.",
      "quantity": 21
    }
  ],
  "diagnoses": ["J06.9"],
  "follow_up_date": "2024-01-27",
  "doctor_notes": "Rest and fluids. Avoid cold food.",
  "ai_assisted": true
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "prescription_number": "RX-20240120-001",
    "pdf_url": "https://storage.cliniqai.com/prescriptions/uuid.pdf",
    "ddi_alerts": [],
    "allergy_alerts": []
  }
}
```

---

#### `POST /prescriptions/:prescription_id/send`
Send prescription to patient.

**Request:**
```json
{
  "method": "whatsapp",
  "phone": "+919876543210"
}
```

---

#### `POST /prescriptions/voice-assist`
Convert voice audio to a structured prescription draft.

**Request:** `multipart/form-data`
- `audio`: audio file (WEBM/WAV, max 60s)
- `specialty`: doctor's specialty string

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "transcript": "Patient has fever and cough for 3 days. Prescribing Paracetamol...",
    "structured": {
      "chief_complaint": "Fever and cough",
      "diagnoses": [...],
      "medications": [...],
      "follow_up": "5 days"
    }
  }
}
```

---

#### `POST /prescriptions/ddi-check`
Check drug interactions before saving a prescription.

**Request:**
```json
{
  "new_medication": "Warfarin 5mg",
  "current_medications": ["Aspirin 75mg", "Metformin 500mg"],
  "patient_id": "uuid"
}
```

---

### 5.8 Billing

#### `POST /billing/invoices`
Create an invoice for a consultation.

**Request:**
```json
{
  "consultation_id": "uuid",
  "line_items": [
    { "description": "Consultation Fee", "quantity": 1, "unit_price": 50000 },
    { "description": "ECG", "quantity": 1, "unit_price": 30000 }
  ],
  "gst_rate": 0,
  "discount_amount": 0
}
```

`unit_price` in paise (₹500.00 = 50000).

---

#### `GET /billing/invoices`
List invoices for clinic.

**Query params:** `status`, `from_date`, `to_date`, `patient_id`

---

#### `GET /billing/invoices/:invoice_id`
Get invoice details + PDF URL.

---

#### `POST /billing/invoices/:invoice_id/payment`
Record a payment.

**Request:**
```json
{
  "amount": 80000,
  "method": "upi",
  "transaction_id": "UPI-REF-12345"
}
```

---

#### `GET /billing/revenue`
Revenue analytics summary.

**Query params:** `period` (`today` | `week` | `month` | `year`), `clinic_id`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "total_revenue": 12500000,
    "total_consultations": 210,
    "avg_revenue_per_consultation": 59524,
    "new_patients": 38,
    "returning_patients": 172,
    "collection_rate": 0.94,
    "by_day": [
      { "date": "2024-01-01", "revenue": 450000, "consultations": 8 }
    ]
  }
}
```

---

### 5.9 Pharmacy

#### `GET /pharmacy/inventory`
List medicine inventory for a clinic.

**Query params:** `low_stock=true`, `expiring_within_days=30`, `q` (search by name)

---

#### `POST /pharmacy/inventory`
Add a medicine to inventory.

**Request:**
```json
{
  "medicine_id": "uuid",
  "batch_number": "B2024001",
  "expiry_date": "2026-06-30",
  "stock_quantity": 500,
  "reorder_level": 50,
  "cost_price": 250,
  "selling_price": 400
}
```

---

#### `PATCH /pharmacy/inventory/:inventory_id`
Update stock levels or prices.

---

#### `GET /pharmacy/medicines/search`
Search medicines database by name.

**Query params:** `q`, `generic=true`

---

### 5.10 Labs

#### `POST /labs/orders`
Create a lab test order.

**Request:**
```json
{
  "consultation_id": "uuid",
  "tests": ["CBC", "LFT", "HbA1c", "Fasting Blood Glucose"],
  "lab_partner": "Metropolis",
  "notes": "Fasting sample required"
}
```

---

#### `POST /labs/orders/:order_id/results`
Upload lab results.

**Request:** `multipart/form-data`
- `report`: PDF or image file
- `ai_interpret=true`: trigger MedGemma interpretation

---

#### `GET /labs/orders/:order_id/results`
Get lab results with AI interpretation.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "tests": ["CBC", "LFT"],
    "result_file_url": "https://storage.cliniqai.com/labs/uuid.pdf",
    "ai_summary": "CBC shows mild anaemia (Hb: 10.2 g/dL, normal: 12-16 g/dL for females). LFT within normal limits. No signs of liver dysfunction.",
    "uploaded_at": "2024-01-16T14:00:00Z"
  }
}
```

---

### 5.11 Analytics

#### `GET /analytics/overview`
Practice performance overview.

**Query params:** `clinic_id`, `period`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "patients_today": 18,
    "patients_this_month": 210,
    "revenue_today": 54000,
    "revenue_this_month": 12500000,
    "new_patients_this_month": 38,
    "no_show_rate": 0.06,
    "top_diagnoses": [
      { "name": "Upper Respiratory Tract Infection", "count": 42 },
      { "name": "Type 2 Diabetes", "count": 31 }
    ],
    "top_medicines": [
      { "name": "Paracetamol 500mg", "count": 78 }
    ]
  }
}
```

---

### 5.12 Notifications

#### `GET /notifications/preferences`
Get notification preferences for the clinic.

---

#### `PUT /notifications/preferences`
Update notification preferences.

**Request:**
```json
{
  "appointment_reminder_hours": [24, 1],
  "channels": ["whatsapp", "sms"],
  "prescription_send_default": "whatsapp"
}
```

---

## 6. Pagination

All list endpoints support cursor-based pagination:

**Request:** `?page=2&per_page=20`

**Response meta:**
```json
{
  "meta": {
    "page": 2,
    "per_page": 20,
    "total": 142,
    "total_pages": 8,
    "has_next": true,
    "has_prev": true
  }
}
```

---

## 7. Rate Limiting

Rate limits are per-doctor (by JWT sub) and per-IP.

| Endpoint Group | Limit |
|---------------|-------|
| Auth (`/auth/*`) | 10 req/min per IP |
| AI endpoints (`*/ai-assist`, `*/voice-assist`, `*/ddi-check`) | 60 req/min per doctor |
| Patient writes | 120 req/min per doctor |
| All other reads | 300 req/min per doctor |

Headers returned on every response:
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 247
X-RateLimit-Reset: 1705315260
```

When rate limited, returns `HTTP 429` with `Retry-After` header.

---

## 8. Versioning

The API is versioned via URL prefix: `/v1/`, `/v2/`, etc.

- **Breaking changes** (removed fields, changed types, new required fields) → new major version
- **Additive changes** (new optional fields, new endpoints) → no version bump
- Old versions supported for minimum **12 months** after a new version ships
- Deprecation notices returned in `X-API-Deprecation` header

---

*Last updated: Phase 1 setup*
*For AI-specific internal endpoints, see [AI_INTEGRATIONS.md](../ai/AI_INTEGRATIONS.md).*
