#!/usr/bin/env bash
#
# CliniqAI — One-command demo setup
#
# Usage:  ./scripts/demo-setup.sh
#
# What it does:
#   1. Starts PostgreSQL + Redis via Docker Compose
#   2. Installs dependencies (pnpm)
#   3. Copies demo .env files (if not present)
#   4. Runs database migrations
#   5. Seeds demo data (doctor + clinic + patients)
#   6. Starts all services (API + Web + AI)
#
# Prerequisites:
#   - Docker & Docker Compose
#   - Node.js >= 20
#   - pnpm >= 9
#   - Python >= 3.10 + Poetry (for AI service, optional)

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

log "Prerequisites OK (Docker, Node $(node -v), pnpm)"

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

info "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
log "Dependencies installed"

# ── 4. Set up environment files ───────────────────────────────────────────────

setup_env() {
  local target="$1"
  local source="$2"
  if [ ! -f "$target" ]; then
    cp "$source" "$target"
    log "Created $target"
  else
    warn "$target already exists — skipping"
  fi
}

# API — ensure demo-friendly settings
if [ ! -f services/api/.env ]; then
  cp services/api/.env.example services/api/.env
  log "Created services/api/.env"
fi

# Ensure demo flags are set
if ! grep -q "ALLOW_DEV_OTP" services/api/.env 2>/dev/null; then
  echo "" >> services/api/.env
  echo "# Demo mode — OTP is returned in API response for easy login" >> services/api/.env
  echo "ALLOW_DEV_OTP=true" >> services/api/.env
  log "Added ALLOW_DEV_OTP=true to API .env"
fi

# Web
setup_env "apps/web/.env" "apps/web/.env.example"

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
echo -e "  ${BLUE}To start all services:${NC}"
echo "    pnpm dev"
echo ""
echo -e "  ${BLUE}Then open:${NC}"
echo "    Web dashboard: http://localhost:3000"
echo ""
echo -e "  ${BLUE}Demo login:${NC}"
echo "    Phone:    +919876543210"
echo "    Password: demo1234"
echo "    (OTP will auto-fill in dev mode)"
echo ""
echo -e "  ${BLUE}What you'll see:${NC}"
echo "    • 12 patients with real medical histories"
echo "    • 8 completed consultations with SOAP notes"
echo "    • Today's appointment queue (4 patients)"
echo "    • Pharmacy inventory (5 common medicines)"
echo "    • Lab orders, prescriptions, invoices"
echo "    • Analytics dashboard with real data"
echo ""
echo -e "  ${YELLOW}Optional — AI features (needs Gemini API key):${NC}"
echo "    1. Get free key: https://aistudio.google.com/apikey"
echo "    2. Add to services/ai/.env: GEMINI_API_KEY=your-key"
echo "    3. Start AI: pnpm dev:ai"
echo ""
