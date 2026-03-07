"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { billing } from "@/lib/api";

const GST_RATES = [0, 5, 12, 18];

export default function NewInvoicePage({ params }: { params: { id: string } }) {
  const { id: consultationId } = params;
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [gstPercent, setGstPercent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const amountNum = parseFloat(amount) || 0;
  const gstAmount = (amountNum * gstPercent) / 100;
  const total = amountNum + gstAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await billing.createInvoice({ consultationId, amount: amountNum, gstPercent });
      router.replace(`/dashboard/consultations/${consultationId}`);
    } catch (e: unknown) {
      const msg = (e as { data?: { error?: string } }).data?.error ?? "Failed to create invoice";
      if (msg.includes("already exists")) {
        router.replace(`/dashboard/consultations/${consultationId}`);
        return;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Create Invoice</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee (₹) *</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 500"
            min={1}
            step={1}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">GST Rate</label>
          <div className="flex gap-3 flex-wrap">
            {GST_RATES.map((r) => (
              <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" value={r} checked={gstPercent === r} onChange={() => setGstPercent(r)} className="text-blue-600" />
                <span className="text-sm text-gray-700">{r}%</span>
              </label>
            ))}
          </div>
        </div>

        {amountNum > 0 && (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Consultation fee</span>
              <span className="font-medium">₹{amountNum.toFixed(2)}</span>
            </div>
            {gstPercent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST ({gstPercent}%)</span>
                <span className="font-medium">₹{gstAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5 mt-1.5">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-gray-900">₹{total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create Invoice"}
        </button>
      </form>
    </div>
  );
}
