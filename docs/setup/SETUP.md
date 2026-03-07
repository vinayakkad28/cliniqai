# CliniqAI — Local Development Setup

This guide takes you from a fresh clone to a fully running local development environment. Target: **under 30 minutes**.

---

## Table of Contents

1. [Prerequisites Check](#1-prerequisites-check)
2. [Clone & Install](#2-clone--install)
3. [Environment Configuration](#3-environment-configuration)
4. [Database Setup](#4-database-setup)
5. [Google Cloud Local Auth](#5-google-cloud-local-auth)
6. [Run All Services](#6-run-all-services)
7. [Verify Everything Works](#7-verify-everything-works)
8. [Mobile App Setup](#8-mobile-app-setup)
9. [Common Issues](#9-common-issues)
10. [Development Workflow](#10-development-workflow)

---

## 1. Prerequisites Check

Run this to verify your environment before starting:

```bash
node --version        # Must be >= 20.x
python3 --version     # Must be >= 3.11
pnpm --version        # Must be >= 9.x
poetry --version      # Must be >= 1.8
docker --version      # Must be running
gcloud --version      # Must be authenticated
```

If anything is missing, see [PREREQUISITES.md](../PREREQUISITES.md) for install instructions.

---

## 2. Clone & Install

```bash
# Clone the repo
git clone https://github.com/your-org/cliniqai.git
cd cliniqai

# Install all JS/TS dependencies (monorepo — installs everything)
pnpm install

# Install Python dependencies for the AI service
cd services/ai
poetry install
cd ../..
```

---

## 3. Environment Configuration

Each service needs its own `.env` file. Copy from the provided examples:

```bash
# Core API
cp services/api/.env.example services/api/.env

# AI Service
cp services/ai/.env.example services/ai/.env

# Web App
cp apps/web/.env.example apps/web/.env.local

# Mobile App
cp apps/mobile/.env.example apps/mobile/.env
```

Now edit each file. The minimum values you **must** fill in for local development:

### `services/api/.env` — minimum required

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://cliniqai:cliniqai123@localhost:5432/cliniqai
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-production-minimum-32-chars
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production-32c

# Leave these as-is for local dev (Docker provides them)
# You only need real GCP values when testing AI features

GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json

# For SMS — use test mode locally
MSG91_API_KEY=test_key_sms_will_be_logged_not_sent
ENCRYPTION_KEY=dev-encryption-key-32-chars-here!
ALLOWED_ORIGINS=http://localhost:3000
```

### `services/ai/.env` — minimum required

```env
ENVIRONMENT=development
PORT=8001
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
VERTEX_AI_LOCATION=us-central1
INTERNAL_API_TOKEN=dev-internal-token-change-in-prod
CORE_API_URL=http://localhost:3001
```

### `apps/web/.env.local` — minimum required

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=CliniqAI
```

> **AI features note:** MedGemma and other Google AI features require a real GCP service account key. For local dev without AI, the platform works fully — AI endpoints gracefully degrade and return empty/fallback responses.

---

## 4. Database Setup

### 4.1 Start PostgreSQL and Redis with Docker

```bash
# From the repo root
docker-compose up -d postgres redis

# Verify they're running
docker-compose ps
```

This starts:
- PostgreSQL 15 on `localhost:5432` (user: `cliniqai`, password: `cliniqai123`, db: `cliniqai`)
- Redis 7 on `localhost:6379`

`docker-compose.yml` is at the repo root. If you don't have one yet:

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: cliniqai
      POSTGRES_PASSWORD: cliniqai123
      POSTGRES_DB: cliniqai
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 4.2 Run Database Migrations

```bash
cd services/api

# Generate Prisma client
pnpm prisma generate

# Apply all migrations
pnpm prisma migrate dev

# (Optional) Seed with test data
pnpm prisma db seed
```

Seed creates:
- 1 test doctor: phone `+919999999999`, OTP always `123456` in dev mode
- 1 test clinic: "Demo Clinic"
- 10 sample patients

---

## 5. Google Cloud Local Auth

### 5.1 With Real GCP (AI features enabled)

```bash
# Login with application default credentials
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Download service account key (if not already done)
# Place it at services/api/service-account-key.json
# AND at services/ai/service-account-key.json
# (gitignored — never commit this)
```

### 5.2 Without GCP (AI features mocked)

If you don't have GCP access yet, set this flag in both `.env` files:

```env
AI_MOCK_MODE=true
```

When `AI_MOCK_MODE=true`:
- All AI endpoints return realistic mock responses
- No external API calls are made
- All other features (appointments, billing, pharmacy) work fully

---

## 6. Run All Services

### Option A: Run everything at once (recommended)

```bash
# From repo root — starts all services concurrently
pnpm dev
```

This runs (defined in root `package.json`):
- Core API on `http://localhost:3001`
- AI Service on `http://localhost:8001`
- Web Dashboard on `http://localhost:3000`
- Notification Worker (background)

### Option B: Run services individually

```bash
# Terminal 1 — Core API
cd services/api && pnpm dev

# Terminal 2 — AI Service
cd services/ai && poetry run uvicorn main:app --reload --port 8001

# Terminal 3 — Web Dashboard
cd apps/web && pnpm dev

# Terminal 4 — Notification Worker
cd services/notifications && pnpm dev
```

---

## 7. Verify Everything Works

### 7.1 Core API Health Check

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","version":"1.0.0"}
```

### 7.2 AI Service Health Check

```bash
curl http://localhost:8001/health
# Expected: {"status":"ok"}
```

### 7.3 Web Dashboard

Open `http://localhost:3000` in your browser. You should see the CliniqAI login page.

### 7.4 Login with Test Doctor

1. Open `http://localhost:3000`
2. Enter phone: `+919999999999`
3. Click "Send OTP"
4. Enter OTP: `123456` (hardcoded in dev mode)
5. You should land on the doctor dashboard

### 7.5 Full End-to-End Smoke Test

```bash
# Run the smoke test script
pnpm test:smoke

# This tests:
# - Doctor login
# - Create a patient
# - Book an appointment
# - Start a consultation
# - Write a prescription
# - Generate an invoice
```

### 7.6 API Docs (Development Only)

- Core API Swagger: `http://localhost:3001/api-docs`
- AI Service Swagger: `http://localhost:8001/docs`

---

## 8. Mobile App Setup

### 8.1 iOS (macOS only)

```bash
cd apps/mobile

# Install pods
npx pod-install

# Start Metro bundler
pnpm start

# In another terminal — run on iOS simulator
pnpm ios
```

### 8.2 Android

```bash
cd apps/mobile

# Start Metro bundler
pnpm start

# In another terminal — run on Android emulator
pnpm android
```

### 8.3 Connect to Local API

The mobile app needs to reach your Mac's localhost. Update `apps/mobile/.env`:

```env
# macOS — use your machine's LAN IP (not localhost)
API_URL=http://192.168.1.100:3001

# Or use ngrok for a public tunnel
# ngrok http 3001
# API_URL=https://abc123.ngrok.io
```

Find your LAN IP: `ipconfig getifaddr en0` (macOS) or `hostname -I` (Linux)

---

## 9. Common Issues

### `pnpm install` fails with native module errors

```bash
# Clear node_modules and reinstall
pnpm clean && pnpm install
```

### PostgreSQL connection refused

```bash
# Check Docker is running
docker ps | grep postgres

# Check port is not already in use
lsof -i :5432

# Restart the container
docker-compose restart postgres
```

### Prisma migration fails

```bash
# Reset database (warning: deletes all data)
cd services/api
pnpm prisma migrate reset

# Then re-seed
pnpm prisma db seed
```

### AI service fails to start

```bash
# Check Python version
python3 --version  # Must be 3.11+

# Reinstall Python deps
cd services/ai
poetry env remove python3
poetry install

# Check GCP auth
gcloud auth application-default print-access-token
```

### `GOOGLE_APPLICATION_CREDENTIALS` error

```bash
# Make sure the key file exists at the path specified
ls -la services/api/service-account-key.json
ls -la services/ai/service-account-key.json

# Or use ADC instead of key file
gcloud auth application-default login
# Then remove GOOGLE_APPLICATION_CREDENTIALS from .env
```

### Metro bundler port conflict

```bash
# Kill existing metro
npx react-native start --reset-cache
```

---

## 10. Development Workflow

### Branch Strategy

```
main         → stable, always deployable
staging      → integration testing branch
feat/*       → feature branches (e.g. feat/voice-prescription)
fix/*        → bug fix branches
docs/*       → documentation updates
```

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(prescription): add voice-to-prescription AI endpoint
fix(billing): correct GST calculation for zero-rated items
docs(api): add DDI check endpoint specification
refactor(patients): extract FHIR mapper to separate module
test(auth): add OTP expiry edge case tests
```

### Running Tests

```bash
# All tests
pnpm test

# Core API tests only
cd services/api && pnpm test

# AI service tests only
cd services/ai && poetry run pytest

# Web app tests
cd apps/web && pnpm test

# With coverage
pnpm test:coverage
```

### Linting & Type Checking

```bash
# From repo root
pnpm lint          # ESLint
pnpm typecheck     # TypeScript tsc --noEmit
pnpm format        # Prettier

# Fix all auto-fixable issues
pnpm lint:fix
pnpm format:write
```

### Database Schema Changes

```bash
# 1. Edit schema in services/api/prisma/schema.prisma
# 2. Create a migration
cd services/api
pnpm prisma migrate dev --name describe_your_change

# 3. Commit the migration file (prisma/migrations/)
# Never edit migration files after committing
```

### Adding a New API Endpoint

1. Add route in `services/api/src/routers/<module>.ts`
2. Add Zod validation schema in `services/api/src/validators/<module>.ts`
3. Write tests in `services/api/src/__tests__/<module>.test.ts`
4. Document in `docs/api/API.md`
5. Update TypeScript types in `packages/types/src/api.ts` if response shape changes

### Adding a New AI Feature

1. Add router in `services/ai/routers/<feature>.py`
2. Add Pydantic models in `services/ai/models/<feature>.py`
3. Add mock response in `services/ai/mocks/<feature>.py` for `AI_MOCK_MODE`
4. Write tests in `services/ai/tests/test_<feature>.py`
5. Document in `docs/ai/AI_INTEGRATIONS.md`
6. Add the Core API proxy endpoint so clients never call AI service directly

---

*Last updated: Phase 1 setup*
*See [API.md](../api/API.md) for all endpoint specifications.*
