# CliniqAI — Prerequisites

This document lists every tool, account, credential, and piece of domain knowledge required before you can develop, run, or deploy any part of the CliniqAI platform.

---

## Table of Contents

1. [Domain Knowledge](#1-domain-knowledge)
2. [Local Development Tools](#2-local-development-tools)
3. [Google Cloud Setup](#3-google-cloud-setup)
4. [Third-Party Services](#4-third-party-services)
5. [Environment Variables](#5-environment-variables)
6. [Hardware Requirements](#6-hardware-requirements)
7. [Prerequisite Checklist](#7-prerequisite-checklist)

---

## 1. Domain Knowledge

Before contributing, developers should have a working understanding of:

### Medical / Healthcare
| Topic | Why It Matters | Resource |
|-------|---------------|----------|
| **FHIR R4** (Fast Healthcare Interoperability Resources) | All patient data is stored and exchanged in FHIR R4 format | [HL7 FHIR Docs](https://hl7.org/fhir/R4/) |
| **FHIR Resource Types** | Patient, Encounter, Observation, MedicationRequest, DiagnosticReport | [FHIR Resource List](https://hl7.org/fhir/R4/resourcelist.html) |
| **NMC Prescription Guidelines** | Indian digital prescriptions must comply with NMC rules | [NMC India](https://www.nmc.org.in/) |
| **ICD-10 Codes** | Standard diagnosis coding used in prescriptions and reports | [ICD-10 Browser](https://icd.who.int/browse10/2019/en) |
| **Drug Interaction Basics** | Understanding pharmacokinetics helps implement DDI alerts correctly | Internal training doc (TBD) |

### Regulatory / Compliance
| Topic | Why It Matters |
|-------|---------------|
| **India DPDP Act 2023** | Data Protection law governing patient data in India |
| **HIPAA Basics** | Required for any US-facing deployments (Google Cloud provides BAA) |
| **Google Cloud BAA** | Google Cloud signs Business Associate Agreement for HIPAA workloads |

---

## 2. Local Development Tools

### 2.1 Core Runtimes

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | >= 20.x LTS | [nodejs.org](https://nodejs.org) |
| **Python** | >= 3.11 | [python.org](https://python.org) |
| **pnpm** | >= 9.x | `npm install -g pnpm` |
| **Poetry** | >= 1.8 | `curl -sSL https://install.python-poetry.org \| python3 -` |

Verify installs:
```bash
node --version    # v20.x.x
python3 --version # Python 3.11.x
pnpm --version    # 9.x.x
poetry --version  # Poetry 1.8.x
```

### 2.2 Mobile Development

| Tool | Version | Notes |
|------|---------|-------|
| **React Native CLI** | latest | `npm install -g react-native-cli` |
| **Xcode** | >= 15 | macOS only — for iOS simulator |
| **Android Studio** | Hedgehog+ | For Android emulator |
| **JDK** | 17 (LTS) | Required by Android build tools |
| **CocoaPods** | >= 1.14 | `sudo gem install cocoapods` (macOS) |

```bash
# Verify Android setup
npx react-native doctor
```

### 2.3 Infrastructure & DevOps

| Tool | Version | Install |
|------|---------|---------|
| **Docker Desktop** | >= 4.x | [docker.com](https://www.docker.com/products/docker-desktop) |
| **kubectl** | >= 1.28 | `brew install kubectl` |
| **Terraform** | >= 1.6 | `brew install terraform` |
| **Google Cloud CLI (gcloud)** | latest | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) |
| **Helm** | >= 3.x | `brew install helm` |

### 2.4 Development Utilities

| Tool | Purpose | Install |
|------|---------|---------|
| **Git** | Version control | Pre-installed on macOS |
| **VS Code** | Recommended IDE | [code.visualstudio.com](https://code.visualstudio.com) |
| **Postman** | API testing | [postman.com](https://www.postman.com) |
| **TablePlus** | Database GUI | [tableplus.com](https://tableplus.com) |
| **Bruno** | Alternative to Postman (open-source) | [usebruno.com](https://www.usebruno.com) |

#### Recommended VS Code Extensions
```
dbaeumer.vscode-eslint
esbenp.prettier-vscode
ms-python.python
ms-python.black-formatter
bradlc.vscode-tailwindcss
GraphQL.vscode-graphql-syntax
ms-azuretools.vscode-docker
hashicorp.terraform
```

---

## 3. Google Cloud Setup

CliniqAI is built on Google Cloud. You need a GCP project with the following configured.

### 3.1 GCP Account & Project

1. Create a GCP account at [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project:
   ```
   Project Name: cliniqai-prod (or cliniqai-dev for development)
   Project ID:   cliniqai-prod-<random> (note this down)
   ```
3. Enable **Billing** on the project (required for all APIs below)

### 3.2 Required APIs to Enable

Enable all of the following in GCP Console → APIs & Services → Enable APIs:

| API | Purpose | Enable Command |
|-----|---------|----------------|
| **Cloud Healthcare API** | FHIR R4 data store, DICOM | `gcloud services enable healthcare.googleapis.com` |
| **Vertex AI API** | MedGemma, model serving | `gcloud services enable aiplatform.googleapis.com` |
| **Cloud Storage API** | Medical images, PDFs, documents | `gcloud services enable storage.googleapis.com` |
| **Cloud SQL API** | Managed PostgreSQL | `gcloud services enable sqladmin.googleapis.com` |
| **Cloud Run API** | Containerized services | `gcloud services enable run.googleapis.com` |
| **Cloud Pub/Sub API** | Async event messaging | `gcloud services enable pubsub.googleapis.com` |
| **Secret Manager API** | Store credentials securely | `gcloud services enable secretmanager.googleapis.com` |
| **Cloud Build API** | CI/CD pipeline | `gcloud services enable cloudbuild.googleapis.com` |
| **Artifact Registry API** | Docker image storage | `gcloud services enable artifactregistry.googleapis.com` |
| **Identity Platform API** | Auth (Firebase Auth) | `gcloud services enable identitytoolkit.googleapis.com` |

Enable all at once:
```bash
gcloud services enable \
  healthcare.googleapis.com \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  sqladmin.googleapis.com \
  run.googleapis.com \
  pubsub.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  identitytoolkit.googleapis.com
```

### 3.3 MedGemma Access (Google Health AI)

MedGemma requires separate access approval:

1. Go to [Vertex AI Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)
2. Search for **MedGemma**
3. Click **Enable** / **Request Access**
4. Fill out the Google Health AI Developer Foundations form
5. Access is typically approved within 1–2 business days

Models needed:
- `medgemma-4b-it` — Multimodal, for real-time prescription + imaging
- `medgemma-27b-it` — Text, for clinical decision support + summarization

### 3.4 Service Accounts

Create a service account for the backend API:

```bash
# Create service account
gcloud iam service-accounts create cliniqai-backend \
  --display-name="CliniqAI Backend Service Account"

# Grant required roles
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cliniqai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/healthcare.datasetAdmin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cliniqai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cliniqai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cliniqai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Download key (for local dev only — use Workload Identity in prod)
gcloud iam service-accounts keys create ./service-account-key.json \
  --iam-account=cliniqai-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

> **Security Note:** Never commit `service-account-key.json` to Git. Add it to `.gitignore`. In production, use Workload Identity Federation instead of key files.

### 3.5 FHIR Store Setup (Cloud Healthcare API)

```bash
# Create a Healthcare dataset
gcloud healthcare datasets create cliniqai-dataset \
  --location=asia-south1

# Create a FHIR store (R4)
gcloud healthcare fhir-stores create cliniqai-fhir \
  --dataset=cliniqai-dataset \
  --location=asia-south1 \
  --version=R4 \
  --enable-update-create \
  --disable-referential-integrity
```

> Region `asia-south1` (Mumbai) is recommended for India deployments. Use `us-central1` for US.

### 3.6 Cloud SQL (PostgreSQL)

```bash
# Create PostgreSQL 15 instance
gcloud sql instances create cliniqai-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \       # Use db-g1-small or higher for production
  --region=asia-south1

# Create database
gcloud sql databases create cliniqai --instance=cliniqai-db

# Create user
gcloud sql users create cliniqai_user \
  --instance=cliniqai-db \
  --password=CHANGE_ME
```

---

## 4. Third-Party Services

### 4.1 Communication

| Service | Purpose | Signup |
|---------|---------|--------|
| **MSG91** (recommended for India) | SMS + WhatsApp OTP | [msg91.com](https://msg91.com) |
| **Twilio** (global fallback) | SMS, WhatsApp, Voice | [twilio.com](https://twilio.com) |
| **WhatsApp Business API** | Patient messaging via WhatsApp | Requires Meta Business account |

**MSG91 Setup:**
1. Create account at msg91.com
2. Get API Key from Dashboard → API
3. Register WhatsApp Business Number (requires approved Meta Business account)
4. Create OTP template for doctor registration
5. Create appointment reminder template

### 4.2 Payment (Phase 2)

| Service | Purpose | Notes |
|---------|---------|-------|
| **Razorpay** | Payment collection, subscriptions | Best for India |
| **Stripe** | Global payments | For international expansion |

### 4.3 Email

| Service | Purpose |
|---------|---------|
| **Resend** | Transactional emails (receipts, OTPs) |
| **SendGrid** | Alternative |

### 4.4 Monitoring & Observability

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| **Google Cloud Monitoring** | Infra metrics, alerts | Included with GCP |
| **Sentry** | Error tracking (frontend + backend) | Yes |
| **PostHog** | Product analytics, feature flags | Yes (self-hosted or cloud) |
| **Grafana** | Custom dashboards | Yes (open-source) |

---

## 5. Environment Variables

Every service has its own `.env` file. Below is the master list of all variables across the platform. Never commit `.env` files — use `.env.example` as a template.

### 5.1 API Service (`services/api/.env`)

```env
# App
NODE_ENV=development
PORT=3001
API_BASE_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://cliniqai_user:password@localhost:5432/cliniqai

# Redis
REDIS_URL=redis://localhost:6379

# Auth (JWT)
JWT_SECRET=your-256-bit-secret-here
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_REFRESH_EXPIRES_IN=30d

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
GCP_REGION=asia-south1

# Google Cloud Healthcare API (FHIR)
FHIR_DATASET_ID=cliniqai-dataset
FHIR_STORE_ID=cliniqai-fhir
FHIR_BASE_URL=https://healthcare.googleapis.com/v1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/${GCP_REGION}/datasets/${FHIR_DATASET_ID}/fhirStores/${FHIR_STORE_ID}/fhir

# Google Cloud Storage
GCS_BUCKET_NAME=cliniqai-medical-files
GCS_BUCKET_REGION=asia-south1

# SMS / WhatsApp (MSG91)
MSG91_API_KEY=your-msg91-api-key
MSG91_SENDER_ID=CLNQAI
MSG91_TEMPLATE_OTP=your-otp-template-id
MSG91_TEMPLATE_APPOINTMENT=your-appointment-template-id
WHATSAPP_AUTH_KEY=your-whatsapp-auth-key

# Notifications
PUSH_NOTIFICATION_KEY=your-fcm-server-key

# Encryption
ENCRYPTION_KEY=your-32-char-encryption-key-here

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19000
```

### 5.2 AI Service (`services/ai/.env`)

```env
# App
ENVIRONMENT=development
PORT=8001

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
GCP_REGION=asia-south1
VERTEX_AI_LOCATION=us-central1   # MedGemma only available in us-central1 currently

# MedGemma Models
MEDGEMMA_4B_ENDPOINT=medgemma-4b-it
MEDGEMMA_27B_ENDPOINT=medgemma-27b-it

# CXR Foundation Model
CXR_FOUNDATION_API_URL=https://us-central1-aiplatform.googleapis.com/v1/...
CXR_MODEL_ENDPOINT=your-cxr-endpoint-id

# Drug Interaction Database
DDI_DB_URL=postgresql://cliniqai_user:password@localhost:5432/cliniqai
DDI_API_KEY=your-ddi-api-key   # OpenFDA or custom DB

# Rate Limiting
AI_RATE_LIMIT_PER_MINUTE=60
```

### 5.3 Web App (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_URL=http://localhost:8001
NEXT_PUBLIC_APP_NAME=CliniqAI
NEXT_PUBLIC_GCP_PROJECT_ID=your-gcp-project-id

# Firebase (for auth on web)
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-gcp-project-id
```

### 5.4 Mobile App (`apps/mobile/.env`)

```env
API_URL=http://localhost:3001
AI_URL=http://localhost:8001
APP_BUNDLE_ID=com.cliniqai.doctor

# Firebase
FIREBASE_IOS_API_KEY=your-ios-key
FIREBASE_ANDROID_API_KEY=your-android-key
```

---

## 6. Hardware Requirements

### Development Machine

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 8 GB | 16 GB+ |
| CPU | 4 cores | 8 cores |
| Disk | 50 GB free | 100 GB free (SSD) |
| OS | macOS 13+, Ubuntu 22.04+, Windows 11 WSL2 | macOS 14 (M-series) |

### For Mobile Development (iOS)
- macOS is required to build and run iOS apps
- Xcode is macOS-only; Linux/Windows can only build Android

### For Running AI Models Locally (Optional)
- MedGemma 4B (quantized): 8 GB VRAM GPU (NVIDIA RTX 3070+) or Apple M2 Pro 16 GB
- MedGemma 27B: Use Vertex AI in the cloud — too large for most local machines

---

## 7. Prerequisite Checklist

Use this checklist before starting development:

### Development Environment
- [ ] Node.js 20.x installed
- [ ] Python 3.11+ installed
- [ ] pnpm installed
- [ ] Poetry installed
- [ ] Docker Desktop running
- [ ] Android Studio configured with Android SDK
- [ ] Xcode installed (macOS only, for iOS)
- [ ] CocoaPods installed (macOS only)
- [ ] gcloud CLI installed and authenticated (`gcloud auth login`)

### Google Cloud
- [ ] GCP project created and noted down
- [ ] Billing enabled
- [ ] All required APIs enabled (see Section 3.2)
- [ ] MedGemma access requested / approved
- [ ] Service account created with correct IAM roles
- [ ] Service account key downloaded (dev only) and added to `.gitignore`
- [ ] FHIR dataset and store created
- [ ] Cloud SQL (PostgreSQL) instance running

### Third-Party Accounts
- [ ] MSG91 account created, API key obtained
- [ ] WhatsApp Business API access (or Twilio as fallback)
- [ ] Sentry project created (get DSN)
- [ ] Resend account created (get API key)

### Local Config
- [ ] All `.env` files created from `.env.example` templates
- [ ] `service-account-key.json` present locally and in `.gitignore`
- [ ] Docker containers running (PostgreSQL + Redis): `docker-compose up -d`
- [ ] Database migrations applied: `pnpm db:migrate`

---

*Last updated: Phase 1 setup*
*Next: See [SETUP.md](setup/SETUP.md) for step-by-step local dev environment guide.*
