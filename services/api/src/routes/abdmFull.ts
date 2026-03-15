import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { abdmClient } from '../lib/abdmClientFull';

const router = Router();

// ============= ABHA ID MANAGEMENT =============

// Create ABHA number for patient
router.post('/abha/create', authenticate, async (req: Request, res: Response) => {
  try {
    const { patientId, aadhaarNumber } = req.body;

    // Step 1: Generate Aadhaar OTP
    const otpResponse = await abdmClient.generateAadhaarOtp(aadhaarNumber);

    res.json({
      txnId: otpResponse.txnId,
      message: 'OTP sent to Aadhaar-linked mobile',
    });
  } catch (error: any) {
    console.error('ABHA creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate ABHA creation' });
  }
});

// Verify Aadhaar OTP and complete ABHA creation
router.post('/abha/verify-otp', authenticate, async (req: Request, res: Response) => {
  try {
    const { patientId, txnId, otp } = req.body;

    // Verify OTP with ABDM gateway
    const verifyResponse = await abdmClient.verifyAadhaarOtp(txnId, otp);

    if (verifyResponse.healthIdNumber) {
      // Store ABHA details in patient record
      await prisma.patient.update({
        where: { id: patientId },
        data: {
          abhaNumber: verifyResponse.healthIdNumber,
          abhaAddress: verifyResponse.healthId,
          abdmLinked: true,
          abdmLinkedAt: new Date(),
        },
      });

      res.json({
        success: true,
        abhaNumber: verifyResponse.healthIdNumber,
        abhaAddress: verifyResponse.healthId,
        message: 'ABHA number created and linked successfully',
      });
    } else {
      res.status(400).json({ error: 'OTP verification failed' });
    }
  } catch (error: any) {
    console.error('ABHA verify error:', error);
    res.status(500).json({ error: error.message || 'ABHA verification failed' });
  }
});

// Link existing ABHA number to patient
router.post('/abha/link', authenticate, async (req: Request, res: Response) => {
  try {
    const { patientId, abhaNumber } = req.body;

    // Verify ABHA number exists
    const verified = await abdmClient.verifyAbhaNumber(abhaNumber);

    if (!verified.valid) {
      res.status(400).json({ error: 'Invalid ABHA number' });
      return;
    }

    await prisma.patient.update({
      where: { id: patientId },
      data: {
        abhaNumber: abhaNumber,
        abhaAddress: verified.abhaAddress,
        abdmLinked: true,
        abdmLinkedAt: new Date(),
      },
    });

    res.json({
      success: true,
      abhaNumber,
      patientName: verified.name,
      message: 'ABHA number linked successfully',
    });
  } catch (error: any) {
    console.error('ABHA link error:', error);
    res.status(500).json({ error: 'Failed to link ABHA number' });
  }
});

// ============= HEALTH INFORMATION PROVIDER (HIP) =============

// Register as Health Information Provider
router.post('/hip/register', authenticate, async (req: Request, res: Response) => {
  try {
    const clinicId = (req as any).auth.clinic_id;

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      res.status(404).json({ error: 'Clinic not found' });
      return;
    }

    // Register with ABDM as HIP
    const hipResponse = await abdmClient.registerAsHip({
      facilityName: clinic.name,
      facilityId: clinic.id,
      address: clinic.address || '',
      type: 'clinic',
    });

    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        abdmHipId: hipResponse.hipId,
        abdmRegistered: true,
        abdmRegisteredAt: new Date(),
      },
    });

    res.json({
      success: true,
      hipId: hipResponse.hipId,
      message: 'Registered as Health Information Provider',
    });
  } catch (error: any) {
    console.error('HIP registration error:', error);
    res.status(500).json({ error: 'HIP registration failed' });
  }
});

// ============= CONSENT MANAGEMENT =============

// Request consent to access patient health records
router.post('/consent/request', authenticate, async (req: Request, res: Response) => {
  try {
    const { patientId, purpose, dateRange, healthInfoTypes } = req.body;

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient?.abhaNumber) {
      res.status(400).json({ error: 'Patient does not have an ABHA number linked' });
      return;
    }

    const consentRequest = await abdmClient.requestConsent({
      patientAbhaAddress: patient.abhaAddress!,
      purpose: purpose || 'CAREMGT',
      dateRange: dateRange || { from: '2020-01-01', to: new Date().toISOString().split('T')[0] },
      healthInfoTypes: healthInfoTypes || [
        'Prescription',
        'DiagnosticReport',
        'OPConsultation',
        'DischargeSummary',
        'ImmunizationRecord',
      ],
      hipId: (req as any).auth.clinic_id,
    });

    // Store consent request
    await prisma.abdmConsent.create({
      data: {
        patientId,
        consentRequestId: consentRequest.requestId,
        status: 'REQUESTED',
        purpose,
        requestedBy: (req as any).auth.doctor_id,
        healthInfoTypes: healthInfoTypes,
        dateRangeFrom: dateRange?.from ? new Date(dateRange.from) : new Date('2020-01-01'),
        dateRangeTo: dateRange?.to ? new Date(dateRange.to) : new Date(),
      },
    });

    res.json({
      requestId: consentRequest.requestId,
      status: 'REQUESTED',
      message: 'Consent request sent to patient. They will approve via their PHR app.',
    });
  } catch (error: any) {
    console.error('Consent request error:', error);
    res.status(500).json({ error: 'Failed to request consent' });
  }
});

