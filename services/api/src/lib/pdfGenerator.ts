import PDFDocument from "pdfkit";
import { PDF, formatINR, formatDate } from "./pdfTemplates.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PrescriptionPdfData {
  prescriptionId: string;
  createdAt: Date | string;
  clinic: { name: string; address: string; gstNumber?: string | null };
  doctor: { name: string; licenseNumber: string; specialties: string[] };
  patient: { phone: string; name?: string | null };
  medications: Array<{
    drug: string;
    dose: string;
    frequency: string;
    duration: string;
    route: string;
    notes?: string | null;
  }>;
  qrCodePng?: Buffer;
}

export interface InvoicePdfData {
  invoiceId: string;
  createdAt: Date | string;
  clinic: { name: string; address: string; gstNumber?: string | null };
  doctor: { name: string };
  patient: { phone: string; name?: string | null };
  amount: number;
  gstAmount: number;
  total: number;
  status: string;
  paymentMethod?: string | null;
  paidAt?: Date | string | null;
}

// ─── Prescription PDF ───────────────────────────────────────────────────────

export function generatePrescriptionPdf(data: PrescriptionPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PDF.margin });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = PDF.pageWidth - 2 * PDF.margin;

    // ── Header / Letterhead ──
    doc
      .rect(0, 0, PDF.pageWidth, 100)
      .fill(PDF.colors.headerBg);

    doc
      .font(PDF.fonts.heading)
      .fontSize(18)
      .fillColor(PDF.colors.primary)
      .text(data.clinic.name, PDF.margin, 25, { width: contentWidth });

    doc
      .font(PDF.fonts.body)
      .fontSize(9)
      .fillColor(PDF.colors.lightText)
      .text(data.clinic.address, PDF.margin, 50, { width: contentWidth });

    if (data.clinic.gstNumber) {
      doc.text(`GSTIN: ${data.clinic.gstNumber}`, PDF.margin, 65, { width: contentWidth });
    }

    // ── Prescription title ──
    doc
      .font(PDF.fonts.heading)
      .fontSize(14)
      .fillColor(PDF.colors.text)
      .text("PRESCRIPTION", PDF.margin, 115);

    doc
      .font(PDF.fonts.body)
      .fontSize(9)
      .fillColor(PDF.colors.lightText)
      .text(`Rx ID: ${data.prescriptionId}`, PDF.margin, 135)
      .text(`Date: ${formatDate(data.createdAt)}`, PDF.margin + 250, 135);

    // ── Doctor info ──
    doc
      .font(PDF.fonts.heading)
      .fontSize(10)
      .fillColor(PDF.colors.text)
      .text(`Dr. ${data.doctor.name}`, PDF.margin, 160);

    doc
      .font(PDF.fonts.body)
      .fontSize(9)
      .fillColor(PDF.colors.lightText)
      .text(`License: ${data.doctor.licenseNumber}`, PDF.margin, 175)
      .text(data.doctor.specialties.join(", "), PDF.margin, 188);

    // ── Patient info ──
    doc
      .font(PDF.fonts.heading)
      .fontSize(10)
      .fillColor(PDF.colors.text)
      .text("Patient:", PDF.margin, 210);

    doc
      .font(PDF.fonts.body)
      .fontSize(9)
      .fillColor(PDF.colors.text)
      .text(data.patient.name ?? data.patient.phone, PDF.margin + 60, 210);

    // ── Divider ──
    doc
      .moveTo(PDF.margin, 230)
      .lineTo(PDF.pageWidth - PDF.margin, 230)
      .strokeColor(PDF.colors.border)
      .stroke();

    // ── Medications table ──
    const tableTop = 245;
    const colWidths = [30, 130, 60, 80, 70, 60];
    const headers = ["#", "Medication", "Dose", "Frequency", "Duration", "Route"];

    // Table header
    doc.font(PDF.fonts.heading).fontSize(9).fillColor(PDF.colors.primary);
    let xPos = PDF.margin;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i]!, xPos, tableTop, { width: colWidths[i], align: "left" });
      xPos += colWidths[i]!;
    }

    doc
      .moveTo(PDF.margin, tableTop + 15)
      .lineTo(PDF.pageWidth - PDF.margin, tableTop + 15)
      .strokeColor(PDF.colors.border)
      .stroke();

    // Table rows
    doc.font(PDF.fonts.body).fontSize(9).fillColor(PDF.colors.text);
    let rowY = tableTop + 25;

    for (let i = 0; i < data.medications.length; i++) {
      const med = data.medications[i]!;
      xPos = PDF.margin;
      const cells = [String(i + 1), med.drug, med.dose, med.frequency, med.duration, med.route];

      for (let j = 0; j < cells.length; j++) {
        doc.text(cells[j]!, xPos, rowY, { width: colWidths[j], align: "left" });
        xPos += colWidths[j]!;
      }

      if (med.notes) {
        rowY += 15;
        doc.fontSize(8).fillColor(PDF.colors.lightText)
          .text(`Note: ${med.notes}`, PDF.margin + 30, rowY, { width: contentWidth - 30 });
        doc.fontSize(9).fillColor(PDF.colors.text);
      }

      rowY += 20;
    }

    // ── Signature area ──
    const sigY = Math.max(rowY + 40, 550);
    doc
      .moveTo(PDF.pageWidth - PDF.margin - 150, sigY)
      .lineTo(PDF.pageWidth - PDF.margin, sigY)
      .strokeColor(PDF.colors.text)
      .stroke();

    doc
      .font(PDF.fonts.body)
      .fontSize(9)
      .fillColor(PDF.colors.text)
      .text(`Dr. ${data.doctor.name}`, PDF.pageWidth - PDF.margin - 150, sigY + 5, { width: 150, align: "center" });

    // ── QR code (if provided) ──
    if (data.qrCodePng) {
      doc.image(data.qrCodePng, PDF.pageWidth - PDF.margin - 80, sigY - 90, { width: 80, height: 80 });
    }

    // ── Footer ──
    doc
      .font(PDF.fonts.body)
      .fontSize(7)
      .fillColor(PDF.colors.lightText)
      .text(
        "This is a computer-generated prescription. Verify at cliniqai.in/verify",
        PDF.margin,
        PDF.pageHeight - 40,
        { width: contentWidth, align: "center" },
      );

    doc.end();
  });
}

