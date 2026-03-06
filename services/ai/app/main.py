from fastapi import FastAPI
from app.config import settings
from app.routers import (
    voice, prescription, ddi, diagnosis, notes, imaging, lab, records, discharge,
    documents, longitudinal, alerts, embed,
)

app = FastAPI(
    title="CliniqAI AI Service",
    description="MedGemma-powered clinical decision support endpoints",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

# Health check (unauthenticated — used by Cloud Run health probes)
@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "cliniqai-ai", "version": "0.1.0"}

# Phase 1 — Core AI
app.include_router(voice.router)
app.include_router(prescription.router)
app.include_router(ddi.router)
app.include_router(diagnosis.router)
app.include_router(notes.router)
app.include_router(imaging.router)
app.include_router(lab.router)
app.include_router(records.router)
app.include_router(discharge.router)

# Phase 2 — Document Intelligence
app.include_router(documents.router)
app.include_router(embed.router)

# Phase 3 — Longitudinal AI + Clinical Alerts
app.include_router(longitudinal.router)
app.include_router(alerts.router)
