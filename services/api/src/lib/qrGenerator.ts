import QRCode from "qrcode";
import { createHmac } from "crypto";

const API_BASE_URL = process.env["API_BASE_URL"] ?? "http://localhost:3001";
const ENCRYPTION_KEY = process.env["ENCRYPTION_KEY"] ?? "dev-key-change-in-production";

export interface QRPayload {
  prescriptionId: string;
  doctorLicenseNumber: string;
  doctorName: string;
  timestamp: string;
  verifyUrl: string;
  signature: string;
}

/** Compute HMAC-SHA256 digital signature for a prescription */
export function computeDigitalSignature(prescriptionId: string, doctorId: string, createdAt: Date | string): string {
  const data = `${prescriptionId}|${doctorId}|${new Date(createdAt).toISOString()}`;
  return createHmac("sha256", ENCRYPTION_KEY).update(data).digest("hex");
}

/** Verify a digital signature */
export function verifyDigitalSignature(
  prescriptionId: string,
  doctorId: string,
  createdAt: Date | string,
  signature: string,
): boolean {
  const expected = computeDigitalSignature(prescriptionId, doctorId, createdAt);
  return expected === signature;
}

/** Generate QR code PNG buffer for a prescription */
export async function generatePrescriptionQR(data: {
  prescriptionId: string;
  doctorLicenseNumber: string;
  doctorName: string;
  createdAt: Date | string;
  doctorId: string;
}): Promise<Buffer> {
  const signature = computeDigitalSignature(data.prescriptionId, data.doctorId, data.createdAt);
  const verifyUrl = `${API_BASE_URL}/api/prescriptions/verify/${data.prescriptionId}`;

  const payload: QRPayload = {
    prescriptionId: data.prescriptionId,
    doctorLicenseNumber: data.doctorLicenseNumber,
    doctorName: data.doctorName,
    timestamp: new Date(data.createdAt).toISOString(),
    verifyUrl,
    signature,
  };

  const pngBuffer = await QRCode.toBuffer(JSON.stringify(payload), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 200,
    color: { dark: "#1e40af", light: "#ffffff" },
  });

  return pngBuffer;
}
