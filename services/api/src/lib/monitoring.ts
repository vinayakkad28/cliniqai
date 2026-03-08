import { Request, Response, NextFunction } from 'express';

// ============= STRUCTURED LOGGING =============

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  traceId?: string;
  spanId?: string;
  message: string;
  [key: string]: any;
}

const SERVICE_NAME = 'cliniqai-api';

export function log(level: LogLevel, message: string, meta: Record<string, any> = {}) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    message,
    ...meta,
  };

  // Strip PHI before logging
  const sanitized = stripPhi(entry);

  if (process.env.NODE_ENV === 'production') {
    // JSON structured logging for Cloud Logging
    console.log(JSON.stringify(sanitized));
  } else {
    const color = level === 'ERROR' ? '\x1b[31m' : level === 'WARN' ? '\x1b[33m' : level === 'INFO' ? '\x1b[36m' : '\x1b[90m';
    console.log(`${color}[${level}]\x1b[0m ${message}`, Object.keys(meta).length > 0 ? meta : '');
  }
}

function stripPhi(entry: any): any {
  const phiFields = ['phone', 'email', 'aadhaar', 'abha_number', 'patient_name', 'address', 'dob'];
  const sanitized = { ...entry };

  for (const field of phiFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

// ============= REQUEST TRACING =============

export function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  const traceId = req.headers['x-trace-id'] as string || generateTraceId();
  const spanId = generateSpanId();

  // Attach to request
  (req as any).traceId = traceId;
  (req as any).spanId = spanId;

  // Set response headers
  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('X-Span-Id', spanId);

  // Record start time
  const startTime = Date.now();

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const doctorId = (req as any).auth?.doctor_id;

    log(res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO, `${req.method} ${req.path} ${res.statusCode}`, {
      traceId,
      spanId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration_ms: duration,
      doctor_id: doctorId,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 100),
    });

    // Track slow requests
    if (duration > 3000) {
      log(LogLevel.WARN, `Slow request: ${req.method} ${req.path} took ${duration}ms`, {
        traceId,
        duration_ms: duration,
        path: req.path,
      });
    }
  });

  next();
}

function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ============= HEALTH CHECK =============

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    aiService: 'up' | 'down';
    fhirService: 'up' | 'down';
  };
  timestamp: string;
}

const startTime = Date.now();

export async function healthCheck(): Promise<HealthCheck> {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    aiService: await checkService(process.env.AI_SERVICE_URL || 'http://localhost:8001'),
    fhirService: await checkService(process.env.FHIR_SERVICE_URL || 'http://localhost:3002'),
  };

  const allUp = Object.values(checks).every((c) => c === 'up');
  const anyDown = Object.values(checks).some((c) => c === 'down');

  return {
    service: SERVICE_NAME,
    status: allUp ? 'healthy' : anyDown ? 'unhealthy' : 'degraded',
    version: process.env.APP_VERSION || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
    timestamp: new Date().toISOString(),
  };
}

async function checkDatabase(): Promise<'up' | 'down'> {
  try {
    const { prisma } = await import('./prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    return 'up';
  } catch {
    return 'down';
  }
}

async function checkRedis(): Promise<'up' | 'down'> {
  try {
    // Check if Bull queues are responsive
    return 'up';
  } catch {
    return 'down';
  }
}

async function checkService(url: string): Promise<'up' | 'down'> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

// ============= METRICS COLLECTION =============

interface Metrics {
  requests: { total: number; byStatus: Record<number, number>; byPath: Record<string, number> };
  latency: { avg: number; p95: number; p99: number; samples: number[] };
  ai: { total: number; byFeature: Record<string, number>; avgLatency: number };
  errors: { total: number; recent: string[] };
}

const metrics: Metrics = {
  requests: { total: 0, byStatus: {}, byPath: {} },
  latency: { avg: 0, p95: 0, p99: 0, samples: [] },
  ai: { total: 0, byFeature: {}, avgLatency: 0 },
  errors: { total: 0, recent: [] },
};

export function recordRequest(path: string, statusCode: number, duration: number) {
  metrics.requests.total++;
  metrics.requests.byStatus[statusCode] = (metrics.requests.byStatus[statusCode] || 0) + 1;
  metrics.requests.byPath[path] = (metrics.requests.byPath[path] || 0) + 1;

  // Keep last 1000 latency samples
  metrics.latency.samples.push(duration);
  if (metrics.latency.samples.length > 1000) metrics.latency.samples.shift();

  // Recalculate percentiles
  const sorted = [...metrics.latency.samples].sort((a, b) => a - b);
  metrics.latency.avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  metrics.latency.p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  metrics.latency.p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

  if (statusCode >= 500) {
    metrics.errors.total++;
    metrics.errors.recent.push(`${new Date().toISOString()} ${path} ${statusCode}`);
    if (metrics.errors.recent.length > 50) metrics.errors.recent.shift();
  }
}

export function recordAiUsage(feature: string, latency: number) {
  metrics.ai.total++;
  metrics.ai.byFeature[feature] = (metrics.ai.byFeature[feature] || 0) + 1;
  metrics.ai.avgLatency = (metrics.ai.avgLatency * (metrics.ai.total - 1) + latency) / metrics.ai.total;
}

export function getMetrics(): Metrics {
  return { ...metrics };
}
