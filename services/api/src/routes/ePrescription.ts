import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// Generate e-prescription with QR code data
router.post('/:prescriptionId/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { prescriptionId } = req.params;
    const doctorId = (req as any).auth.doctor_id;

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

    // Build prescription payload
    const payload = {
      prescriptionId: prescription.id,
      doctorName: prescription.doctor.name,
      clinicName: '',
      patientPhone: prescription.patient.phone,
      date: prescription.createdAt.toISOString().split('T')[0],
      diagnosis: prescription.consultation?.chiefComplaint || '',
      signature: '',
      qrData: '',
    };

    // Generate digital signature
    const signatureData = JSON.stringify({
      id: payload.prescriptionId,
      doctor: payload.doctorName,
      patient: payload.patientPhone,
      date: payload.date,
    });

    const signature = crypto
      .createHmac('sha256', process.env.ENCRYPTION_KEY || 'default-key')
      .update(signatureData)
      .digest('hex');

    payload.signature = signature;

    // QR code data - compact verification payload
    const qrPayload = {
      v: 1,
      id: prescription.id.slice(0, 12),
      dr: payload.doctorName,
      dt: payload.date,
      sig: signature.slice(0, 16),
      url: `${process.env.APP_URL || 'https://app.cliniqai.com'}/verify/${prescription.id}`,
    };

    payload.qrData = JSON.stringify(qrPayload);

    // Store e-prescription metadata
    await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        digitalSignature: signature,
        qrData: payload.qrData,
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

// Verify prescription via QR code (public endpoint)
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
    const signatureData = JSON.stringify({
      id: prescription.id,
      doctor: prescription.doctor.name,
      patient: prescription.patient.phone,
      date: prescription.createdAt.toISOString().split('T')[0],
    });

    const expectedSignature = crypto
      .createHmac('sha256', process.env.ENCRYPTION_KEY || 'default-key')
      .update(signatureData)
      .digest('hex');

    const isValid = prescription.digitalSignature === expectedSignature;

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

// Prescription header
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