// ─── Invoice PDF ────────────────────────────────────────────────────────────

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PDF.margin });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = PDF.pageWidth - 2 * PDF.margin;

    // ── Header ──
    doc
      .rect(0, 0, PDF.pageWidth, 100)
      .fill(PDF.colors.headerBg);

    doc
      .font(PDF.fonts.heading)
      .fontSize(18)
      .fillColor(PDF.colors.primary)
      .text(data.clinic.name, PDF.margin, 25, { width: contentWidth });

    doc
      .font(PDF.fonts.body)
      .fontSize(9)
      .fillColor(PDF.colors.lightText)
      .text(data.clinic.address, PDF.margin, 50, { width: contentWidth });

    if (data.clinic.gstNumber) {
      doc.text(`GSTIN: ${data.clinic.gstNumber}`, PDF.margin, 65, { width: contentWidth });
    }

    // ── Invoice title ──
    doc
      .font(PDF.fonts.heading)
      .fontSize(14)
      .fillColor(PDF.colors.text)
      .text("INVOICE", PDF.margin, 115);

    doc
      .font(PDF.fonts.body)
      .fontSize(9)
      .fillColor(PDF.colors.lightText)
      .text(`Invoice #: ${data.invoiceId.slice(0, 8).toUpperCase()}`, PDF.margin, 140)
      .text(`Date: ${formatDate(data.createdAt)}`, PDF.margin + 250, 140)
      .text(`Status: ${data.status.toUpperCase()}`, PDF.margin + 250, 155);

    // ── Patient & Doctor ──
    doc
      .font(PDF.fonts.heading)
      .fontSize(10)
      .fillColor(PDF.colors.text)
      .text("Bill To:", PDF.margin, 180);

    doc
      .font(PDF.fonts.body)
      .fontSize(9)
      .text(data.patient.name ?? data.patient.phone, PDF.margin, 195);

    doc
      .font(PDF.fonts.heading)
      .fontSize(10)
      .text("From:", PDF.margin + 250, 180);

    doc
      .font(PDF.fonts.body)
      .fontSize(9)
      .text(`Dr. ${data.doctor.name}`, PDF.margin + 250, 195);

    // ── Divider ──
    doc
      .moveTo(PDF.margin, 220)
      .lineTo(PDF.pageWidth - PDF.margin, 220)
      .strokeColor(PDF.colors.border)
      .stroke();

    // ── Amount breakdown ──
    const amountY = 240;
    const labelX = PDF.margin + 250;
    const valueX = PDF.pageWidth - PDF.margin - 100;

    doc.font(PDF.fonts.body).fontSize(10).fillColor(PDF.colors.text);

    doc.text("Consultation Fees", labelX, amountY);
    doc.text(formatINR(data.amount), valueX, amountY, { width: 100, align: "right" });

    doc.text("GST", labelX, amountY + 25);
    doc.text(formatINR(data.gstAmount), valueX, amountY + 25, { width: 100, align: "right" });

    doc
      .moveTo(labelX, amountY + 50)
      .lineTo(PDF.pageWidth - PDF.margin, amountY + 50)
      .strokeColor(PDF.colors.border)
      .stroke();

    doc.font(PDF.fonts.heading).fontSize(12);
    doc.text("Total", labelX, amountY + 60);
    doc.text(formatINR(data.total), valueX, amountY + 60, { width: 100, align: "right" });

    // ── Payment info ──
    if (data.paidAt) {
      doc
        .font(PDF.fonts.body)
        .fontSize(9)
        .fillColor(PDF.colors.lightText)
        .text(`Paid on: ${formatDate(data.paidAt)}`, labelX, amountY + 85)
        .text(`Method: ${data.paymentMethod ?? "N/A"}`, labelX, amountY + 100);
    }

    // ── Footer ──
    doc
      .font(PDF.fonts.body)
      .fontSize(7)
      .fillColor(PDF.colors.lightText)
      .text(
        "This is a computer-generated invoice and does not require a signature.",
        PDF.margin,
        PDF.pageHeight - 40,
        { width: contentWidth, align: "center" },
      );

    doc.end();
  });
}
