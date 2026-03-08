"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await auth.sendOtp(phone);
      if (res.dev_otp) setOtp(res.dev_otp); // auto-fill in dev mode
      setStep("otp");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tokens = await auth.verifyOtp(phone, otp);
      await login(tokens.accessToken, tokens.refreshToken);
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 p-4">
      {/* Decorative medical cross pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-primary-100/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-secondary-100/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg border border-white/50 p-8">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-primary mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-transparent">
            CliniqAI
          </h1>
          <p className="mt-1 text-sm text-slate-500">AI-powered clinical platform for doctors</p>
        </div>

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Mobile Number
              </label>
              <input
                id="phone"
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="cliniq-input text-center text-lg tracking-wide"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                </svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button type="submit" disabled={loading} className="cliniq-btn-primary w-full">
              {loading ? "Sending OTP…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-slate-600">
              OTP sent to <span className="font-semibold text-slate-800">{phone}</span>.{" "}
              <button
                type="button"
                className="text-primary-600 font-medium hover:underline"
                onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
              >
                Change
              </button>
            </p>
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-slate-700 mb-1.5">
                Enter OTP
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="cliniq-input text-center text-xl tracking-widest font-mono"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="cliniq-btn-primary w-full"
            >
              {loading ? "Verifying…" : "Verify & Login"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSendOtp}
              className="w-full text-sm text-slate-500 hover:text-primary-600 transition-colors disabled:opacity-60"
            >
              Resend OTP
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-2xs text-slate-400">
          Secured with end-to-end encryption. HIPAA & DPDP compliant.
        </p>
      </div>
    </main>
  );
}
