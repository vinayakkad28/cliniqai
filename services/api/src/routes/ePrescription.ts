import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// ─── QR Code SVG Generator ─────────────────────────────────────────────────

async function generateQRCodeSVG(data: string, size = 200): Promise<string> {
  return QRCode.toString(data, { type: 'svg', width: size, margin: 1 });
}

async function qrSvgToDataUrl(svg: string): Promise<string> {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// ─── Digital Signature Helpers ──────────────────────────────────────────────

function getSigningKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key === 'default-key') {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('ENCRYPTION_KEY must be set in production');
    }
    return 'default-dev-key';
  }
  return key;
}

function createDigitalSignature(payload: Record<string, unknown>): string {
  const data = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', getSigningKey())
    .update(data)
    .digest('hex');
}

function verifyDigitalSignature(payload: Record<string, unknown>, signature: string): boolean {
  const expected = createDigitalSignature(payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ─── Generate e-prescription with QR code, digital signature, PDF data ─────

router.post('/:prescriptionId/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { prescriptionId } = req.params;
    const doctorId = req.user!.doctor_id;

    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        patient: true,
        doctor: true,
        consultation: true,
      },
    });

    if (!prescription) {
      res.status(404).json({ error: 'Prescription not found' });
      return;
    }

    if (prescription.doctorId !== doctorId) {
      res.status(403).json({ error: 'Not authorized to access this prescription' });
      return;
    }

    const prescriptionDate = prescription.createdAt.toISOString().split('T')[0];

    // Build signature payload
    const signaturePayload = {
      id: prescription.id,
      doctor: prescription.doctor.name,
      patient: prescription.patient.phone,
      date: prescriptionDate,
    };

    const signature = createDigitalSignature(signaturePayload);

    // Generate verification code (short, URL-safe)
    const verificationCode = crypto
      .createHash('sha256')
      .update(`${prescription.id}:${signature}`)
      .digest('base64url')
      .slice(0, 12);

    const appUrl = process.env.APP_URL || 'https://app.cliniqai.com';
    const verifyUrl = `${appUrl}/verify/${verificationCode}`;

    // QR code data - compact verification payload
    const qrPayload = {
      v: 1,
      id: prescription.id.slice(0, 12),
      dr: prescription.doctor.name,
      dt: prescriptionDate,
      sig: signature.slice(0, 16),
      code: verificationCode,
      url: verifyUrl,
    };

    const qrDataString = JSON.stringify(qrPayload);
    const qrSvg = await generateQRCodeSVG(qrDataString);
    const qrDataUrl = await qrSvgToDataUrl(qrSvg);

    // PDF-ready data structure
    const pdfData = {
      header: {
        doctorName: prescription.doctor.name,
        doctorSpecialties: prescription.doctor.specialties,
        doctorLicense: prescription.doctor.licenseNumber,
        clinicName: '',
      },
      patient: {
        phone: prescription.patient.phone,
        name: prescription.patient.name || '',
      },
      prescription: {
        id: prescription.id,
        date: prescriptionDate,
        diagnosis: prescription.consultation?.chiefComplaint || '',
        medications: prescription.medications || [],
        notes: prescription.notes || '',
      },
      verification: {
        signature: signature,
        verificationCode: verificationCode,
        verifyUrl: verifyUrl,
        qrDataUrl: qrDataUrl,
        qrSvg: qrSvg,
      },
      generatedAt: new Date().toISOString(),
    };

    // Build response payload (backward-compatible + enhanced)
    const payload = {
      prescriptionId: prescription.id,
      doctorName: prescription.doctor.name,
      clinicName: '',
      patientPhone: prescription.patient.phone,
      date: prescriptionDate,
      diagnosis: prescription.consultation?.chiefComplaint || '',
      signature: signature,
      verificationCode: verificationCode,
      verifyUrl: verifyUrl,
      qrData: qrDataString,
      qrDataUrl: qrDataUrl,
      qrSvg: qrSvg,
      pdfData: pdfData,
    };

    // Store e-prescription metadata
    await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        digitalSignature: signature,
        qrData: qrDataString,
        verificationCode: verificationCode,
        ePrescriptionGenerated: true,
        ePrescriptionGeneratedAt: new Date(),
      },
    });

    res.json(payload);
  } catch (error) {
    console.error('E-prescription generation error:', error);
    res.status(500).json({ error: 'Failed to generate e-prescription' });
  }
});

// ─── Verify prescription by ID (existing) ──────────────────────────────────

