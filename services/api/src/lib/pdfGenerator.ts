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

export interface PrescriptionHtmlData {
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  doctorName: string;
  doctorQualification: string;
  doctorRegistration: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  date: string;
  diagnosis: string;
  medications: {
    drug: string;
    dose: string;
    frequency: string;
    duration: string;
    route: string;
  }[];
  advice?: string;
  followUpDate?: string;
  qrData?: string;
  signature?: string;
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

// ─── HTML Prescription (for PDF conversion via Puppeteer or wkhtmltopdf) ──

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generatePrescriptionHtml(data: PrescriptionHtmlData): string {
  const medicationRows = data.medications
    .map(
      (med, i) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px dashed #e0e0e0;">${i + 1}</td>
      <td style="padding: 8px; border-bottom: 1px dashed #e0e0e0; font-weight: 600;">${escapeHtml(med.drug)}</td>
      <td style="padding: 8px; border-bottom: 1px dashed #e0e0e0;">${escapeHtml(med.dose)}</td>
      <td style="padding: 8px; border-bottom: 1px dashed #e0e0e0;">${escapeHtml(med.frequency)}</td>
      <td style="padding: 8px; border-bottom: 1px dashed #e0e0e0;">${escapeHtml(med.duration)}</td>
      <td style="padding: 8px; border-bottom: 1px dashed #e0e0e0;">${escapeHtml(med.route)}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; line-height: 1.5; }
    .header { border-bottom: 3px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 12px; }
    .clinic-name { font-size: 20px; font-weight: 700; color: #1d4ed8; }
    .doctor-info { font-size: 13px; color: #555; margin-top: 4px; }
    .patient-bar { background: #f8fafc; padding: 8px 12px; border-radius: 6px; margin: 12px 0; display: flex; gap: 24px; }
    .rx-symbol { font-size: 28px; color: #1d4ed8; font-family: serif; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { text-align: left; padding: 8px; color: #666; font-weight: 500; border-bottom: 2px solid #e0e0e0; font-size: 11px; }
    .advice { background: #fefce8; border: 1px solid #fde047; border-radius: 6px; padding: 10px; margin-top: 16px; }
    .footer { border-top: 1px solid #e0e0e0; padding-top: 12px; margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .signature-line { border-top: 1px solid #333; padding-top: 4px; min-width: 200px; text-align: center; }
    .verification { background: #f1f5f9; padding: 6px; text-align: center; font-size: 9px; color: #94a3b8; margin-top: 12px; border-radius: 4px; }
    .badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div class="clinic-name">${escapeHtml(data.clinicName)}</div>
        <div class="doctor-info">${escapeHtml(data.doctorName)}</div>
        <div class="doctor-info">${escapeHtml(data.doctorQualification)} | Reg: ${escapeHtml(data.doctorRegistration)}</div>
        ${data.clinicAddress ? `<div class="doctor-info">${escapeHtml(data.clinicAddress)}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <span class="badge">E-PRESCRIPTION</span>
        <div style="font-size: 11px; color: #888; margin-top: 6px;">Date: ${escapeHtml(data.date)}</div>
      </div>
    </div>
  </div>

  <div class="patient-bar">
    <div><strong>Patient:</strong> ${escapeHtml(data.patientName)}</div>
    <div><strong>Age:</strong> ${data.patientAge} yrs</div>
    <div><strong>Gender:</strong> ${escapeHtml(data.patientGender)}</div>
  </div>

  ${data.diagnosis ? `<div style="margin: 8px 0;"><strong>Diagnosis:</strong> ${escapeHtml(data.diagnosis)}</div>` : ''}

  <div style="display: flex; gap: 12px; margin-top: 16px;">
    <span class="rx-symbol">&#8478;</span>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Medication</th>
          <th>Dose</th>
          <th>Frequency</th>
          <th>Duration</th>
          <th>Route</th>
        </tr>
      </thead>
      <tbody>
        ${medicationRows}
      </tbody>
    </table>
  </div>

  ${data.advice ? `<div class="advice"><strong>Advice:</strong> ${escapeHtml(data.advice)}</div>` : ''}
  ${data.followUpDate ? `<div style="margin-top: 8px;"><strong>Follow-up:</strong> ${escapeHtml(data.followUpDate)}</div>` : ''}

  <div class="footer">
    <div style="text-align: center;">
      <div style="width: 80px; height: 80px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #999;">QR Code</div>
      <div style="font-size: 9px; color: #999; margin-top: 4px;">Scan to verify</div>
    </div>
    <div class="signature-line">
      <div style="font-weight: 600;">${escapeHtml(data.doctorName)}</div>
      <div style="font-size: 10px; color: #666;">Reg: ${escapeHtml(data.doctorRegistration)}</div>
      <div style="font-size: 9px; color: #999;">Digitally Signed</div>
    </div>
  </div>

  ${data.signature ? `<div class="verification">Digital Signature: ${escapeHtml(data.signature.slice(0, 40))}... | Generated via CliniqAI</div>` : ''}
</body>
</html>`;
}
