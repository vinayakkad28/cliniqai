"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { documents, type Document } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  lab_report: "Lab Report",
  prescription_external: "External Prescription",
  discharge_summary: "Discharge Summary",
  imaging: "Imaging",
  insurance: "Insurance",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-yellow-100 text-yellow-700",
  processing: "bg-blue-100 text-blue-700",
  extracted: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function PatientDocumentsPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const router = useRouter();

  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<(Document & { readUrl?: string | null }) | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, [patientId]);

  async function loadDocuments() {
    try {
      const res = await documents.list(patientId);
      setDocs(res.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const type = guessDocType(file.name);
      const { document: doc, uploadUrl } = await documents.requestUploadUrl({
        patientId,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        type,
      });

      // PUT file directly to GCS (or dev mock URL)
      if (uploadUrl.includes("localhost:9999")) {
        // Dev mode: skip actual upload, just confirm
        console.log("[dev] Skipping actual GCS upload, confirming directly");
      } else {
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("Upload to storage failed");
      }

      // Confirm upload → triggers processing worker
      await documents.confirm(doc.id);

      // Refresh list
      await loadDocuments();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleViewDocument(doc: Document) {
    try {
      const full = await documents.get(doc.id);
      setSelectedDoc(full);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await documents.delete(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      if (selectedDoc?.id === id) setSelectedDoc(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700 mb-1 flex items-center gap-1"
          >
            Back to Patient
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Medical Documents</h1>
        </div>
        <label className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white ${uploading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}>
          {uploading ? "Uploading..." : "Upload Document"}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Document List */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading documents...</div>
          ) : docs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center">
              <p className="text-sm text-gray-500">No documents yet.</p>
              <p className="mt-1 text-xs text-gray-400">Upload lab reports, discharge summaries, or prescriptions.</p>
            </div>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                className={`rounded-xl border p-4 cursor-pointer transition-colors ${selectedDoc?.id === doc.id ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-300"}`}
                onClick={() => handleViewDocument(doc)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{doc.fileName}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">{TYPE_LABELS[doc.type] ?? doc.type}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {doc.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {doc.aiSummary && (
                      <p className="mt-2 text-xs text-gray-600 line-clamp-2">{doc.aiSummary}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                    className="ml-2 text-gray-400 hover:text-red-500 text-xs"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Document Viewer Panel */}
        <div className="rounded-xl border border-gray-200 bg-white min-h-64">
          {selectedDoc ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 text-sm">{selectedDoc.fileName}</h3>
                {selectedDoc.readUrl && !selectedDoc.readUrl.includes("localhost:9999") && (
                  <a
                    href={selectedDoc.readUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Open original
                  </a>
                )}
              </div>

              {selectedDoc.aiSummary && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">AI Summary</p>
                  <p className="text-sm text-blue-800">{selectedDoc.aiSummary}</p>
                  <p className="mt-2 text-xs text-blue-500 italic">
                    AI-generated summary — verify against original document
                  </p>
                </div>
              )}

              <div className="text-xs space-y-1 text-gray-500">
                <div><span className="font-medium">Type:</span> {TYPE_LABELS[selectedDoc.type] ?? selectedDoc.type}</div>
                <div><span className="font-medium">Status:</span> {selectedDoc.status}</div>
                <div><span className="font-medium">Uploaded:</span> {new Date(selectedDoc.createdAt).toLocaleString()}</div>
              </div>

              {selectedDoc.status === "processing" && (
                <div className="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-700">
                  Processing document... AI extraction in progress. Refresh in a moment.
                </div>
              )}

              {selectedDoc.status === "failed" && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  Processing failed. The document was uploaded but could not be analyzed.
                </div>
              )}

              {selectedDoc.readUrl && selectedDoc.mimeType.startsWith("image/") && !selectedDoc.readUrl.includes("localhost:9999") && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedDoc.readUrl}
                    alt={selectedDoc.fileName}
                    className="w-full rounded-lg border border-gray-200"
                  />
                </div>
              )}

              {selectedDoc.readUrl && selectedDoc.mimeType === "application/pdf" && !selectedDoc.readUrl.includes("localhost:9999") && (
                <div className="mt-2">
                  <iframe
                    src={selectedDoc.readUrl}
                    className="w-full h-96 rounded-lg border border-gray-200"
                    title={selectedDoc.fileName}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-gray-400">
              Select a document to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function guessDocType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("lab") || lower.includes("report") || lower.includes("blood") || lower.includes("test")) return "lab_report";
  if (lower.includes("discharge") || lower.includes("summary")) return "discharge_summary";
  if (lower.includes("xray") || lower.includes("ct") || lower.includes("mri") || lower.includes("scan") || lower.includes("imaging")) return "imaging";
  if (lower.includes("prescription") || lower.includes("rx")) return "prescription_external";
  if (lower.includes("insurance") || lower.includes("claim")) return "insurance";
  return "other";
}
