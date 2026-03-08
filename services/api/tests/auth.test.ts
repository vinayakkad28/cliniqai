import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signAccessToken, signRefreshToken, verifyToken } from '../src/lib/jwt';
import { generateOtp, hashOtp, verifyOtp } from '../src/lib/otp';
import { encrypt, decrypt } from '../src/lib/crypto';

describe('JWT Token Management', () => {
  const mockPayload = {
    sub: 'user-123',
    role: 'doctor' as const,
    doctor_id: 'doc-456',
    clinic_id: 'clinic-789',
    scope: ['patients:read', 'patients:write', 'prescriptions:write'],
  };

  it('should sign and verify access token', () => {
    const token = signAccessToken(mockPayload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.role).toBe('doctor');
    expect(decoded.doctor_id).toBe('doc-456');
  });

  it('should sign and verify refresh token', () => {
    const token = signRefreshToken({ sub: 'user-123' });
    expect(token).toBeTruthy();
  });

  it('should reject invalid token', () => {
    expect(() => verifyToken('invalid-token')).toThrow();
  });

  it('should reject tampered token', () => {
    const token = signAccessToken(mockPayload);
    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(() => verifyToken(tampered)).toThrow();
  });
});

describe('OTP Generation and Verification', () => {
  it('should generate 6-digit OTP', () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('should generate unique OTPs', () => {
    const otps = new Set(Array.from({ length: 100 }, () => generateOtp()));
    expect(otps.size).toBeGreaterThan(90); // At least 90% unique
  });

  it('should hash and verify OTP correctly', async () => {
    const otp = '123456';
    const hash = await hashOtp(otp);
    expect(hash).not.toBe(otp);

    const isValid = await verifyOtp(otp, hash);
    expect(isValid).toBe(true);
  });

  it('should reject wrong OTP', async () => {
    const hash = await hashOtp('123456');
    const isValid = await verifyOtp('654321', hash);
    expect(isValid).toBe(false);
  });
});

describe('PHI Encryption', () => {
  it('should encrypt and decrypt phone numbers', () => {
    const phone = '+919876543210';
    const encrypted = encrypt(phone);
    expect(encrypted).not.toBe(phone);
    expect(encrypted).toContain(':'); // iv:authTag:ciphertext format

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(phone);
  });

  it('should produce different ciphertexts for same plaintext', () => {
    const phone = '+919876543210';
    const enc1 = encrypt(phone);
    const enc2 = encrypt(phone);
    expect(enc1).not.toBe(enc2); // Random IV ensures uniqueness
  });

  it('should handle empty strings', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });
});
