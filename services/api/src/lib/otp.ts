import crypto from "crypto";
import bcrypt from "bcryptjs";

const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

export function generateOtp(): string {
  // Cryptographically random 6-digit OTP
  const bytes = crypto.randomBytes(3);
  const num = (bytes.readUIntBE(0, 3) % 900_000) + 100_000;
  return num.toString();
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

export function otpExpiresAt(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + OTP_EXPIRY_MINUTES);
  return d;
}
