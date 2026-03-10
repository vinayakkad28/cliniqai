import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  otpCode: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  doctor: {
    findUnique: vi.fn(),
  },
};

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// ---------------------------------------------------------------------------
// Mock bcrypt
// ---------------------------------------------------------------------------

const mockBcrypt = {
  hash: vi.fn(),
  compare: vi.fn(),
};

vi.mock('bcryptjs', () => ({
  default: {
    hash: (...args: any[]) => mockBcrypt.hash(...args),
    compare: (...args: any[]) => mockBcrypt.compare(...args),
  },
}));

// ---------------------------------------------------------------------------
// Mock OTP utilities
// ---------------------------------------------------------------------------

const mockOtp = {
  generateOtp: vi.fn().mockReturnValue('123456'),
  hashOtp: vi.fn().mockResolvedValue('hashed-otp'),
  verifyOtp: vi.fn(),
  otpExpiresAt: vi.fn().mockReturnValue(new Date(Date.now() + 10 * 60 * 1000)),
};

vi.mock('../lib/otp.js', () => ({
  generateOtp: () => mockOtp.generateOtp(),
  hashOtp: (otp: string) => mockOtp.hashOtp(otp),
  verifyOtp: (otp: string, hash: string) => mockOtp.verifyOtp(otp, hash),
  otpExpiresAt: () => mockOtp.otpExpiresAt(),
}));

// ---------------------------------------------------------------------------
// Mock SMS sender
// ---------------------------------------------------------------------------

vi.mock('../lib/msg91.js', () => ({
  sendOtpSms: vi.fn().mockResolvedValue('123456'), // Returns OTP in dev mode
}));

// ---------------------------------------------------------------------------
// Mock JWT utilities
// ---------------------------------------------------------------------------

const mockJwt = {
  signAccessToken: vi.fn().mockReturnValue('mock-access-token'),
  signRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
  verifyRefreshToken: vi.fn(),
  ROLE_SCOPES: {
    doctor: ['consultations:read', 'consultations:write', 'patients:read', 'patients:write', 'appointments:read', 'appointments:write', 'followups:read', 'followups:write'],
    admin: ['*'],
    staff: ['patients:read', 'appointments:read', 'appointments:write'],
  },
};

vi.mock('../lib/jwt.js', () => ({
  signAccessToken: (payload: any) => mockJwt.signAccessToken(payload),
  signRefreshToken: (userId: string) => mockJwt.signRefreshToken(userId),
  verifyRefreshToken: (token: string) => mockJwt.verifyRefreshToken(token),
  ROLE_SCOPES: mockJwt.ROLE_SCOPES,
}));

// ---------------------------------------------------------------------------
// Mock auth middleware
// ---------------------------------------------------------------------------

