# CliniqAI

AI-first clinic management platform for individual doctors and small clinics. Built as a modern, affordable alternative to HealthPlix — with deeper Google Health AI integration.

---

## What It Does

CliniqAI helps doctors:
- Write prescriptions in seconds (voice-to-prescription via MedASR + MedGemma)
- Get drug-drug interaction alerts before prescribing
- Manage patients, appointments, billing, and pharmacy from one place
- Run AI-assisted consultations with differential diagnosis hints
- Analyze chest X-rays with Google CXR Foundation Model
- Search patient history using natural language (Vertex AI Healthcare Search)
- Work offline — syncs when connectivity is restored

**Target users:** Individual doctors → Small clinics → Hospitals

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile (Doctor + Patient) | React Native |
| Web Dashboard | Next.js 14 |
| Core API | Node.js + Express + Prisma |
| AI Service | Python + FastAPI |
| Database | PostgreSQL 15 + Redis 7 |
| Clinical Records | Google Cloud Healthcare API (FHIR R4) |
| AI Models | MedGemma 4B/27B, MedASR, CXR Foundation, MedSigLIP |
| Search | Vertex AI Search for Healthcare |
| Storage | Google Cloud Storage |
| Auth | JWT + Firebase Auth |

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install
cd services/ai && poetry install && cd ../..

# 2. Copy environment files
cp services/api/.env.example services/api/.env
cp services/ai/.env.example services/ai/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Start infrastructure
docker-compose up -d postgres redis

# 4. Run migrations + seed
cd services/api && pnpm prisma migrate dev && pnpm prisma db seed && cd ../..

# 5. Start everything
pnpm dev
```

Open `http://localhost:3000`. Login with phone `+919999999999` and OTP `123456`.

For full setup instructions → **[docs/setup/SETUP.md](docs/setup/SETUP.md)**

---

## Documentation

| Doc | Contents |
|-----|---------|
| [PREREQUISITES.md](docs/PREREQUISITES.md) | All tools, GCP setup, env vars, accounts needed |
| [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | System design, services, data flows, security |
| [DATA_MODEL.md](docs/architecture/DATA_MODEL.md) | FHIR R4 schemas, PostgreSQL tables, entity relationships |
| [AI_INTEGRATIONS.md](docs/ai/AI_INTEGRATIONS.md) | MedGemma, MedASR, CXR, Vertex AI setup + code examples |
| [API.md](docs/api/API.md) | All REST endpoints, request/response schemas |
| [SETUP.md](docs/setup/SETUP.md) | Step-by-step local dev environment guide |

---

## Repository Structure

```
cliniqai/
├── apps/
│   ├── mobile/          # React Native doctor app (iOS + Android)
│   ├── web/             # Next.js web dashboard
│   └── patient-app/     # React Native patient companion app
├── services/
│   ├── api/             # Node.js core API
│   ├── ai/              # Python FastAPI AI service
│   ├── notifications/   # SMS, WhatsApp, push notification worker
│   └── fhir/            # FHIR R4 adapter (Google Healthcare API)
├── packages/
│   ├── ui/              # Shared React component library
│   ├── types/           # Shared TypeScript types
│   └── config/          # Shared ESLint, Prettier, tsconfig
├── infrastructure/
│   ├── terraform/       # GCP infrastructure as code
│   └── k8s/             # Kubernetes manifests
├── docs/                # All documentation
└── docker-compose.yml   # Local dev infrastructure
```

---

## Development Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** (Months 1–4) | Doctor auth, patients, appointments, prescriptions, billing | In progress |
| **Phase 2** (Months 3–6) | MedGemma AI, voice Rx, DDI alerts, CXR, lab AI | Planned |
| **Phase 3** (Months 5–9) | Pharmacy, telemedicine, patient app, offline mode | Planned |
| **Phase 4** (Months 9–14) | Multi-doctor, IPD, insurance, hospital features | Planned |

---

## Pricing

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | ₹0 | Unlimited patients, EMR, prescriptions, appointments, billing |
| Pro | ₹7,999/year | + AI voice Rx, telemedicine, pharmacy, analytics, WhatsApp |
| Clinic | ₹24,999/year | + Multi-doctor, role access, advanced AI, lab integration |
| Hospital | Custom | + IPD, insurance, SLA support |

---

## Contributing

1. Fork the repo and create a `feat/*` or `fix/*` branch
2. Follow [Conventional Commits](https://www.conventionalcommits.org/)
3. Ensure `pnpm test` and `pnpm lint` pass
4. Submit a PR against `staging`

---

## License

Proprietary — All rights reserved.