// ABDM callback - consent notification (unauthenticated, ABDM calls this)
router.post('/consent/callback', async (req: Request, res: Response) => {
  try {
    const { consentRequestId, status, consentArtefactId } = req.body;

    // Verify the callback is from ABDM (check signature)
    const isValid = verifyAbdmCallback(req);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid callback signature' });
      return;
    }

    // Update consent status
    await prisma.abdmConsent.updateMany({
      where: { consentRequestId },
      data: {
        status: status === 'GRANTED' ? 'GRANTED' : 'DENIED',
        consentArtefactId: consentArtefactId || null,
        respondedAt: new Date(),
      },
    });

    // If consent granted, fetch health records
    if (status === 'GRANTED' && consentArtefactId) {
      const consent = await prisma.abdmConsent.findFirst({
        where: { consentRequestId },
      });

      if (consent) {
        // Async fetch health records
        fetchAndStoreHealthRecords(consent.patientId, consentArtefactId).catch(console.error);
      }
    }

    res.json({ status: 'OK' });
  } catch (error) {
    console.error('Consent callback error:', error);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

// Get consent status for a patient
router.get('/consent/:patientId', authenticate, async (req: Request, res: Response) => {
  try {
    const consents = await prisma.abdmConsent.findMany({
      where: { patientId: req.params.patientId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(consents);
  } catch (error) {
    console.error('Consent list error:', error);
    res.status(500).json({ error: 'Failed to get consents' });
  }
});

// ============= HEALTH RECORD SHARING =============

// Push health records to ABDM (when we're the source)
router.post('/records/push', authenticate, async (req: Request, res: Response) => {
  try {
    const { patientId, consultationId } = req.body;

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient?.abhaNumber) {
      res.status(400).json({ error: 'Patient ABHA not linked' });
      return;
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        prescriptions: true,
        doctor: true,
      },
    });

    if (!consultation) {
      res.status(404).json({ error: 'Consultation not found' });
      return;
    }

    // Build FHIR bundle for ABDM
    const fhirBundle = buildFhirBundleForAbdm(patient, consultation);

    // Push to ABDM Health Information Exchange
    const pushResponse = await abdmClient.pushHealthRecords({
      patientAbhaAddress: patient.abhaAddress!,
      bundle: fhirBundle,
      careContextReference: consultationId,
    });

    // Record the push
    await prisma.abdmHealthRecord.create({
      data: {
        patientId,
        consultationId,
        recordType: 'OPConsultation',
        pushedAt: new Date(),
        transactionId: pushResponse.transactionId,
        status: 'PUSHED',
      },
    });

    res.json({
      success: true,
      transactionId: pushResponse.transactionId,
      message: 'Health records pushed to ABDM successfully',
    });
  } catch (error: any) {
    console.error('Record push error:', error);
    res.status(500).json({ error: 'Failed to push records' });
  }
});

// ============= HELPER FUNCTIONS =============

function verifyAbdmCallback(req: Request): boolean {
  // Verify HMAC signature from ABDM gateway
  const signature = req.headers['x-abdm-signature'] as string;
  if (!signature) return process.env.NODE_ENV === 'development' && process.env.ALLOW_ABDM_DEV_BYPASS === 'true'; // Allow in dev only with explicit flag

  const expectedSignature = crypto
    .createHmac('sha256', process.env.ABDM_CLIENT_SECRET || '')
    .update(JSON.stringify(req.body))
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

async function fetchAndStoreHealthRecords(patientId: string, consentArtefactId: string) {
  try {
    const records = await abdmClient.fetchHealthRecords(consentArtefactId) as any[];

    for (const record of records) {
      await prisma.abdmHealthRecord.create({
        data: {
          patientId,
          recordType: record.resourceType || 'Unknown',
          sourceHip: record.hipId || 'unknown',
          fetchedAt: new Date(),
          fhirResource: record.data,
          status: 'RECEIVED',
        },
      });
    }
  } catch (error) {
    console.error('Health record fetch error:', error);
  }
}

function buildFhirBundleForAbdm(patient: any, consultation: any) {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        resource: {
          resourceType: 'Composition',
          status: 'final',
          type: {
            coding: [{ system: 'https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-document-type', code: 'OP Consultation', display: 'OP Consultation' }],
          },
          subject: { reference: `Patient/${patient.id}` },
          date: consultation.createdAt,
          author: [{ display: consultation.doctor?.name ?? 'Doctor' }],
          title: 'OP Consultation Record',
          section: [
            {
              title: 'Clinical Notes',
              entry: [{ display: consultation.notes || 'No notes recorded' }],
            },
          ],
        },
      },
      {
        resource: {
          resourceType: 'Patient',
          identifier: [{ system: 'https://healthid.ndhm.gov.in', value: patient.abhaNumber }],
          name: [{ text: patient.phone }],
          gender: 'unknown',
        },
      },
    ],
  };
}

export default router;
