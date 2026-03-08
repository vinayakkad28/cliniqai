// Server-side PDF generation for prescriptions using PDFKit-compatible approach
// This generates a minimal PDF structure for prescription documents

interface PrescriptionPdfData {
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

// Generate prescription as structured HTML (for PDF conversion via Puppeteer or wkhtmltopdf)
export function generatePrescriptionHtml(data: PrescriptionPdfData): string {
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default { generatePrescriptionHtml };
