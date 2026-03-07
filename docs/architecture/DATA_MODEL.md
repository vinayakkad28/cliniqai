# CliniqAI — Data Model

This document defines all data structures: FHIR R4 resources (patient clinical records) and PostgreSQL tables (operational data). Read [ARCHITECTURE.md](ARCHITECTURE.md) first to understand the dual-store strategy.

---

## Table of Contents

1. [Dual-Store Strategy Recap](#1-dual-store-strategy-recap)
2. [FHIR R4 Resources](#2-fhir-r4-resources)
3. [PostgreSQL Schema](#3-postgresql-schema)
4. [Entity Relationship Diagram](#4-entity-relationship-diagram)
5. [ID Strategy](#5-id-strategy)
6. [Data Lifecycle](#6-data-lifecycle)

---

## 1. Dual-Store Strategy Recap

| Store | Owns | Key Rule |
|-------|------|----------|
| **FHIR Store** (GCP Healthcare API) | Patient, Encounter, MedicationRequest, Condition, Observation, DiagnosticReport, ServiceRequest | All clinical/medical data |
| **PostgreSQL** | doctors, clinics, appointments, billing, pharmacy inventory, notifications | All operational/non-clinical data |

PostgreSQL rows that reference clinical records store `fhir_resource_id` — the FHIR resource ID — not a copy of the data.

---

## 2. FHIR R4 Resources

### 2.1 Patient

Canonical patient record. Created once per patient; referenced by all clinical resources.

```json
{
  "resourceType": "Patient",
  "id": "patient-uuid",
  "meta": {
    "lastUpdated": "2024-01-15T10:30:00Z"
  },
  "identifier": [
    {
      "system": "https://cliniqai.com/patient-id",
      "value": "P-20240001"
    }
  ],
  "name": [
    {
      "use": "official",
      "family": "Sharma",
      "given": ["Rajesh", "Kumar"]
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "+919876543210",
      "use": "mobile"
    }
  ],
  "gender": "male",
  "birthDate": "1985-06-20",
  "address": [
    {
      "use": "home",
      "line": ["123, MG Road"],
      "city": "Bengaluru",
      "state": "Karnataka",
      "postalCode": "560001",
      "country": "IN"
    }
  ],
  "communication": [
    {
      "language": {
        "coding": [{ "system": "urn:ietf:bcp:47", "code": "kn", "display": "Kannada" }]
      },
      "preferred": true
    }
  ],
  "extension": [
    {
      "url": "https://cliniqai.com/fhir/StructureDefinition/blood-group",
      "valueString": "B+"
    },
    {
      "url": "https://cliniqai.com/fhir/StructureDefinition/emergency-contact",
      "valueString": "+919876543211"
    }
  ]
}
```

**Key fields:**
| Field | Notes |
|-------|-------|
| `id` | UUID — also stored as `fhir_patient_id` in PostgreSQL `patients` table |
| `identifier` | CliniqAI internal patient number (e.g. P-20240001) |
| `telecom` | Phone number used for WhatsApp/SMS — masked in logs |
| `communication.language` | Drives prescription language selection |
| `extension[blood-group]` | Custom CliniqAI extension |

---

### 2.2 Encounter

Represents a single consultation/visit. One Encounter per consultation.

```json
{
  "resourceType": "Encounter",
  "id": "encounter-uuid",
  "status": "finished",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "AMB",
    "display": "ambulatory"
  },
  "type": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "11429006",
          "display": "Consultation"
        }
      ]
    }
  ],
  "subject": {
    "reference": "Patient/patient-uuid"
  },
  "participant": [
    {
      "type": [{ "coding": [{ "code": "ATND", "display": "attender" }] }],
      "individual": {
        "reference": "Practitioner/doctor-uuid"
      }
    }
  ],
  "period": {
    "start": "2024-01-15T10:00:00Z",
    "end": "2024-01-15T10:20:00Z"
  },
  "reasonCode": [
    {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "267036007",
          "display": "Cough"
        }
      ],
      "text": "Persistent cough for 5 days"
    }
  ],
  "diagnosis": [
    {
      "condition": { "reference": "Condition/condition-uuid" },
      "use": { "coding": [{ "code": "AD", "display": "Admission diagnosis" }] },
      "rank": 1
    }
  ],
  "location": [
    {
      "location": { "reference": "Location/clinic-uuid" }
    }
  ]
}
```

---

### 2.3 Condition (Diagnosis)

One Condition per diagnosis assigned during a consultation.

```json
{
  "resourceType": "Condition",
  "id": "condition-uuid",
  "clinicalStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
        "code": "active"
      }
    ]
  },
  "verificationStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        "code": "confirmed"
      }
    ]
  },
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/condition-category",
          "code": "encounter-diagnosis"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://hl7.org/fhir/sid/icd-10",
        "code": "J06.9",
        "display": "Acute upper respiratory infection, unspecified"
      }
    ],
    "text": "Upper respiratory tract infection"
  },
  "subject": { "reference": "Patient/patient-uuid" },
  "encounter": { "reference": "Encounter/encounter-uuid" },
  "onsetDateTime": "2024-01-10T00:00:00Z",
  "recordedDate": "2024-01-15T10:05:00Z",
  "recorder": { "reference": "Practitioner/doctor-uuid" }
}
```

---

### 2.4 MedicationRequest (Prescription Line Item)

One MedicationRequest per medication in a prescription. Multiple MedicationRequests share the same `groupIdentifier` to form one prescription.

```json
{
  "resourceType": "MedicationRequest",
  "id": "medication-request-uuid",
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [
      {
        "system": "https://cliniqai.com/fhir/CodeSystem/medicines",
        "code": "AMOX500",
        "display": "Amoxicillin 500mg"
      }
    ],
    "text": "Amoxicillin 500mg Capsule"
  },
  "subject": { "reference": "Patient/patient-uuid" },
  "encounter": { "reference": "Encounter/encounter-uuid" },
  "requester": { "reference": "Practitioner/doctor-uuid" },
  "authoredOn": "2024-01-15T10:15:00Z",
  "groupIdentifier": {
    "system": "https://cliniqai.com/fhir/prescription-group",
    "value": "RX-20240115-001"
  },
  "dosageInstruction": [
    {
      "text": "1 capsule three times daily after meals",
      "timing": {
        "repeat": {
          "frequency": 3,
          "period": 1,
          "periodUnit": "d"
        }
      },
      "route": {
        "coding": [
          {
            "system": "http://snomed.info/sct",
            "code": "26643006",
            "display": "Oral route"
          }
        ]
      },
      "doseAndRate": [
        {
          "doseQuantity": {
            "value": 1,
            "unit": "capsule",
            "system": "http://unitsofmeasure.org",
            "code": "{capsule}"
          }
        }
      ]
    }
  ],
  "dispenseRequest": {
    "quantity": {
      "value": 21,
      "unit": "capsule"
    },
    "expectedSupplyDuration": {
      "value": 7,
      "unit": "days",
      "system": "http://unitsofmeasure.org",
      "code": "d"
    }
  },
  "note": [
    { "text": "Complete full course. Do not stop if feeling better." }
  ]
}
```

---

### 2.5 Observation (Vitals)

One Observation per vital sign recorded.

```json
{
  "resourceType": "Observation",
  "id": "observation-uuid",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "85354-9",
        "display": "Blood pressure panel"
      }
    ]
  },
  "subject": { "reference": "Patient/patient-uuid" },
  "encounter": { "reference": "Encounter/encounter-uuid" },
  "effectiveDateTime": "2024-01-15T10:02:00Z",
  "component": [
    {
      "code": { "coding": [{ "system": "http://loinc.org", "code": "8480-6", "display": "Systolic blood pressure" }] },
      "valueQuantity": { "value": 128, "unit": "mmHg", "system": "http://unitsofmeasure.org", "code": "mm[Hg]" }
    },
    {
      "code": { "coding": [{ "system": "http://loinc.org", "code": "8462-4", "display": "Diastolic blood pressure" }] },
      "valueQuantity": { "value": 82, "unit": "mmHg", "system": "http://unitsofmeasure.org", "code": "mm[Hg]" }
    }
  ]
}
```

**LOINC codes for common vitals:**
| Vital | LOINC Code |
|-------|-----------|
| Blood Pressure (panel) | 85354-9 |
| Systolic BP | 8480-6 |
| Diastolic BP | 8462-4 |
| Heart Rate | 8867-4 |
| Body Temperature | 8310-5 |
| Body Weight | 29463-7 |
| Body Height | 8302-2 |
| BMI | 39156-5 |
| Oxygen Saturation (SpO2) | 59408-5 |
| Blood Glucose (fasting) | 1558-6 |

---

### 2.6 DiagnosticReport (Lab Result)

```json
{
  "resourceType": "DiagnosticReport",
  "id": "diagnostic-report-uuid",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
          "code": "LAB",
          "display": "Laboratory"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "58410-2",
        "display": "CBC panel"
      }
    ],
    "text": "Complete Blood Count"
  },
  "subject": { "reference": "Patient/patient-uuid" },
  "encounter": { "reference": "Encounter/encounter-uuid" },
  "effectiveDateTime": "2024-01-16T08:00:00Z",
  "issued": "2024-01-16T14:00:00Z",
  "performer": [
    { "display": "Metropolis Labs" }
  ],
  "result": [
    { "reference": "Observation/haemoglobin-obs-uuid" },
    { "reference": "Observation/wbc-obs-uuid" }
  ],
  "presentedForm": [
    {
      "contentType": "application/pdf",
      "url": "https://storage.cliniqai.com/labs/report-uuid.pdf",
      "title": "CBC Report - Jan 16 2024"
    }
  ],
  "conclusion": "Haemoglobin slightly below normal range. Recommend iron supplementation.",
  "extension": [
    {
      "url": "https://cliniqai.com/fhir/StructureDefinition/ai-summary",
      "valueString": "CBC shows mild anaemia (Hb: 10.2 g/dL). WBC and platelets within normal limits. No signs of infection."
    }
  ]
}
```

---

### 2.7 AllergyIntolerance

```json
{
  "resourceType": "AllergyIntolerance",
  "id": "allergy-uuid",
  "clinicalStatus": {
    "coding": [{ "code": "active", "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical" }]
  },
  "verificationStatus": {
    "coding": [{ "code": "confirmed", "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification" }]
  },
  "type": "allergy",
  "category": ["medication"],
  "criticality": "high",
  "code": {
    "coding": [
      { "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "7980", "display": "Penicillin" }
    ],
    "text": "Penicillin"
  },
  "patient": { "reference": "Patient/patient-uuid" },
  "reaction": [
    {
      "manifestation": [
        {
          "coding": [{ "system": "http://snomed.info/sct", "code": "271807003", "display": "Skin rash" }]
        }
      ],
      "severity": "severe"
    }
  ]
}
```

---

## 3. PostgreSQL Schema

Full DDL for all operational tables. Run via Prisma migrations.

### 3.1 Auth Tables

```sql
-- Users (doctors, nurses, admins, patients)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(15) UNIQUE,
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  role          VARCHAR(20) NOT NULL CHECK (role IN ('doctor','nurse','admin','receptionist','patient')),
  is_verified   BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE otp_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      VARCHAR(15) NOT NULL,
  code_hash  VARCHAR(255) NOT NULL,
  purpose    VARCHAR(20) NOT NULL CHECK (purpose IN ('registration','login','reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_phone_purpose ON otp_codes(phone, purpose);
```

### 3.2 Doctor & Clinic Tables

```sql
CREATE TABLE doctors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name      VARCHAR(255) NOT NULL,
  specialties    TEXT[] NOT NULL DEFAULT '{}',
  license_number VARCHAR(50) UNIQUE,
  qualification  VARCHAR(500),
  bio            TEXT,
  profile_photo  VARCHAR(500),
  signature_url  VARCHAR(500),
  years_of_exp   INTEGER,
  languages      TEXT[] DEFAULT '{"en"}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clinics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  address_line1   VARCHAR(500),
  address_line2   VARCHAR(500),
  city            VARCHAR(100),
  state           VARCHAR(100),
  pincode         VARCHAR(10),
  phone           VARCHAR(15),
  email           VARCHAR(255),
  gst_number      VARCHAR(20),
  logo_url        VARCHAR(500),
  timezone        VARCHAR(50) DEFAULT 'Asia/Kolkata',
  currency        VARCHAR(3)  DEFAULT 'INR',
  plan            VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free','pro','clinic','hospital')),
  plan_expires_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clinic_doctors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  doctor_id  UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  role       VARCHAR(20) DEFAULT 'doctor' CHECK (role IN ('owner','doctor','nurse','admin','receptionist')),
  is_active  BOOLEAN DEFAULT TRUE,
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, doctor_id)
);

CREATE TABLE working_hours (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id           UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  day_of_week         INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  slot_duration_mins  INTEGER NOT NULL DEFAULT 15,
  max_patients        INTEGER,
  is_active           BOOLEAN DEFAULT TRUE,
  UNIQUE(doctor_id, clinic_id, day_of_week)
);
```

### 3.3 Patient Tables

```sql
CREATE TABLE patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_patient_id   VARCHAR(255) UNIQUE NOT NULL,  -- GCP Healthcare API FHIR resource ID
  patient_number    VARCHAR(20) UNIQUE,             -- Human-readable: P-20240001
  phone_encrypted   BYTEA,                          -- AES-256-GCM encrypted
  phone_hash        VARCHAR(64),                    -- SHA-256 for lookups
  created_by        UUID REFERENCES doctors(id),
  clinic_id         UUID REFERENCES clinics(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Tags for quick patient categorisation (not clinical diagnoses)
CREATE TABLE patient_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  tag        VARCHAR(50) NOT NULL,
  tagged_by  UUID REFERENCES doctors(id),
  tagged_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, clinic_id, tag)
);

CREATE INDEX idx_patients_phone_hash ON patients(phone_hash);
CREATE INDEX idx_patients_clinic ON patients(clinic_id);
```

### 3.4 Appointment Tables

```sql
CREATE TYPE appointment_status AS ENUM (
  'scheduled','confirmed','arrived','in_progress','completed','cancelled','no_show'
);

CREATE TYPE appointment_type AS ENUM (
  'in_person','telemedicine','walk_in'
);

CREATE TABLE appointments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID NOT NULL REFERENCES patients(id),
  doctor_id      UUID NOT NULL REFERENCES doctors(id),
  clinic_id      UUID NOT NULL REFERENCES clinics(id),
  scheduled_at   TIMESTAMPTZ NOT NULL,
  duration_mins  INTEGER DEFAULT 15,
  type           appointment_type DEFAULT 'in_person',
  status         appointment_status DEFAULT 'scheduled',
  chief_complaint TEXT,
  notes          TEXT,
  booked_by      VARCHAR(20) DEFAULT 'staff' CHECK (booked_by IN ('staff','patient','walk_in')),
  reminder_sent  BOOLEAN DEFAULT FALSE,
  cancelled_at   TIMESTAMPTZ,
  cancel_reason  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Walk-in queue (token system)
CREATE TABLE appointment_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id),
  doctor_id    UUID NOT NULL REFERENCES doctors(id),
  patient_id   UUID NOT NULL REFERENCES patients(id),
  queue_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  token_number INTEGER NOT NULL,
  arrived_at   TIMESTAMPTZ DEFAULT NOW(),
  called_at    TIMESTAMPTZ,
  status       VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting','called','in_progress','done','skipped')),
  UNIQUE(clinic_id, doctor_id, queue_date, token_number)
);

CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, scheduled_at);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_queue_clinic_date ON appointment_queue(clinic_id, queue_date);
```

### 3.5 Consultation Tables

```sql
CREATE TABLE consultations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id     UUID REFERENCES appointments(id),
  doctor_id          UUID NOT NULL REFERENCES doctors(id),
  patient_id         UUID NOT NULL REFERENCES patients(id),
  clinic_id          UUID NOT NULL REFERENCES clinics(id),
  fhir_encounter_id  VARCHAR(255) UNIQUE NOT NULL,  -- FHIR Encounter resource ID
  started_at         TIMESTAMPTZ DEFAULT NOW(),
  ended_at           TIMESTAMPTZ,
  chief_complaint    TEXT,
  notes              TEXT,
  ai_summary         TEXT,              -- MedGemma-generated summary
  voice_transcript   TEXT,              -- Raw voice transcript (if voice mode used)
  status             VARCHAR(20) DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress','completed','voided')),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consultations_doctor ON consultations(doctor_id);
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
```

### 3.6 Prescription Tables

```sql
CREATE TYPE prescription_status AS ENUM ('draft','active','completed','cancelled');
CREATE TYPE prescription_send_method AS ENUM ('whatsapp','sms','email','printed','not_sent');

CREATE TABLE prescriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id         UUID REFERENCES consultations(id),
  patient_id              UUID NOT NULL REFERENCES patients(id),
  doctor_id               UUID NOT NULL REFERENCES doctors(id),
  clinic_id               UUID NOT NULL REFERENCES clinics(id),
  prescription_number     VARCHAR(30) UNIQUE,          -- RX-20240115-001
  fhir_bundle_id          VARCHAR(255),                -- Links to FHIR MedicationRequest group
  status                  prescription_status DEFAULT 'active',
  language                VARCHAR(5) DEFAULT 'en',
  pdf_url                 VARCHAR(500),
  send_method             prescription_send_method DEFAULT 'not_sent',
  sent_at                 TIMESTAMPTZ,
  ai_assisted             BOOLEAN DEFAULT FALSE,       -- Was AI voice/assist used?
  ddi_alerts_acknowledged BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.7 Billing Tables

```sql
CREATE TYPE invoice_status AS ENUM ('draft','sent','paid','partial','overdue','void');
CREATE TYPE payment_method AS ENUM ('cash','upi','card','netbanking','insurance','free');

CREATE TABLE invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   VARCHAR(30) UNIQUE,         -- INV-20240115-001
  consultation_id  UUID REFERENCES consultations(id),
  patient_id       UUID NOT NULL REFERENCES patients(id),
  doctor_id        UUID NOT NULL REFERENCES doctors(id),
  clinic_id        UUID NOT NULL REFERENCES clinics(id),
  line_items       JSONB NOT NULL DEFAULT '[]', -- [{description, quantity, unit_price, amount}]
  subtotal         NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_rate         NUMERIC(5,2)  DEFAULT 0,
  gst_amount       NUMERIC(10,2) DEFAULT 0,
  discount_amount  NUMERIC(10,2) DEFAULT 0,
  total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid      NUMERIC(10,2) DEFAULT 0,
  status           invoice_status DEFAULT 'draft',
  due_date         DATE,
  paid_at          TIMESTAMPTZ,
  notes            TEXT,
  pdf_url          VARCHAR(500),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES invoices(id),
  amount            NUMERIC(10,2) NOT NULL,
  method            payment_method NOT NULL,
  transaction_id    VARCHAR(100),            -- UPI/card reference
  razorpay_order_id VARCHAR(100),
  paid_at           TIMESTAMPTZ DEFAULT NOW(),
  notes             TEXT
);

CREATE INDEX idx_invoices_clinic_date ON invoices(clinic_id, created_at);
CREATE INDEX idx_invoices_patient ON invoices(patient_id);
```

### 3.8 Pharmacy Tables

```sql
CREATE TABLE medicines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  generic_name  VARCHAR(255),
  manufacturer  VARCHAR(255),
  form          VARCHAR(50),     -- tablet, capsule, syrup, injection, etc.
  strength      VARCHAR(50),     -- 500mg, 10mg/5ml, etc.
  unit          VARCHAR(20),     -- tablet, ml, etc.
  hsn_code      VARCHAR(20),     -- GST HSN code
  gst_rate      NUMERIC(5,2) DEFAULT 12,
  is_generic    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id),
  medicine_id     UUID NOT NULL REFERENCES medicines(id),
  batch_number    VARCHAR(50),
  expiry_date     DATE,
  stock_quantity  INTEGER NOT NULL DEFAULT 0,
  reorder_level   INTEGER DEFAULT 10,
  cost_price      NUMERIC(10,2),
  selling_price   NUMERIC(10,2),
  location        VARCHAR(100),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, medicine_id, batch_number)
);

CREATE TABLE dispensing (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id   UUID NOT NULL REFERENCES prescriptions(id),
  inventory_id      UUID NOT NULL REFERENCES inventory(id),
  medicine_id       UUID NOT NULL REFERENCES medicines(id),
  quantity_dispensed INTEGER NOT NULL,
  dispensed_by      UUID REFERENCES users(id),
  dispensed_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_clinic ON inventory(clinic_id);
CREATE INDEX idx_inventory_expiry ON inventory(expiry_date);
```

### 3.9 Lab Tables

```sql
CREATE TABLE lab_orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id        UUID REFERENCES consultations(id),
  patient_id             UUID NOT NULL REFERENCES patients(id),
  doctor_id              UUID NOT NULL REFERENCES doctors(id),
  clinic_id              UUID NOT NULL REFERENCES clinics(id),
  fhir_service_request_id VARCHAR(255),
  tests                  TEXT[] NOT NULL,     -- ["CBC", "LFT", "Blood Glucose"]
  lab_partner            VARCHAR(100),        -- "Metropolis", "SRL", "manual"
  status                 VARCHAR(20) DEFAULT 'ordered'
                         CHECK (status IN ('ordered','sample_collected','processing','resulted','cancelled')),
  ordered_at             TIMESTAMPTZ DEFAULT NOW(),
  resulted_at            TIMESTAMPTZ
);

CREATE TABLE lab_results (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id             UUID NOT NULL REFERENCES lab_orders(id),
  fhir_diagnostic_report_id VARCHAR(255) UNIQUE,
  result_file_url          VARCHAR(500),
  ai_summary               TEXT,           -- MedGemma-generated plain-language interpretation
  ai_summary_generated_at  TIMESTAMPTZ,
  uploaded_at              TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by              UUID REFERENCES users(id)
);
```

### 3.10 Notifications Table

```sql
CREATE TABLE notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID REFERENCES clinics(id),
  recipient_user_id   UUID REFERENCES users(id),
  recipient_phone     VARCHAR(15),
  recipient_email     VARCHAR(255),
  type                VARCHAR(50) NOT NULL,  -- appointment.reminder, prescription.sent, etc.
  channel             VARCHAR(20) NOT NULL CHECK (channel IN ('sms','whatsapp','push','email')),
  template_id         VARCHAR(100),
  payload             JSONB,
  status              VARCHAR(20) DEFAULT 'queued'
                      CHECK (status IN ('queued','sent','delivered','failed')),
  provider            VARCHAR(20),           -- msg91, twilio, fcm, resend
  provider_message_id VARCHAR(255),
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  failed_reason       TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_type_status ON notifications(type, status);
```

### 3.11 Audit Log Table

```sql
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES users(id),
  actor_role   VARCHAR(20),
  action       VARCHAR(100) NOT NULL,   -- patient.view, prescription.create, etc.
  resource     VARCHAR(50),             -- Patient, Prescription, Invoice, etc.
  resource_id  VARCHAR(255),            -- UUID or FHIR resource ID
  ip_address   INET,
  user_agent   TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource, resource_id);
```

---

## 4. Entity Relationship Diagram

```
users ──────────────── doctors ─────────────── clinic_doctors ──── clinics
                          │                                            │
                          │                                    working_hours
                          │
                    consultations ──── appointments ─────────── patients
                          │                                         │
               ┌──────────┼────────────┐                   patient_tags
               │          │            │
         prescriptions  invoices   lab_orders
               │          │            │
          (FHIR)        payments   lab_results
     MedicationRequest  (payments)  (FHIR)
                                DiagnosticReport
```

---

## 5. ID Strategy

| Identifier | Format | Example | Used For |
|------------|--------|---------|----------|
| Internal UUID | `gen_random_uuid()` | `3f7a9c2d-...` | All PostgreSQL PKs, foreign keys |
| FHIR Resource ID | UUID (GCP-managed) | `a1b2c3d4-...` | FHIR store resource identifier |
| Patient Number | `P-YYYYNNNNN` | `P-20240001` | Human-readable patient ID, on prescriptions |
| Prescription Number | `RX-YYYYMMDD-NNN` | `RX-20240115-001` | On prescription PDFs |
| Invoice Number | `INV-YYYYMMDD-NNN` | `INV-20240115-001` | On billing documents |
| Queue Token | Integer (daily reset) | `42` | Walk-in queue display |

---

## 6. Data Lifecycle

### Patient Record Creation
1. Doctor registers patient → PostgreSQL `patients` row created + FHIR `Patient` resource created
2. `patients.fhir_patient_id` stores the FHIR resource ID
3. Patient demographics in FHIR; operational metadata in PostgreSQL

### Consultation Flow
1. Appointment booked → `appointments` row
2. Consultation started → `consultations` row + FHIR `Encounter` created
3. Vitals entered → FHIR `Observation` resources created
4. Diagnosis selected → FHIR `Condition` created, linked to Encounter
5. Prescription written → FHIR `MedicationRequest`(s) created, `prescriptions` row created with FHIR bundle ID
6. Invoice generated → `invoices` row (no FHIR equivalent for billing)
7. Consultation ended → `consultations.ended_at` set, FHIR Encounter status → `finished`

### Data Deletion Policy
- Patient records: **never deleted** (regulatory requirement — retain for 7 years minimum)
- Appointments: **soft-delete** via `status = 'cancelled'`
- Invoices: **never deleted** — void status only
- Audit logs: **retained for 5 years**, then archived to cold storage

---

*Last updated: Phase 1 setup*
*See [AI_INTEGRATIONS.md](../ai/AI_INTEGRATIONS.md) for how AI services read and write to these data stores.*
