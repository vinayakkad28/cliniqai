"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api";

interface LabResult {
  id: string;
  resultFileUrl: string;
  aiSummary?: string;
  createdAt: string;
}

interface LabOrder {
  id: string;
  tests: string[];
  status: string;
  createdAt: string;
  results: LabResult[];
}

const FLAG_COLORS: Record<string, string> = {
  H: "text-red-600 font-bold",
  HH: "text-red-700 font-bold",
  L: "text-blue-600 font-bold",
  LL: "text-blue-700 font-bold",
  N: "text-green-600",
};

export default function LabOrderDetailPage({ params }: { params: { id: string; orderId: string } }) {
  const { id: consultationId, orderId } = params;
  const router = useRouter();

  const [order, setOrder] = useState<LabOrder | null>(null);
  const [loading, setLoading] = useState(true);

  // Result upload form
  const [resultUrl, setResultUrl] = useState("");
  const [resultRows, setResultRows] = useState([{ name: "", value: "", unit: "", referenceRange: "", flag: "" }]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("cliniqai_access_token") ?? "";
    fetch(`${BASE}/labs/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setOrder)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [orderId]);

  function addRow() {
    setResultRows((prev) => [...prev, { name: "", value: "", unit: "", referenceRange: "", flag: "" }]);
  }

  function updateRow(i: number, field: string, value: string) {
    setResultRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    setUploadError("");
    const token = localStorage.getItem("cliniqai_access_token") ?? "";
    try {
      const validRows = resultRows.filter((r) => r.name && r.value);
      const body = {
        resultFileUrl: resultUrl || `https://placeholder.cliniqai.app/lab-result/${orderId}`,
        results: validRows.length > 0 ? validRows.map((r) => ({
          name: r.name,
          value: isNaN(Number(r.value)) ? r.value : Number(r.value),
          unit: r.unit,
          referenceRange: r.referenceRange || undefined,
          flag: (r.flag || undefined) as "H" | "L" | "HH" | "LL" | "N" | undefined,
        })) : undefined,
      };
      const res = await fetch(`${BASE}/labs/orders/${orderId}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setUploadError(d.error ?? "Failed to upload result");
        return;
      }
      // Refresh
      const updated = await fetch(`${BASE}/labs/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      setOrder(updated);
      setResultUrl("");
      setResultRows([{ name: "", value: "", unit: "", referenceRange: "", flag: "" }]);
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">Loading…</div>;
  if (!order) return <div className="py-20 text-center text-sm text-red-500">Lab order not found.</div>;

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Lab Order</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          order.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
        }`}>
          {order.status}
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm mb-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Ordered Tests</h2>
        <div className="flex flex-wrap gap-2">
          {order.tests.map((test) => (
            <span key={test} className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-sm text-blue-700">
              {test}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Ordered {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Results */}
      {order.results.length > 0 && (
        <div className="space-y-4 mb-5">
          {order.results.map((result) => (
            <div key={result.id} className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-green-800">Result Report</h2>
                <span className="text-xs text-green-600">
                  {new Date(result.createdAt).toLocaleDateString("en-IN")}
                </span>
              </div>
              {result.resultFileUrl && !result.resultFileUrl.includes("placeholder") && (
                <a
                  href={result.resultFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View Report PDF →
                </a>
              )}
              {result.aiSummary && (
                <div className="mt-3 rounded-lg bg-white border border-green-100 p-3">
                  <p className="text-xs font-semibold text-green-700 mb-1">AI Interpretation</p>
                  <p className="text-sm text-gray-700">{result.aiSummary}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload results form */}
      {order.status === "pending" && (
        <form onSubmit={handleUpload} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Enter Lab Results</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Report URL <span className="text-gray-400">(optional)</span></label>
            <input
              type="url"
              value={resultUrl}
              onChange={(e) => setResultUrl(e.target.value)}
              placeholder="https://lab-provider.com/reports/..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Test Values</label>
              <button type="button" onClick={addRow} className="text-xs text-blue-600 hover:underline">+ Add row</button>
            </div>
            <div className="space-y-2">
              {resultRows.map((row, i) => (
                <div key={i} className="grid grid-cols-5 gap-2">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(i, "name", e.target.value)}
                    placeholder="Test name"
                    className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateRow(i, "value", e.target.value)}
                    placeholder="Value"
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={row.unit}
                    onChange={(e) => updateRow(i, "unit", e.target.value)}
                    placeholder="Unit"
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <select
                    value={row.flag}
                    onChange={(e) => updateRow(i, "flag", e.target.value)}
                    className={`rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none ${FLAG_COLORS[row.flag] ?? ""}`}
                  >
                    <option value="">Normal</option>
                    <option value="H">H (High)</option>
                    <option value="HH">HH (Critical High)</option>
                    <option value="L">L (Low)</option>
                    <option value="LL">LL (Critical Low)</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {uploading ? "Saving…" : "Save Results"}
          </button>
        </form>
      )}

      <div className="mt-4">
        <button
          onClick={() => router.push(`/dashboard/consultations/${consultationId}`)}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Consultation
        </button>
      </div>
    </div>
  );
}
