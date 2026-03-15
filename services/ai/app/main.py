import time
import uuid

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import (
    voice, prescription, ddi, diagnosis, notes, imaging, lab, records, discharge,
    documents, longitudinal, alerts, embed,
)

# Structured logging setup
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer() if settings.environment != "production"
        else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        structlog.get_config().get("min_level", 0)  # type: ignore[arg-type]
    ),
)

log = structlog.get_logger()

app = FastAPI(
    title="CliniqAI AI Service",
    description="MedGemma-powered clinical decision support endpoints",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def logging_middleware(request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
    correlation_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    start = time.perf_counter()
    response: Response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 1)

    if request.url.path != "/health":
        log.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
            correlation_id=correlation_id,
        )

    response.headers["X-Request-ID"] = correlation_id
    return response


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
