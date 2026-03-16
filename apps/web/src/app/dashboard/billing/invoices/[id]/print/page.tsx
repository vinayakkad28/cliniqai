"use client";

import { useEffect, useState } from "react";
import { API_BASE as BASE } from "@/lib/api";

interface Invoice {
  id: string;
  amount: string;
  gstAmount: string;
  total: string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
  patient: { id: string; phone: string };
  paymentMethods?: Array<{ provider: string; transactionId: string; amount: string }>;
}

interface DoctorProfile {
  name: string;
  licenseNumber: string;
  specialties: string[];
}

export default function InvoicePrintPage({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cliniqai_access_token") ?? "";

    Promise.all([
      fetch(`${BASE}/billing/invoices/${params.id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${BASE}/doctors/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([inv, doc]) => {
        setInvoice(inv as Invoice);
        setDoctor(doc as DoctorProfile);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!loading && invoice) {
      // Small delay to ensure styles are applied before print dialog
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [loading, invoice]);

  if (loading) return <div className="p-10 text-center text-sm text-gray-400">Preparing invoice…</div>;
  if (!invoice) return <div className="p-10 text-center text-sm text-red-500">Invoice not found.</div>;

  const fees = Number(invoice.amount);
  const gst = Number(invoice.gstAmount);
  const total = Number(invoice.total);
  const gstPercent = fees > 0 ? Math.round((gst / fees) * 100) : 0;

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#invoice-root) { display: none !important; }
          #invoice-root { display: block !important; }
          @page { size: A4; margin: 20mm; }
        }
        @media screen {
          body { background: #f3f4f6; }
          #invoice-root { max-width: 800px; margin: 40px auto; background: white; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); border-radius: 8px; }
        }
      `}</style>

      <div id="invoice-root" style={{ fontFamily: "Arial, sans-serif", color: "#111", fontSize: "14px", lineHeight: "1.6" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px", borderBottom: "2px solid #2563EB", paddingBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#2563EB", margin: "0 0 4px" }}>CliniqAI</h1>
            {doctor && (
              <>
                <p style={{ margin: "2px 0", fontWeight: "600" }}>Dr. {doctor.name}</p>
                {doctor.specialties.length > 0 && (
                  <p style={{ margin: "2px 0", color: "#555", fontSize: "13px" }}>{doctor.specialties.join(", ")}</p>
                )}
                <p style={{ margin: "2px 0", color: "#555", fontSize: "12px" }}>Reg. No: {doctor.licenseNumber}</p>
              </>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#374151", margin: "0 0 8px" }}>INVOICE</h2>
            <p style={{ margin: "2px 0", fontSize: "13px", color: "#555" }}>Invoice #: {invoice.id.slice(0, 8).toUpperCase()}</p>
            <p style={{ margin: "2px 0", fontSize: "13px", color: "#555" }}>Date: {new Date(invoice.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            <span style={{
              display: "inline-block",
              marginTop: "6px",
              padding: "2px 10px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: "bold",
              background: invoice.status === "paid" ? "#dcfce7" : "#fef9c3",
              color: invoice.status === "paid" ? "#166534" : "#92400e",
            }}>
              {invoice.status.replace("_", " ").toUpperCase()}
            </span>
          </div>
        </div>

        {/* Patient info */}
        <div style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "12px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Bill To</h3>
          <p style={{ fontWeight: "600", margin: "0" }}>Patient</p>
          <p style={{ margin: "2px 0", color: "#374151" }}>Phone: {invoice.patient.phone}</p>
          <p style={{ margin: "2px 0", color: "#9ca3af", fontSize: "12px" }}>ID: {invoice.patient.id.slice(0, 8)}</p>
        </div>

        {/* Line items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "12px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "12px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "12px" }}>Consultation Fee</td>
              <td style={{ padding: "12px", textAlign: "right" }}>₹{fees.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
            {gst > 0 && (
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "12px", color: "#6b7280" }}>GST ({gstPercent}%)</td>
                <td style={{ padding: "12px", textAlign: "right", color: "#6b7280" }}>₹{gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #111" }}>
              <td style={{ padding: "12px", fontWeight: "bold", fontSize: "16px" }}>Total</td>
              <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "16px" }}>₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        {/* Payment info */}
        {invoice.status === "paid" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "12px 16px", marginBottom: "24px" }}>
            <p style={{ margin: "0", fontWeight: "600", color: "#166534" }}>✓ Payment Received</p>
            {invoice.paymentMethod && <p style={{ margin: "2px 0", color: "#15803d", fontSize: "13px" }}>Method: {invoice.paymentMethod}</p>}
            {invoice.paidAt && <p style={{ margin: "2px 0", color: "#15803d", fontSize: "13px" }}>Paid on: {new Date(invoice.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>}
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px", marginTop: "32px", fontSize: "12px", color: "#9ca3af", textAlign: "center" }}>
          <p style={{ margin: "0" }}>This is a computer-generated invoice. Thank you for your visit.</p>
          <p style={{ margin: "4px 0 0" }}>Powered by CliniqAI — cliniqai.in</p>
        </div>

        {/* Screen-only print button */}
        <div className="mt-6 flex justify-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Print / Save as PDF
          </button>
          <button
            onClick={() => window.close()}
            className="rounded-lg border border-gray-300 px-6 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
