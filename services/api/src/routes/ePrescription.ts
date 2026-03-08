import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

interface PrescriptionPayload {
  prescriptionId: string;
  doctorName: string;
  doctorRegistration: string;
  clinicName: string;
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
    instructions?: string;
  }[];
  advice?: string;
  followUpDate?: string;
  signature: string;
  qrData: string;
}

// Generate e-prescription with QR code data
router.post('/:prescriptionId/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { prescriptionId } = req.params;
    const doctorId = (req as any).auth.doctor_id;

    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        patient: true,
        doctor: {
          include: { clinic: true },
        },
        consultation: true,
      },
    });

    if (!prescription) {
      res.status(404).json({ error: 'Prescription not found' });
      return;
    }

    if (prescription.doctor_id !== doctorId) {
      res.status(403).json({ error: 'Not authorized to access this prescription' });
      return;
    }

    // Build prescription payload
    const payload: PrescriptionPayload = {
      prescriptionId: prescription.id,
      doctorName: `Dr. ${prescription.doctor.first_name} ${prescription.doctor.last_name}`,
      doctorRegistration: prescription.doctor.registration_number || '',
      clinicName: prescription.doctor.clinic?.name || '',
      patientName: `${prescription.patient.first_name} ${prescription.patient.last_name}`,
      patientAge: calculateAge(prescription.patient.date_of_birth),
      patientGender: prescription.patient.gender,
      date: prescription.created_at.toISOString().split('T')[0],
      diagnosis: prescription.consultation?.diagnosis || '',
      medications: (prescription.medications as any[]) || [],
      advice: prescription.advice || undefined,
      followUpDate: prescription.follow_up_date?.toISOString().split('T')[0] || undefined,
      signature: '',
      qrData: '',
    };

    // Generate digital signature
    const signatureData = JSON.stringify({
      id: payload.prescriptionId,
      doctor: payload.doctorRegistration,
      patient: payload.patientName,
      date: payload.date,
      medications: payload.medications.map((m) => m.drug),
    });

    const signature = crypto
      .createHmac('sha256', process.env.ENCRYPTION_KEY || 'default-key')
      .update(signatureData)
      .digest('hex');

    payload.signature = signature;

    // QR code data - compact verification payload
    const qrPayload = {
      v: 1, // version
      id: prescription.id.slice(0, 12),
      dr: payload.doctorRegistration,
      dt: payload.date,
      rx: payload.medications.length,
      sig: signature.slice(0, 16),
      url: `${process.env.APP_URL || 'https://app.cliniqai.com'}/verify/${prescription.id}`,
    };

    payload.qrData = JSON.stringify(qrPayload);

    // Store e-prescription metadata
    await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        digital_signature: signature,
        qr_data: payload.qrData,
        e_prescription_generated: true,
        e_prescription_generated_at: new Date(),
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
        doctor: { include: { clinic: true } },
        patient: true,
      },
    });

    if (!prescription) {
      res.status(404).json({ valid: false, error: 'Prescription not found' });
      return;
    }

    if (!prescription.digital_signature) {
      res.status(400).json({ valid: false, error: 'Prescription not digitally signed' });
      return;
    }

    // Re-compute signature to verify
    const signatureData = JSON.stringify({
      id: prescription.id,
      doctor: prescription.doctor.registration_number || '',
      patient: `${prescription.patient.first_name} ${prescription.patient.last_name}`,
      date: prescription.created_at.toISOString().split('T')[0],
      medications: ((prescription.medications as any[]) || []).map((m: any) => m.drug),
    });

    const expectedSignature = crypto
      .createHmac('sha256', process.env.ENCRYPTION_KEY || 'default-key')
      .update(signatureData)
      .digest('hex');

    const isValid = prescription.digital_signature === expectedSignature;

    res.json({
      valid: isValid,
      prescription: isValid
        ? {
            id: prescription.id,
            doctor: `Dr. ${prescription.doctor.first_name} ${prescription.doctor.last_name}`,
            registration: prescription.doctor.registration_number,
            clinic: prescription.doctor.clinic?.name,
            patient: `${prescription.patient.first_name} ${prescription.patient.last_name}`,
            date: prescription.created_at.toISOString().split('T')[0],
            medicationCount: ((prescription.medications as any[]) || []).length,
            generatedAt: prescription.e_prescription_generated_at,
          }
        : null,
    });
  } catch (error) {
    console.error('Prescription verification error:', error);
    res.status(500).json({ valid: false, error: 'Verification failed' });
  }
});

// NMC-compliant prescription header
router.get('/:prescriptionId/header', authenticate, async (req: Request, res: Response) => {
  try {
    const { prescriptionId } = req.params;
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        doctor: { include: { clinic: true } },
        patient: true,
      },
    });

    if (!prescription) {
      res.status(404).json({ error: 'Prescription not found' });
      return;
    }

    // NMC format header
    const header = {
      clinicName: prescription.doctor.clinic?.name || '',
      clinicAddress: prescription.doctor.clinic?.address || '',
      clinicPhone: prescription.doctor.clinic?.phone || '',
      doctorName: `Dr. ${prescription.doctor.first_name} ${prescription.doctor.last_name}`,
      doctorQualification: prescription.doctor.qualification || '',
      doctorRegistration: prescription.doctor.registration_number || '',
      doctorSpecialization: prescription.doctor.specialization || '',
      patientName: `${prescription.patient.first_name} ${prescription.patient.last_name}`,
      patientAge: calculateAge(prescription.patient.date_of_birth),
      patientGender: prescription.patient.gender,
      patientPhone: prescription.patient.phone,
      prescriptionDate: prescription.created_at.toISOString().split('T')[0],
      prescriptionId: prescription.id,
    };

    res.json(header);
  } catch (error) {
    console.error('Prescription header error:', error);
    res.status(500).json({ error: 'Failed to get prescription header' });
  }
});

function calculateAge(dob: Date | null): number {
  if (!dob) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export default router;
