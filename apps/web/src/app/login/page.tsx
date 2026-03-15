"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid 10-digit phone number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await auth.sendOtp(phone);
      if (res.dev_otp) setOtp(res.dev_otp);
      toast.success("OTP sent");
      setStep("otp");
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "Failed to send OTP";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("OTP must be 6 digits");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const tokens = await auth.verifyOtp(phone, otp);
      await login(tokens.accessToken, tokens.refreshToken);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "Invalid OTP";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl bg-card/90 backdrop-blur-sm shadow-lg border border-border/50 p-8">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <svg className="w-7 h-7 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-3xl font-heading font-bold text-primary">CliniqAI</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI-powered clinical platform for doctors</p>
        </div>

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-card-foreground mb-1">
                Mobile Number
              </label>
              <input
                id="phone"
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(""); }}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm text-center text-lg tracking-wide focus:outline-none focus:ring-2 focus:ring-ring ${
                  error ? "border-destructive" : "border-border focus:border-primary"
                }`}
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {loading ? "Sending OTP…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              OTP sent to <span className="font-medium text-card-foreground">{phone}</span>.{" "}
              <button
                type="button"
                className="cursor-pointer text-primary underline"
                onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
              >
                Change
              </button>
            </p>
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-card-foreground mb-1">
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
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                className={`w-full rounded-lg border px-4 py-2.5 text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-ring ${
                  error ? "border-destructive" : "border-border focus:border-primary"
                }`}
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {loading ? "Verifying…" : "Verify & Login"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSendOtp}
              className="w-full cursor-pointer text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-60"
            >
              Resend OTP
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          New doctor?{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Register here
          </Link>
        </p>

        <p className="mt-6 text-center text-2xs text-muted-foreground">
          Secured with end-to-end encryption. HIPAA & DPDP compliant.
        </p>
      </div>
    </main>
  );
}
