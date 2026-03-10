#!/usr/bin/env bash
#
# CliniqAI — One-command demo setup
#
# Usage:  ./scripts/demo-setup.sh
#         GEMINI_API_KEY=AIza... ./scripts/demo-setup.sh   (with AI features)
#
# What it does:
#   1. Starts PostgreSQL + Redis via Docker Compose
#   2. Installs dependencies (pnpm + poetry)
#   3. Creates .env files with demo-friendly defaults
#   4. Runs database migrations
#   5. Seeds demo data (doctor + clinic + patients)
#   6. Prints instructions to start services
#
# Prerequisites:
#   - Docker & Docker Compose
#   - Node.js >= 20
#   - pnpm >= 9
#   - Python >= 3.10 + Poetry (for AI service)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# ── Colors ─────────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   🏥 CliniqAI Demo Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────────────────────

info "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { err "Docker not found. Install from https://docker.com"; exit 1; }
command -v node >/dev/null 2>&1 || { err "Node.js not found. Install v20+ from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { err "pnpm not found. Run: npm install -g pnpm"; exit 1; }

NODE_V=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_V" -lt 20 ]; then
  err "Node.js v20+ required (found v$(node -v))"
  exit 1
fi

# Check Python + Poetry for AI service
AI_READY=false
if command -v python3 >/dev/null 2>&1 && command -v poetry >/dev/null 2>&1; then
  PYTHON_V=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
  AI_READY=true
  log "Prerequisites OK (Docker, Node $(node -v), pnpm, Python $PYTHON_V, Poetry)"
else
  warn "Python 3.11+ or Poetry not found — AI service will be skipped"
  warn "Install: https://python.org + pip install poetry"
  log "Prerequisites OK (Docker, Node $(node -v), pnpm)"
fi

# ── 2. Start infrastructure ───────────────────────────────────────────────────

info "Starting PostgreSQL and Redis..."
docker compose up -d postgres redis

# Wait for PostgreSQL to be ready
info "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U cliniqai_user -d cliniqai >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    err "PostgreSQL failed to start in 30 seconds"
    exit 1
  fi
  sleep 1
done
log "PostgreSQL ready"

# ── 3. Install dependencies ───────────────────────────────────────────────────

info "Installing Node.js dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
log "Node.js dependencies installed"

if [ "$AI_READY" = true ]; then
  info "Installing AI service Python dependencies..."
  cd services/ai
  poetry install 2>&1 | tail -3
  cd "$ROOT_DIR"
  log "AI service dependencies installed"
fi

# ── 4. Set up environment files ───────────────────────────────────────────────

info "Setting up environment files..."

# API .env
if [ ! -f services/api/.env ]; then
  cp services/api/.env.example services/api/.env
  log "Created services/api/.env"
else
  warn "services/api/.env already exists — skipping"
fi

# Ensure demo flags are set in API .env
if ! grep -q "ALLOW_DEV_OTP" services/api/.env 2>/dev/null; then
  echo "" >> services/api/.env
  echo "# Demo mode — OTP is returned in API response for easy login" >> services/api/.env
  echo "ALLOW_DEV_OTP=true" >> services/api/.env
  log "Added ALLOW_DEV_OTP=true to API .env"
fi

# Web .env
if [ ! -f apps/web/.env ]; then
  cp apps/web/.env.example apps/web/.env
  log "Created apps/web/.env"
else
  warn "apps/web/.env already exists — skipping"
fi

# AI service .env
if [ ! -f services/ai/.env ]; then
  cat > services/ai/.env << 'AIENV'
# App
ENVIRONMENT=development
PORT=8001

# Internal service auth (must match API service)
INTERNAL_TOKEN=change-me-internal-secret

# AI Backend — Gemini API (free tier)
GEMINI_BACKEND=gemini_api
GEMINI_API_KEY=REPLACE_ME

# Drug Interaction Database
DDI_DB_URL=postgresql://cliniqai_user:cliniqai_dev_password@localhost:5432/cliniqai

# Rate Limiting
AI_RATE_LIMIT_PER_MINUTE=60

# Sentry
SENTRY_DSN=
AIENV
  log "Created services/ai/.env"
fi

# Set Gemini API key if provided via environment variable
if [ -n "${GEMINI_API_KEY:-}" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|GEMINI_API_KEY=.*|GEMINI_API_KEY=${GEMINI_API_KEY}|" services/ai/.env
  else
    sed -i "s|GEMINI_API_KEY=.*|GEMINI_API_KEY=${GEMINI_API_KEY}|" services/ai/.env
  fi
  log "Gemini API key configured in AI service"
elif grep -q "REPLACE_ME" services/ai/.env 2>/dev/null; then
  warn "No GEMINI_API_KEY set — AI features won't work"
  warn "Get a free key: https://aistudio.google.com/apikey"
  warn "Then run: GEMINI_API_KEY=your-key ./scripts/demo-setup.sh"
fi

# ── 5. Generate Prisma client + migrate ────────────────────────────────────────

info "Running database migrations..."
cd services/api
npx prisma generate
npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name demo_init
cd "$ROOT_DIR"
log "Database migrated"

# ── 6. Seed demo data ─────────────────────────────────────────────────────────

info "Seeding demo data..."
cd services/api
npx tsx prisma/seed.ts
cd "$ROOT_DIR"

# ── 7. Print summary ──────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   🎉 Demo environment ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BLUE}Start all services:${NC}"
echo "    pnpm dev"
echo ""
echo -e "  ${BLUE}Then open:${NC}"
echo "    Web dashboard: http://localhost:3000"
echo ""
echo -e "  ${BLUE}Demo login:${NC}"
echo "    Phone:    9876543210  (enter without +91)"
echo "    OTP will auto-fill — just click 'Verify & Login'"
echo ""
echo -e "  ${BLUE}What you'll see:${NC}"
echo "    • 12 patients with real medical histories"
echo "    • 8 completed consultations with SOAP notes"
echo "    • Today's appointment queue (4 patients)"
echo "    • Pharmacy inventory (5 common medicines)"
echo "    • Lab orders, prescriptions, invoices"
echo "    • Analytics dashboard with real data"

if [ "$AI_READY" = true ] && ! grep -q "REPLACE_ME" services/ai/.env 2>/dev/null; then
  echo ""
  echo -e "  ${GREEN}AI features enabled:${NC}"
  echo "    • Diagnosis suggestions during consultations"
  echo "    • Drug interaction checks when prescribing"
  echo "    • Lab report interpretation"
  echo "    • SOAP note generation"
else
  echo ""
  echo -e "  ${YELLOW}To enable AI features:${NC}"
  echo "    1. Get free key: https://aistudio.google.com/apikey"
  echo "    2. Run: GEMINI_API_KEY=your-key ./scripts/demo-setup.sh"
fi
echo ""
