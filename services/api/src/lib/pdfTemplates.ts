/** Shared layout constants for PDF generation */

export const PDF = {
  margin: 50,
  pageWidth: 595.28, // A4
  pageHeight: 841.89,
  colors: {
    primary: "#1e40af",
    text: "#1f2937",
    lightText: "#6b7280",
    border: "#e5e7eb",
    headerBg: "#eff6ff",
  },
  fonts: {
    heading: "Helvetica-Bold" as const,
    body: "Helvetica" as const,
  },
} as const;

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
