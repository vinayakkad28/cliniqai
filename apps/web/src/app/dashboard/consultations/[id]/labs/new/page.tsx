"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { labs } from "@/lib/api";

const COMMON_TESTS = [
  "Complete Blood Count (CBC)",
  "Blood Glucose (Fasting)",
  "Blood Glucose (PP)",
  "HbA1c",
  "Lipid Profile",
  "Liver Function Test (LFT)",
  "Kidney Function Test (KFT)",
  "Thyroid Function Test (TSH)",
  "Urine Routine & Microscopy",
  "ECG",
  "Chest X-Ray",
  "Serum Creatinine",
  "Serum Electrolytes",
  "Vitamin D",
  "Vitamin B12",
];

export default function NewLabOrderPage({ params }: { params: { id: string } }) {
  const { id: consultationId } = params;
  const router = useRouter();

  const [selected, setSelected] = useState<string[]>([]);
  const [customTest, setCustomTest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleTest(test: string) {
    setSelected((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  }

  function addCustomTest() {
    const trimmed = customTest.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    setSelected((prev) => [...prev, trimmed]);
    setCustomTest("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      setError("Please select at least one test.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await labs.createOrder({ consultationId, tests: selected });
      router.replace(`/dashboard/consultations/${consultationId}`);
    } catch (e: unknown) {
      setError((e as { data?: { error?: string } }).data?.error ?? "Failed to create lab order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Order Lab Tests</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-700 mb-3">Common Tests</p>
          <div className="grid grid-cols-1 gap-2">
            {COMMON_TESTS.map((test) => (
              <label key={test} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected.includes(test)}
                  onChange={() => toggleTest(test)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{test}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-700 mb-2">Add Custom Test</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customTest}
              onChange={(e) => setCustomTest(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTest(); } }}
              placeholder="e.g. Serum Ferritin"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={addCustomTest}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Add
            </button>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Selected Tests ({selected.length})</p>
            <div className="flex flex-wrap gap-2">
              {selected.map((test) => (
                <span
                  key={test}
                  className="inline-flex items-center gap-1 rounded-full bg-white border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {test}
                  <button
                    type="button"
                    onClick={() => setSelected((prev) => prev.filter((t) => t !== test))}
                    className="ml-0.5 text-blue-400 hover:text-blue-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting || selected.length === 0}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Ordering…" : `Order ${selected.length > 0 ? selected.length : ""} Test${selected.length !== 1 ? "s" : ""}`}
        </button>
      </form>
    </div>
  );
}
