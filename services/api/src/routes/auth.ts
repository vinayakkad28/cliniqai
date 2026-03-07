import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken, ROLE_SCOPES } from "../lib/jwt.js";
import { generateOtp, hashOtp, verifyOtp, otpExpiresAt } from "../lib/otp.js";
import { sendOtpSms } from "../lib/msg91.js";
import { authenticate } from "../middleware/auth.js";

export const authRouter = Router();

// ─── Schemas ────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
  name: z.string().min(2).max(100),
  licenseNumber: z.string().min(1).max(50),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

const VerifyOtpSchema = z.object({
  phone: z.string().min(10),
  otp: z.string().length(6),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function issueTokenPair(userId: string, role: string, clinicId?: string) {
  const scope = ROLE_SCOPES[role] ?? [];
  let doctorId: string | undefined;
  if (role === "doctor") {
    const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
    doctorId = doctor?.id;
  }
  const accessToken = signAccessToken({ sub: userId, role, clinic_id: clinicId, doctor_id: doctorId, scope });
  const refreshToken = signRefreshToken(userId);

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });

  return { accessToken, refreshToken };
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────

authRouter.post("/register", async (req, res) => {
  const result = RegisterSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { phone, name, licenseNumber, email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    res.status(409).json({ error: "Phone number already registered" });
    return;
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : null;

  const user = await prisma.user.create({
    data: {
      phone,
      email,
      passwordHash,
      role: "doctor",
      doctor: { create: { name, licenseNumber, specialties: [] } },
    },
  });

  const otp = generateOtp();
  const codeHash = await hashOtp(otp);
  await prisma.otpCode.create({ data: { phone, codeHash, expiresAt: otpExpiresAt() } });
  const devOtp = await sendOtpSms({ phone, otp, templateId: process.env["MSG91_TEMPLATE_OTP"] ?? "" });

  res.status(201).json({
    message: "OTP sent to your mobile number",
    userId: user.id,
    ...(devOtp ? { dev_otp: devOtp } : {}),
  });
});

// ─── POST /api/auth/send-otp ─────────────────────────────────────────────────

authRouter.post("/send-otp", async (req, res) => {
  const result = z.object({ phone: z.string().min(10) }).safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { phone } = result.data;
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    res.status(404).json({ error: "No account found for this number" });
    return;
  }

  await prisma.otpCode.updateMany({ where: { phone, used: false }, data: { used: true } });

  const otp = generateOtp();
  const codeHash = await hashOtp(otp);
  await prisma.otpCode.create({ data: { phone, codeHash, expiresAt: otpExpiresAt() } });
  const devOtp = await sendOtpSms({ phone, otp, templateId: process.env["MSG91_TEMPLATE_OTP"] ?? "" });

  res.json({ message: "OTP sent", ...(devOtp ? { dev_otp: devOtp } : {}) });
});

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────

authRouter.post("/verify-otp", async (req, res) => {
  const result = VerifyOtpSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { phone, otp } = result.data;

  const record = await prisma.otpCode.findFirst({
    where: { phone, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    res.status(400).json({ error: "OTP expired or not found. Please request a new one." });
    return;
  }

  const valid = await verifyOtp(otp, record.codeHash);
  if (!valid) {
    res.status(400).json({ error: "Invalid OTP" });
    return;
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { accessToken, refreshToken } = await issueTokenPair(user.id, user.role);
  res.json({ accessToken, refreshToken, role: user.role, userId: user.id });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post("/login", async (req, res) => {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { email, password } = result.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const { accessToken, refreshToken } = await issueTokenPair(user.id, user.role);
  res.json({ accessToken, refreshToken, role: user.role, userId: user.id });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

authRouter.post("/refresh", async (req, res) => {
  const result = RefreshSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(result.data.refreshToken);
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(result.data.refreshToken).digest("hex");

  const stored = await prisma.refreshToken.findFirst({
    where: { userId: payload.sub, tokenHash, expiresAt: { gt: new Date() } },
  });

  if (!stored) {
    res.status(401).json({ error: "Refresh token revoked or expired" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const { accessToken, refreshToken } = await issueTokenPair(user.id, user.role);
  res.json({ accessToken, refreshToken });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

authRouter.post("/logout", authenticate, async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (refreshToken) {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await prisma.refreshToken.deleteMany({ where: { userId: req.user!.sub, tokenHash } });
  } else {
    await prisma.refreshToken.deleteMany({ where: { userId: req.user!.sub } });
  }

  res.json({ message: "Logged out" });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

authRouter.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
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

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});
