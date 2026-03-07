"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const AI_BASE = process.env["NEXT_PUBLIC_AI_URL"] ?? "http://localhost:8001";
const AI_TOKEN = process.env["NEXT_PUBLIC_AI_INTERNAL_TOKEN"] ?? "";

interface ImagingResult {
  findings: string[];
  impression: string;
  severity: string | null;
  follow_up_recommended: boolean;
  model_used: string;
}

type ImageType = "cxr" | "dermatology" | "wound";

const IMAGE_TYPES: { value: ImageType; label: string; endpoint: string; icon: string }[] = [
  { value: "cxr", label: "Chest X-Ray", endpoint: "/imaging/cxr", icon: "🫁" },
  { value: "dermatology", label: "Dermatology", endpoint: "/imaging/analyze", icon: "🔬" },
  { value: "wound", label: "Wound / Injury", endpoint: "/imaging/analyze", icon: "🩹" },
];

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  moderate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

export default function ImagingPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [imageType, setImageType] = useState<ImageType>("cxr");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ImagingResult | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setResult(null);
    setError("");
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleAnalyze() {
    if (!imageFile) return;
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const selected = IMAGE_TYPES.find((t) => t.value === imageType)!;
      const form = new FormData();
      form.append("image", imageFile);
      if (imageType !== "cxr") {
        form.append("image_type", imageType);
      }
      const res = await fetch(`${AI_BASE}${selected.endpoint}`, {
        method: "POST",
        headers: { "X-Internal-Token": AI_TOKEN },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "AI analysis failed. Please try again.");
        return;
      }
      const data = await res.json() as ImagingResult;
      setResult(data);
    } catch {
      setError("Could not reach AI service. Is it running on port 8001?");
    } finally {
      setAnalyzing(false);
    }
  }

  const selectedType = IMAGE_TYPES.find((t) => t.value === imageType)!;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/dashboard/patients/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
          ← Back to Patient
        </Link>
        <h1 className="text-xl font-bold text-gray-900">AI Imaging Analysis</h1>
      </div>

      {/* Image type selector */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {IMAGE_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setImageType(t.value); setResult(null); setError(""); }}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-4 text-sm font-medium transition-colors ${
              imageType === t.value
                ? "border-teal-400 bg-teal-50 text-teal-800"
                : "border-gray-200 bg-white text-gray-700 hover:border-teal-200 hover:bg-teal-50"
            }`}
          >
            <span className="text-2xl">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Upload zone */}
      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Upload Image</h2>
        <label
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
            previewUrl ? "border-teal-300 bg-teal-50" : "border-gray-300 bg-gray-50 hover:border-teal-300 hover:bg-teal-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-64 rounded-lg object-contain shadow"
            />
          ) : (
            <>
              <span className="text-3xl mb-2">🖼️</span>
              <p className="text-sm font-medium text-gray-700">Click to upload {selectedType.label} image</p>
              <p className="mt-1 text-xs text-gray-400">JPG, PNG, or WebP — max 10 MB</p>
            </>
          )}
        </label>
        {imageFile && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">{imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)</span>
            <button
              type="button"
              onClick={() => { setImageFile(null); setPreviewUrl(null); setResult(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Analyze button */}
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!imageFile || analyzing}
        className="mb-5 w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {analyzing ? "Analyzing with AI…" : `Analyze with AI`}
      </button>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Result card */}
      {result && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Analysis Result</h2>
            <span className="text-xs text-gray-400">{result.model_used}</span>
          </div>

          {result.severity && (
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${SEVERITY_STYLES[result.severity] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
              Severity: {result.severity.charAt(0).toUpperCase() + result.severity.slice(1)}
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Impression</p>
            <p className="text-sm text-gray-800">{result.impression}</p>
          </div>

          {result.findings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Findings</p>
              <ul className="space-y-1">
                {result.findings.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.follow_up_recommended && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              ⚠️ Follow-up recommended based on these findings.
            </div>
          )}

          <p className="text-xs text-gray-400 italic">AI-generated — always verify before clinical use.</p>
        </div>
      )}
    </div>
  );
}