router.get('/verify/:prescriptionId', async (req: Request, res: Response) => {
  try {
    const { prescriptionId } = req.params;

    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        doctor: true,
        patient: true,
      },
    });

    if (!prescription) {
      res.status(404).json({ valid: false, error: 'Prescription not found' });
      return;
    }

    if (!prescription.digitalSignature) {
      res.status(400).json({ valid: false, error: 'Prescription not digitally signed' });
      return;
    }

    // Re-compute signature to verify
    const signaturePayload = {
      id: prescription.id,
      doctor: prescription.doctor.name,
      patient: prescription.patient.phone,
      date: prescription.createdAt.toISOString().split('T')[0],
    };

    let isValid = false;
    try {
      isValid = verifyDigitalSignature(signaturePayload, prescription.digitalSignature);
    } catch {
      isValid = false;
    }

    res.json({
      valid: isValid,
      prescription: isValid
        ? {
            id: prescription.id,
            doctor: prescription.doctor.name,
            patientPhone: prescription.patient.phone,
            date: prescription.createdAt.toISOString().split('T')[0],
            generatedAt: prescription.ePrescriptionGeneratedAt,
          }
        : null,
    });
  } catch (error) {
    console.error('Prescription verification error:', error);
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

// ─── Verify prescription by short verification code ─────────────────────────

router.get('/verify/code/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    const prescription = await prisma.prescription.findFirst({
      where: { verificationCode: code },
      include: {
        doctor: true,
        patient: true,
      },
    });

    if (!prescription) {
      res.status(404).json({ valid: false, error: 'Invalid verification code' });
      return;
    }

    if (!prescription.digitalSignature) {
      res.status(400).json({ valid: false, error: 'Prescription not digitally signed' });
      return;
    }

    const signaturePayload = {
      id: prescription.id,
      doctor: prescription.doctor.name,
      patient: prescription.patient.phone,
      date: prescription.createdAt.toISOString().split('T')[0],
    };

    let isValid = false;
    try {
      isValid = verifyDigitalSignature(signaturePayload, prescription.digitalSignature);
    } catch {
      isValid = false;
    }

    res.json({
      valid: isValid,
      prescription: isValid
        ? {
            id: prescription.id,
            doctor: prescription.doctor.name,
            doctorLicense: prescription.doctor.licenseNumber,
            patientPhone: prescription.patient.phone,
            date: prescription.createdAt.toISOString().split('T')[0],
            generatedAt: prescription.ePrescriptionGeneratedAt,
            verificationCode: code,
          }
        : null,
    });
  } catch (error) {
    console.error('Prescription verification by code error:', error);
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

// ─── WhatsApp sharing endpoint ──────────────────────────────────────────────

router.post('/:prescriptionId/share/whatsapp', authenticate, async (req: Request, res: Response) => {
  try {
    const { prescriptionId } = req.params;
    const doctorId = req.user!.doctor_id;
    const { recipientPhone } = req.body;

    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        patient: true,
        doctor: true,
      },
    });

    if (!prescription) {
      res.status(404).json({ error: 'Prescription not found' });
      return;
    }

    if (prescription.doctorId !== doctorId) {
      res.status(403).json({ error: 'Not authorized to share this prescription' });
      return;
    }

    if (!prescription.ePrescriptionGenerated) {
      res.status(400).json({ error: 'E-prescription has not been generated yet. Generate it first.' });
      return;
    }

    const phone = recipientPhone || prescription.patient.phone;
    const appUrl = process.env.APP_URL || 'https://app.cliniqai.com';
    const verifyUrl = prescription.verificationCode
      ? `${appUrl}/verify/${prescription.verificationCode}`
      : `${appUrl}/verify/${prescription.id}`;

    // Compose WhatsApp message
    const message = [
      `*CliniqAI E-Prescription*`,
      ``,
      `Doctor: Dr. ${prescription.doctor.name}`,
      `Date: ${prescription.createdAt.toISOString().split('T')[0]}`,
      `Prescription ID: ${prescription.id.slice(0, 8).toUpperCase()}`,
      ``,
      `Verify your prescription:`,
      verifyUrl,
      ``,
      `_This is a digitally signed prescription from CliniqAI._`,
    ].join('\n');

    // Clean phone number (remove spaces, dashes, ensure country code)
    const cleanPhone = phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    res.json({
      success: true,
      whatsappUrl: whatsappUrl,
      message: message,
      recipientPhone: cleanPhone,
    });
  } catch (error) {
    console.error('WhatsApp share error:', error);
    res.status(500).json({ error: 'Failed to generate WhatsApp share link' });
  }
});

// ─── Prescription header ────────────────────────────────────────────────────

router.get('/:prescriptionId/header', authenticate, async (req: Request, res: Response) => {
  try {
    const { prescriptionId } = req.params;
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        doctor: true,
        patient: true,
      },
    });

    if (!prescription) {
      res.status(404).json({ error: 'Prescription not found' });
      return;
    }

    const header = {
      doctorName: prescription.doctor.name,
      doctorSpecialties: prescription.doctor.specialties,
      doctorLicense: prescription.doctor.licenseNumber,
      patientPhone: prescription.patient.phone,
      prescriptionDate: prescription.createdAt.toISOString().split('T')[0],
      prescriptionId: prescription.id,
    };

    res.json(header);
  } catch (error) {
    console.error('Prescription header error:', error);
    res.status(500).json({ error: 'Failed to get prescription header' });
  }
});

export default router;