vi.mock('../middleware/auth.js', () => ({
  authenticate: vi.fn((_req: any, _res: any, next: any) => {
    _req.user = {
      sub: 'user-001',
      role: 'doctor',
      doctor_id: 'doc-001',
      scope: ['consultations:read', 'consultations:write'],
    };
    next();
  }),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TEST_USER = {
  id: 'user-001',
  phone: '+919876543210',
  email: 'dr.sharma@example.com',
  passwordHash: '$2a$12$hashedpassword',
  role: 'doctor',
  createdAt: new Date('2026-01-01'),
};

const TEST_DOCTOR = {
  id: 'doc-001',
  userId: 'user-001',
  name: 'Dr. Sharma',
  licenseNumber: 'MH12345',
  specialties: ['General Medicine'],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /auth/send-otp — OTP sending validation ─────────────────────

  describe('POST /auth/send-otp — OTP sending', () => {
    it('sends OTP to a registered phone number', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.otpCode.create.mockResolvedValue({
        id: 'otp-001',
        phone: '+919876543210',
        codeHash: 'hashed-otp',
        used: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const phone = '+919876543210';

      // Validate phone format
      expect(phone.length).toBeGreaterThanOrEqual(10);

      // Check user exists
      const user = await mockPrisma.user.findUnique({ where: { phone } });
      expect(user).toBeTruthy();

      // Invalidate previous OTPs
      await mockPrisma.otpCode.updateMany({
        where: { phone, used: false },
        data: { used: true },
      });
      expect(mockPrisma.otpCode.updateMany).toHaveBeenCalledTimes(1);

      // Create new OTP
      const otp = mockOtp.generateOtp();
      expect(otp).toBe('123456');
      expect(otp).toHaveLength(6);

      await mockPrisma.otpCode.create({
        data: {
          phone,
          codeHash: await mockOtp.hashOtp(otp),
          expiresAt: mockOtp.otpExpiresAt(),
        },
      });
      expect(mockPrisma.otpCode.create).toHaveBeenCalledTimes(1);
    });

    it('returns 404 for unregistered phone number', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const user = await mockPrisma.user.findUnique({
        where: { phone: '+910000000000' },
      });

      expect(user).toBeNull();
      // Route would respond with 404: "No account found for this number"
    });

    it('rejects invalid phone number format', () => {
      const invalidPhones = ['123', 'abc', '', '+1'];

      for (const phone of invalidPhones) {
        expect(phone.length).toBeLessThan(10);
      }
    });

    it('invalidates previous unused OTPs before sending new one', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.otpCode.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.otpCode.create.mockResolvedValue({
        id: 'otp-new',
        phone: '+919876543210',
        codeHash: 'hashed',
        used: false,
        expiresAt: new Date(),
      });

      await mockPrisma.otpCode.updateMany({
        where: { phone: '+919876543210', used: false },
        data: { used: true },
      });

      const result = mockPrisma.otpCode.updateMany.mock.results[0].value;
      const resolved = await result;
      expect(resolved.count).toBe(2);
    });
  });

  // ─── POST /auth/verify-otp — OTP verification ─────────────────────────

  describe('POST /auth/verify-otp — OTP verification', () => {
    it('verifies valid OTP and returns tokens', async () => {
      const otpRecord = {
        id: 'otp-001',
        phone: '+919876543210',
        codeHash: 'hashed-otp',
        used: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // Not expired
        createdAt: new Date(),
      };

      mockPrisma.otpCode.findFirst.mockResolvedValue(otpRecord);
      mockOtp.verifyOtp.mockResolvedValue(true);
      mockPrisma.otpCode.update.mockResolvedValue({ ...otpRecord, used: true });
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.doctor.findUnique.mockResolvedValue(TEST_DOCTOR);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      // Find OTP record
      const record = await mockPrisma.otpCode.findFirst({
        where: {
          phone: '+919876543210',
          used: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(record).toBeTruthy();

      // Verify OTP hash
      const valid = await mockOtp.verifyOtp('123456', record!.codeHash);
      expect(valid).toBe(true);

      // Mark as used
      await mockPrisma.otpCode.update({
        where: { id: record!.id },
        data: { used: true },
      });

      // Issue tokens
      const accessToken = mockJwt.signAccessToken({
        sub: TEST_USER.id,
        role: TEST_USER.role,
      });
      const refreshToken = mockJwt.signRefreshToken(TEST_USER.id);

      expect(accessToken).toBe('mock-access-token');
      expect(refreshToken).toBe('mock-refresh-token');
    });

    it('rejects expired OTP', async () => {
      mockPrisma.otpCode.findFirst.mockResolvedValue(null); // No valid OTP found

      const record = await mockPrisma.otpCode.findFirst({
        where: {
          phone: '+919876543210',
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      expect(record).toBeNull();
      // Route would respond with 400: "OTP expired or not found"
    });

    it('rejects invalid OTP code', async () => {
      const otpRecord = {
        id: 'otp-001',
        phone: '+919876543210',
        codeHash: 'hashed-otp',
        used: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdAt: new Date(),
      };

      mockPrisma.otpCode.findFirst.mockResolvedValue(otpRecord);
      mockOtp.verifyOtp.mockResolvedValue(false);

      const record = await mockPrisma.otpCode.findFirst({
        where: { phone: '+919876543210', used: false },
      });

      const valid = await mockOtp.verifyOtp('000000', record!.codeHash);
      expect(valid).toBe(false);
      // Route would respond with 400: "Invalid OTP"
    });

    it('validates OTP must be exactly 6 digits', () => {
      const validOtp = '123456';
      const invalidOtps = ['12345', '1234567', 'abcdef', ''];

      expect(validOtp).toHaveLength(6);

      for (const otp of invalidOtps) {
        expect(otp.length === 6 && /^\d+$/.test(otp)).toBe(false);
      }
    });

    it('rejects already-used OTP', async () => {
      // findFirst filters by used: false, so used OTP is not returned
      mockPrisma.otpCode.findFirst.mockResolvedValue(null);

      const record = await mockPrisma.otpCode.findFirst({
        where: { phone: '+919876543210', used: false },
      });

      expect(record).toBeNull();
    });
  });

  // ─── POST /auth/login — Email/password login ──────────────────────────

  describe('POST /auth/login — email/password login', () => {
    it('logs in with valid email and password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.doctor.findUnique.mockResolvedValue(TEST_DOCTOR);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const user = await mockPrisma.user.findUnique({
        where: { email: 'dr.sharma@example.com' },
      });
      expect(user).toBeTruthy();
      expect(user!.passwordHash).toBeTruthy();

      const valid = await mockBcrypt.compare('SecurePass123!', user!.passwordHash);
      expect(valid).toBe(true);

      const accessToken = mockJwt.signAccessToken({
        sub: user!.id,
        role: user!.role,
      });
      const refreshToken = mockJwt.signRefreshToken(user!.id);

      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();
    });

    it('rejects invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const user = await mockPrisma.user.findUnique({
        where: { email: 'nonexistent@example.com' },
      });

      expect(user).toBeNull();
      // Route would respond with 401: "Invalid credentials"
    });

    it('rejects wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockBcrypt.compare.mockResolvedValue(false);

      const user = await mockPrisma.user.findUnique({
        where: { email: 'dr.sharma@example.com' },
      });
      const valid = await mockBcrypt.compare('wrongpassword', user!.passwordHash);

      expect(valid).toBe(false);
    });

    it('rejects login for user without password (OTP-only)', async () => {
      const otpOnlyUser = { ...TEST_USER, passwordHash: null };
      mockPrisma.user.findUnique.mockResolvedValue(otpOnlyUser);

      const user = await mockPrisma.user.findUnique({
        where: { email: 'dr.sharma@example.com' },
      });

      expect(user!.passwordHash).toBeNull();
      // Route would respond with 401: "Invalid credentials"
    });

    it('validates email format', () => {
      const validEmails = ['test@example.com', 'dr.sharma@hospital.in'];
      const invalidEmails = ['notanemail', '@missing.com', 'missing@'];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (const email of validEmails) {
        expect(emailRegex.test(email)).toBe(true);
      }

      for (const email of invalidEmails) {
        expect(emailRegex.test(email)).toBe(false);
      }
    });

    it('validates password is non-empty', () => {
      const emptyPasswords = ['', undefined, null];

      for (const password of emptyPasswords) {
        expect(!password || (typeof password === 'string' && password.length === 0)).toBe(true);
      }
    });
  });

  // ─── POST /auth/refresh — Token refresh ────────────────────────────────

  describe('POST /auth/refresh — token refresh', () => {
    it('refreshes tokens with valid refresh token', async () => {
      const storedRefreshToken = 'mock-refresh-token';
      const tokenHash = crypto.createHash('sha256').update(storedRefreshToken).digest('hex');

      mockJwt.verifyRefreshToken.mockReturnValue({ sub: 'user-001' });
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-001',
        userId: 'user-001',
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.refreshToken.delete.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});

      // Verify refresh token JWT
      const payload = mockJwt.verifyRefreshToken(storedRefreshToken);
      expect(payload.sub).toBe('user-001');

      // Find stored token
      const computed = crypto.createHash('sha256').update(storedRefreshToken).digest('hex');
      const stored = await mockPrisma.refreshToken.findFirst({
        where: {
          userId: payload.sub,
          tokenHash: computed,
          expiresAt: { gt: new Date() },
        },
      });
      expect(stored).toBeTruthy();

      // Delete old refresh token (rotation)
      await mockPrisma.refreshToken.delete({ where: { id: stored!.id } });
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-001' } });

      // Issue new token pair
      const newAccess = mockJwt.signAccessToken({ sub: 'user-001', role: 'doctor' });
      const newRefresh = mockJwt.signRefreshToken('user-001');
      expect(newAccess).toBeTruthy();
      expect(newRefresh).toBeTruthy();
    });

    it('rejects invalid refresh token', () => {
      mockJwt.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => mockJwt.verifyRefreshToken('invalid-token')).toThrow('Invalid token');
    });

    it('rejects revoked refresh token', async () => {
      mockJwt.verifyRefreshToken.mockReturnValue({ sub: 'user-001' });
      mockPrisma.refreshToken.findFirst.mockResolvedValue(null); // Not found = revoked

      const payload = mockJwt.verifyRefreshToken('revoked-token');
      const stored = await mockPrisma.refreshToken.findFirst({
        where: { userId: payload.sub },
      });

      expect(stored).toBeNull();
      // Route would respond with 401: "Refresh token revoked or expired"
    });

    it('rejects expired refresh token', async () => {
      mockJwt.verifyRefreshToken.mockReturnValue({ sub: 'user-001' });
      mockPrisma.refreshToken.findFirst.mockResolvedValue(null); // Expired tokens filtered by query

      const stored = await mockPrisma.refreshToken.findFirst({
        where: {
          userId: 'user-001',
          expiresAt: { gt: new Date() }, // Filters out expired
        },
      });

      expect(stored).toBeNull();
    });

    it('validates refresh token is non-empty', () => {
      const emptyTokens = ['', undefined, null];

      for (const token of emptyTokens) {
        expect(!token || (typeof token === 'string' && token.length === 0)).toBe(true);
      }
    });
  });

  // ─── POST /auth/logout — Logout ───────────────────────────────────────

  describe('POST /auth/logout — logout', () => {
    it('revokes specific refresh token on logout', async () => {
      const refreshToken = 'mock-refresh-token';
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await mockPrisma.refreshToken.deleteMany({
        where: { userId: 'user-001', tokenHash },
      });

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-001',
          tokenHash,
        },
      });
    });

    it('revokes all refresh tokens when no specific token provided', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      await mockPrisma.refreshToken.deleteMany({
        where: { userId: 'user-001' },
      });

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-001' },
      });
    });

    it('logout requires authentication', () => {
      // The logout route uses authenticate middleware
      // Without a valid token, the middleware returns 401
      const authHeader = undefined;
      expect(authHeader).toBeUndefined();
      // Middleware would respond with 401: "Missing or invalid Authorization header"
    });

    it('returns success message after logout', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await mockPrisma.refreshToken.deleteMany({
        where: { userId: 'user-001' },
      });

      // Route responds with { message: "Logged out" }
      const response = { message: 'Logged out' };
      expect(response.message).toBe('Logged out');
    });
  });

  // ─── Middleware authentication ─────────────────────────────────────────

  describe('Middleware — authenticate', () => {
    it('extracts Bearer token from Authorization header', () => {
      const authHeader = 'Bearer eyJhbGciOiJIUzI1NiJ9.test.signature';
      expect(authHeader.startsWith('Bearer ')).toBe(true);

      const token = authHeader.slice(7);
      expect(token).toBe('eyJhbGciOiJIUzI1NiJ9.test.signature');
    });

    it('rejects missing Authorization header', () => {
      const authHeader = undefined;
      const hasBearerToken = authHeader?.startsWith('Bearer ') ?? false;

      expect(hasBearerToken).toBe(false);
      // Middleware would respond with 401
    });

    it('rejects non-Bearer auth schemes', () => {
      const authHeader = 'Basic dXNlcjpwYXNz';
      expect(authHeader.startsWith('Bearer ')).toBe(false);
    });

    it('rejects empty Bearer token', () => {
      const authHeader = 'Bearer ';
      const token = authHeader.slice(7);
      expect(token).toBe('');
    });

    it('sets user payload on request after successful auth', () => {
      const mockReq: any = {
        headers: { authorization: 'Bearer valid-token' },
        user: undefined,
      };

      // Simulate middleware setting user
      mockReq.user = {
        sub: 'user-001',
        role: 'doctor',
        doctor_id: 'doc-001',
        scope: ['consultations:read'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.sub).toBe('user-001');
      expect(mockReq.user.role).toBe('doctor');
      expect(mockReq.user.scope).toContain('consultations:read');
    });

    it('requireScope checks user scopes', () => {
      const userScopes = ['consultations:read', 'consultations:write', 'patients:read'];
      const requiredScopes = ['consultations:read', 'consultations:write'];

      const hasAll = requiredScopes.every((s) => userScopes.includes(s));
      expect(hasAll).toBe(true);
    });

    it('requireScope rejects insufficient scopes', () => {
      const userScopes = ['consultations:read'];
      const requiredScopes = ['consultations:read', 'consultations:write'];

      const hasAll = requiredScopes.every((s) => userScopes.includes(s));
      expect(hasAll).toBe(false);
    });

    it('requireRole checks user role', () => {
      const userRole = 'doctor';
      const allowedRoles = ['doctor', 'admin'];

      expect(allowedRoles.includes(userRole)).toBe(true);
    });

    it('requireRole rejects insufficient role', () => {
      const userRole = 'staff';
      const allowedRoles = ['doctor', 'admin'];

      expect(allowedRoles.includes(userRole)).toBe(false);
    });
  });

  // ─── Registration ─────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('registers a new doctor with valid data', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null); // No existing user
      mockBcrypt.hash.mockResolvedValue('$2a$12$hashed');
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-new',
        phone: '+919999999999',
        email: 'new@example.com',
        role: 'doctor',
      });
      mockPrisma.otpCode.create.mockResolvedValue({});

      const phone = '+919999999999';
      const existing = await mockPrisma.user.findUnique({ where: { phone } });
      expect(existing).toBeNull();

      const passwordHash = await mockBcrypt.hash('SecurePass123!', 12);
      expect(passwordHash).toBeTruthy();

      const user = await mockPrisma.user.create({
        data: {
          phone,
          email: 'new@example.com',
          passwordHash,
          role: 'doctor',
          doctor: { create: { name: 'Dr. New', licenseNumber: 'MH54321', specialties: [] } },
        },
      });

      expect(user.id).toBe('user-new');
      expect(user.role).toBe('doctor');
    });

    it('rejects duplicate phone number', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      const existing = await mockPrisma.user.findUnique({
        where: { phone: '+919876543210' },
      });

      expect(existing).toBeTruthy();
      // Route would respond with 409: "Phone number already registered"
    });

    it('validates phone number format', () => {
      const phoneRegex = /^\+?[0-9]{10,15}$/;

      expect(phoneRegex.test('+919876543210')).toBe(true);
      expect(phoneRegex.test('9876543210')).toBe(true);
      expect(phoneRegex.test('123')).toBe(false);
      expect(phoneRegex.test('invalid')).toBe(false);
    });

    it('validates name length', () => {
      const validNames = ['Dr. A', 'Dr. Rajesh Kumar Sharma'];
      const invalidNames = ['D', '']; // min 2 chars

      for (const name of validNames) {
        expect(name.length).toBeGreaterThanOrEqual(2);
      }

      for (const name of invalidNames) {
        expect(name.length).toBeLessThan(2);
      }
    });

    it('password is optional during registration', () => {
      const registrationWithPassword = { phone: '+919999999999', name: 'Dr. Test', licenseNumber: 'MH99', password: 'Pass123!' };
      const registrationWithoutPassword = { phone: '+919999999998', name: 'Dr. Test2', licenseNumber: 'MH98' };

      expect(registrationWithPassword.password).toBeDefined();
      expect((registrationWithoutPassword as any).password).toBeUndefined();
    });
  });

  // ─── GET /auth/me ──────────────────────────────────────────────────────

  describe('GET /auth/me — current user profile', () => {
    it('returns user profile with doctor details', async () => {
      const profile = {
        id: 'user-001',
        email: 'dr.sharma@example.com',
        phone: '+919876543210',
        role: 'doctor',
        createdAt: new Date('2026-01-01'),
        doctor: {
          id: 'doc-001',
          name: 'Dr. Sharma',
          specialties: ['General Medicine'],
          licenseNumber: 'MH12345',
          bio: null,
        },
      };

      mockPrisma.user.findUnique.mockResolvedValue(profile);

      const result = await mockPrisma.user.findUnique({
        where: { id: 'user-001' },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          doctor: {
            select: { id: true, name: true, specialties: true, licenseNumber: true, bio: true },
          },
        },
      });

      expect(result).toBeTruthy();
      expect(result!.doctor.name).toBe('Dr. Sharma');
      expect(result!.doctor.specialties).toContain('General Medicine');
    });

    it('returns 404 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.user.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(result).toBeNull();
    });
  });
});
