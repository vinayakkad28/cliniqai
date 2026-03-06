import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env["ENCRYPTION_KEY"];
  if (!key || key.length < 32) throw new Error("ENCRYPTION_KEY must be at least 32 chars");
  return Buffer.from(key.slice(0, 32), "utf8");
}

/**
 * Encrypt a plaintext string (for PHI fields like phone, national ID stored in DB).
 * Returns: `iv:authTag:ciphertext` as a hex-colon-separated string.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encoded: string): string {
  const [ivHex, authTagHex, encHex] = encoded.split(":");
  if (!ivHex || !authTagHex || !encHex) throw new Error("Invalid encrypted value");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}
