/**
 * Object storage client — dual backend.
 *
 * STORAGE_BACKEND=r2   → Cloudflare R2 (free 10 GB, free egress) [DEFAULT for MVP]
 * STORAGE_BACKEND=gcs  → Google Cloud Storage (switch when on GCP)
 *
 * Both use S3-compatible presigned URLs so the upload flow is identical.
 * In dev (no credentials) returns mock URLs so nothing breaks locally.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BACKEND = process.env["STORAGE_BACKEND"] ?? "r2";
const IS_DEV = process.env["NODE_ENV"] === "development";
const BUCKET = process.env["STORAGE_BUCKET"] ?? "cliniqai-documents";

// ─── Cloudflare R2 client (S3-compatible) ─────────────────────────────────────

let _r2: S3Client | null = null;
function getR2(): S3Client {
  if (!_r2) {
    _r2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env["R2_ACCESS_KEY_ID"] ?? "",
        secretAccessKey: process.env["R2_SECRET_ACCESS_KEY"] ?? "",
      },
    });
  }
  return _r2;
}

// ─── GCS client (also S3-compatible via HMAC keys) ────────────────────────────

let _gcs: S3Client | null = null;
function getGcs(): S3Client {
  if (!_gcs) {
    _gcs = new S3Client({
      region: "auto",
      endpoint: "https://storage.googleapis.com",
      credentials: {
        accessKeyId: process.env["GCS_HMAC_KEY"] ?? "",
        secretAccessKey: process.env["GCS_HMAC_SECRET"] ?? "",
      },
    });
  }
  return _gcs;
}

function getClient(): S3Client {
  return BACKEND === "gcs" ? getGcs() : getR2();
}

function isConfigured(): boolean {
  if (BACKEND === "r2") return Boolean(process.env["R2_ACCOUNT_ID"] && process.env["R2_ACCESS_KEY_ID"]);
  return Boolean(process.env["GCS_HMAC_KEY"]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getSignedUploadUrl(objectKey: string, mimeType: string): Promise<string> {
  if (IS_DEV && !isConfigured()) {
    return `http://localhost:9999/dev-storage-upload/${encodeURIComponent(objectKey)}`;
  }
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: BUCKET, Key: objectKey, ContentType: mimeType }),
    { expiresIn: 900 }, // 15 minutes
  );
}

export async function getSignedReadUrl(objectKey: string): Promise<string> {
  if (IS_DEV && !isConfigured()) {
    return `http://localhost:9999/dev-storage-read/${encodeURIComponent(objectKey)}`;
  }
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: BUCKET, Key: objectKey }),
    { expiresIn: 3600 }, // 1 hour
  );
}

export async function deleteGcsFile(objectKey: string): Promise<void> {
  if (IS_DEV && !isConfigured()) return;
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey }));
  } catch {
    // best-effort
  }
}
