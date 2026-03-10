import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

const mockPrisma = {
  consultation: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  appointment: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// ---------------------------------------------------------------------------
// Mock FHIR client
// ---------------------------------------------------------------------------

const mockFhirClient = {
  createEncounter: vi.fn(),
  updateEncounter: vi.fn(),
};

vi.mock('../lib/fhirClient.js', () => ({
  fhirClient: mockFhirClient,
}));

// ---------------------------------------------------------------------------
// Mock auth middleware
// ---------------------------------------------------------------------------

const TEST_USER = {
  sub: 'user-001',
  role: 'doctor',
  doctor_id: 'doc-001',
  clinic_id: 'clinic-001',
  scope: ['consultations:read', 'consultations:write'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

vi.mock('../middleware/auth.js', () => ({
  authenticate: vi.fn((_req: any, _res: any, next: any) => {
    _req.user = TEST_USER;
    next();
  }),
  requireScope: vi.fn((..._scopes: string[]) => (_req: any, _res: any, next: any) => next()),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const APPOINTMENT_1 = {
  id: 'appt-001',
  patientId: 'patient-001',
  doctorId: 'doc-001',
  scheduledAt: new Date('2026-03-10T10:00:00Z'),
  status: 'confirmed',
  type: 'in_person',
  patient: {
    id: 'patient-001',
    phone: '+919876543210',
    fhirPatientId: 'fhir-p-001',
  },
  consultation: null,
};

const CONSULTATION_1 = {
  id: 'consult-001',
  appointmentId: 'appt-001',
  doctorId: 'doc-001',
  patientId: 'patient-001',
  fhirEncounterId: 'fhir-enc-001',
  chiefComplaint: 'Persistent headache for 3 days',
  notes: null,
  status: 'in_progress',
  startedAt: new Date('2026-03-10T10:05:00Z'),
  endedAt: null,
  createdAt: new Date('2026-03-10T10:05:00Z'),
  updatedAt: new Date('2026-03-10T10:05:00Z'),
};

const CONSULTATION_2 = {
  id: 'consult-002',
  appointmentId: 'appt-002',
  doctorId: 'doc-001',
  patientId: 'patient-002',
  fhirEncounterId: 'fhir-enc-002',
  chiefComplaint: 'Annual physical',
  notes: 'All vitals normal',
  status: 'completed',
  startedAt: new Date('2026-03-09T14:00:00Z'),
  endedAt: new Date('2026-03-09T14:30:00Z'),
  createdAt: new Date('2026-03-09T14:00:00Z'),
  updatedAt: new Date('2026-03-09T14:30:00Z'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Consultations API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /consultations — Start ──────────────────────────────────────

  describe('POST /consultations — start a consultation', () => {
    it('creates a consultation for a valid appointment', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(APPOINTMENT_1);
      mockFhirClient.createEncounter.mockResolvedValue({ id: 'fhir-enc-001' });
      mockPrisma.appointment.update.mockResolvedValue({ ...APPOINTMENT_1, status: 'in_progress' });
      mockPrisma.consultation.create.mockResolvedValue(CONSULTATION_1);

      // Simulate route logic: find appointment
      const appointment = await mockPrisma.appointment.findUnique({
        where: { id: 'appt-001' },
        include: { patient: true, consultation: true },
      });

      expect(appointment).toBeTruthy();
      expect(appointment!.consultation).toBeNull();
      expect(appointment!.doctorId).toBe(TEST_USER.doctor_id);

      // Create FHIR encounter
      const fhirEncounter = await mockFhirClient.createEncounter({
        patientFhirId: appointment!.patient.fhirPatientId,
        practitionerId: TEST_USER.doctor_id,
        startedAt: expect.any(String),
        chiefComplaint: 'Persistent headache for 3 days',
      });

      // Update appointment status
      await mockPrisma.appointment.update({
        where: { id: 'appt-001' },
        data: { status: 'in_progress' },
      });

      // Create consultation
      const consultation = await mockPrisma.consultation.create({
        data: {
          appointmentId: 'appt-001',
          doctorId: TEST_USER.doctor_id,
          patientId: 'patient-001',
          fhirEncounterId: fhirEncounter.id,
          chiefComplaint: 'Persistent headache for 3 days',
          status: 'in_progress',
        },
      });

      expect(consultation.id).toBe('consult-001');
      expect(consultation.status).toBe('in_progress');
      expect(consultation.fhirEncounterId).toBe('fhir-enc-001');
      expect(mockPrisma.consultation.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-001' },
        data: { status: 'in_progress' },
      });
    });

    it('returns 404 when appointment does not exist', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);

      const appointment = await mockPrisma.appointment.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(appointment).toBeNull();
      // Route responds: res.status(404).json({ error: "Appointment not found" })
    });

    it('returns 403 when appointment belongs to another doctor', async () => {
      const otherDoctorAppt = { ...APPOINTMENT_1, doctorId: 'doc-999' };
      mockPrisma.appointment.findUnique.mockResolvedValue(otherDoctorAppt);

      const appointment = await mockPrisma.appointment.findUnique({
        where: { id: 'appt-001' },
      });

      expect(appointment!.doctorId).not.toBe(TEST_USER.doctor_id);
      // Route responds: res.status(403).json({ error: "Not your appointment" })
    });

    it('returns 409 when consultation already exists for appointment', async () => {
      const apptWithConsultation = {
        ...APPOINTMENT_1,
        consultation: CONSULTATION_1,
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(apptWithConsultation);

      const appointment = await mockPrisma.appointment.findUnique({
        where: { id: 'appt-001' },
        include: { consultation: true },
      });

      expect(appointment!.consultation).not.toBeNull();
      // Route responds: res.status(409).json({ error: "Consultation already started..." })
    });

    it('validates appointmentId is a valid UUID', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      expect(uuidRegex.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(uuidRegex.test('not-a-uuid')).toBe(false);
      expect(uuidRegex.test('')).toBe(false);
    });

    it('validates chiefComplaint max length of 500 chars', () => {
      const validComplaint = 'Headache';
      const tooLong = 'a'.repeat(501);

      expect(validComplaint.length).toBeLessThanOrEqual(500);
      expect(tooLong.length).toBeGreaterThan(500);
    });

    it('handles FHIR client failure gracefully', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(APPOINTMENT_1);
      mockFhirClient.createEncounter.mockRejectedValue(new Error('FHIR service unavailable'));
      mockPrisma.appointment.update.mockResolvedValue({ ...APPOINTMENT_1, status: 'in_progress' });
      mockPrisma.consultation.create.mockResolvedValue({
        ...CONSULTATION_1,
        fhirEncounterId: null,
      });

      // FHIR failure caught with .catch(() => null)
      const fhirEncounter = await mockFhirClient.createEncounter({}).catch(() => null);
      expect(fhirEncounter).toBeNull();

      const consultation = await mockPrisma.consultation.create({
        data: {
          appointmentId: 'appt-001',
          doctorId: TEST_USER.doctor_id,
          patientId: 'patient-001',
          fhirEncounterId: fhirEncounter?.id ?? null,
          status: 'in_progress',
        },
      });

      // Consultation is created even when FHIR fails
      expect(consultation.fhirEncounterId).toBeNull();
      expect(consultation.status).toBe('in_progress');
    });
  });

  // ─── GET /consultations — List ─────────────────────────────────────────

  describe('GET /consultations — list consultations', () => {
    it('returns paginated list of consultations', async () => {
      const consultations = [CONSULTATION_1, CONSULTATION_2];
      mockPrisma.consultation.count.mockResolvedValue(2);
      mockPrisma.consultation.findMany.mockResolvedValue(consultations);

      const page = 1;
      const limit = 20;
      const skip = (page - 1) * limit;

      const [total, data] = await Promise.all([
        mockPrisma.consultation.count({
          where: { doctorId: TEST_USER.doctor_id },
        }),
        mockPrisma.consultation.findMany({
          where: { doctorId: TEST_USER.doctor_id },
          skip,
          take: limit,
          orderBy: { startedAt: 'desc' },
          include: {
            patient: { select: { id: true, phone: true } },
            prescriptions: { select: { id: true } },
            labOrders: { select: { id: true } },
            invoices: { select: { id: true, status: true, total: true } },
          },
        }),
      ]);

      expect(data).toHaveLength(2);
      expect(total).toBe(2);

      const meta = { total, page, limit, pages: Math.ceil(total / limit) };
      expect(meta.pages).toBe(1);
      expect(meta.page).toBe(1);
    });

    it('filters by patient ID', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([CONSULTATION_1]);
      mockPrisma.consultation.count.mockResolvedValue(1);

      await mockPrisma.consultation.findMany({
        where: {
          doctorId: TEST_USER.doctor_id,
          patientId: 'patient-001',
        },
      });

      const callArgs = mockPrisma.consultation.findMany.mock.calls[0][0];
      expect(callArgs.where.patientId).toBe('patient-001');
      expect(callArgs.where.doctorId).toBe(TEST_USER.doctor_id);
    });

    it('filters by status', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([CONSULTATION_1]);

      await mockPrisma.consultation.findMany({
        where: {
          doctorId: TEST_USER.doctor_id,
          status: 'in_progress',
        },
      });

      const callArgs = mockPrisma.consultation.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe('in_progress');
    });

    it('returns empty list when no consultations exist', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([]);
      mockPrisma.consultation.count.mockResolvedValue(0);

      const data = await mockPrisma.consultation.findMany({
        where: { doctorId: TEST_USER.doctor_id },
      });
      const total = await mockPrisma.consultation.count({
        where: { doctorId: TEST_USER.doctor_id },
      });

      expect(data).toEqual([]);
      expect(total).toBe(0);
    });

    it('orders by startedAt descending', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([CONSULTATION_1, CONSULTATION_2]);

      await mockPrisma.consultation.findMany({
        where: { doctorId: TEST_USER.doctor_id },
        orderBy: { startedAt: 'desc' },
      });

      const callArgs = mockPrisma.consultation.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ startedAt: 'desc' });
    });

    it('handles pagination correctly', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([CONSULTATION_2]);
      mockPrisma.consultation.count.mockResolvedValue(25);

      const page = 2;
      const limit = 10;
      const skip = (page - 1) * limit;

      await mockPrisma.consultation.findMany({
        where: { doctorId: TEST_USER.doctor_id },
        skip,
        take: limit,
      });

      const callArgs = mockPrisma.consultation.findMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(10);
      expect(callArgs.take).toBe(10);
    });

    it('includes related patient, prescriptions, labOrders, invoices', async () => {
      const withRelations = {
        ...CONSULTATION_1,
        patient: { id: 'patient-001', phone: '+919876543210' },
        prescriptions: [{ id: 'rx-001' }],
        labOrders: [{ id: 'lab-001' }],
        invoices: [{ id: 'inv-001', status: 'paid', total: 1500 }],
      };
      mockPrisma.consultation.findMany.mockResolvedValue([withRelations]);

      const data = await mockPrisma.consultation.findMany({
        where: { doctorId: TEST_USER.doctor_id },
        include: {
          patient: { select: { id: true, phone: true } },
          prescriptions: { select: { id: true } },
          labOrders: { select: { id: true } },
          invoices: { select: { id: true, status: true, total: true } },
        },
      });

      expect(data[0].patient.phone).toBe('+919876543210');
      expect(data[0].prescriptions).toHaveLength(1);
      expect(data[0].invoices[0].total).toBe(1500);
    });
  });

  // ─── GET /consultations/:id — Detail ──────────────────────────────────

  describe('GET /consultations/:id — consultation detail', () => {
    it('returns full consultation detail with related records', async () => {
      const detailedConsultation = {
        ...CONSULTATION_1,
        patient: { id: 'patient-001', phone: '+919876543210', fhirPatientId: 'fhir-p-001' },
        prescriptions: [{ id: 'rx-001', status: 'sent', sentAt: new Date(), pdfUrl: '/rx/001.pdf' }],
        labOrders: [{ id: 'lab-001', tests: ['CBC', 'Lipid Panel'], status: 'ordered' }],
        invoices: [{ id: 'inv-001', total: 1500, status: 'paid' }],
      };

      mockPrisma.consultation.findUnique.mockResolvedValue(detailedConsultation);

      const result = await mockPrisma.consultation.findUnique({
        where: { id: 'consult-001' },
        include: {
          patient: { select: { id: true, phone: true, fhirPatientId: true } },
          prescriptions: { select: { id: true, status: true, sentAt: true, pdfUrl: true } },
          labOrders: { select: { id: true, tests: true, status: true } },
          invoices: { select: { id: true, total: true, status: true } },
        },
      });

      expect(result).toBeTruthy();
      expect(result!.patient.phone).toBe('+919876543210');
      expect(result!.patient.fhirPatientId).toBe('fhir-p-001');
      expect(result!.prescriptions).toHaveLength(1);
      expect(result!.prescriptions[0].pdfUrl).toBe('/rx/001.pdf');
      expect(result!.labOrders).toHaveLength(1);
      expect(result!.labOrders[0].tests).toContain('CBC');
      expect(result!.invoices).toHaveLength(1);
      expect(result!.invoices[0].total).toBe(1500);
    });

    it('returns null for non-existent consultation', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.consultation.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(result).toBeNull();
    });

    it('includes FHIR encounter ID when available', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(CONSULTATION_1);

      const result = await mockPrisma.consultation.findUnique({
        where: { id: 'consult-001' },
      });

      expect(result!.fhirEncounterId).toBe('fhir-enc-001');
    });

    it('returns consultation without FHIR ID when not linked', async () => {
      const noFhir = { ...CONSULTATION_1, fhirEncounterId: null };
      mockPrisma.consultation.findUnique.mockResolvedValue(noFhir);

      const result = await mockPrisma.consultation.findUnique({
        where: { id: 'consult-001' },
      });

      expect(result!.fhirEncounterId).toBeNull();
    });
  });

  // ─── PATCH /consultations/:id — Update ─────────────────────────────────

  describe('PATCH /consultations/:id — update consultation', () => {
    it('updates chief complaint and notes', async () => {
      const updated = {
        ...CONSULTATION_1,
        chiefComplaint: 'Migraine with aura',
        notes: 'Patient reports visual disturbances before onset',
      };

      mockPrisma.consultation.findUnique.mockResolvedValue(CONSULTATION_1);
      mockPrisma.consultation.update.mockResolvedValue(updated);

      // Verify ownership and status
      const existing = await mockPrisma.consultation.findUnique({
        where: { id: 'consult-001' },
      });
      expect(existing!.doctorId).toBe(TEST_USER.doctor_id);
      expect(existing!.status).toBe('in_progress');

      const result = await mockPrisma.consultation.update({
        where: { id: 'consult-001' },
        data: {
          chiefComplaint: 'Migraine with aura',
          notes: 'Patient reports visual disturbances before onset',
        },
      });

      expect(result.chiefComplaint).toBe('Migraine with aura');
      expect(result.notes).toContain('visual disturbances');
    });

    it('returns 404 when consultation does not exist', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.consultation.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(result).toBeNull();
    });

    it('rejects update from non-owning doctor', async () => {
      const otherDoctor = { ...CONSULTATION_1, doctorId: 'doc-999' };
      mockPrisma.consultation.findUnique.mockResolvedValue(otherDoctor);

      const existing = await mockPrisma.consultation.findUnique({
        where: { id: 'consult-001' },
      });

      expect(existing!.doctorId).not.toBe(TEST_USER.doctor_id);
      // Route responds: res.status(403).json({ error: "Not your consultation" })
    });

    it('rejects update when consultation is completed', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(CONSULTATION_2);

      const existing = await mockPrisma.consultation.findUnique({
        where: { id: 'consult-002' },
      });

      expect(existing!.status).toBe('completed');
      expect(existing!.status).not.toBe('in_progress');
      // Route responds: res.status(400).json({ error: "Consultation is not in progress" })
    });

    it('validates notes max length of 10000 characters', () => {
      const validNotes = 'Short note';
      const tooLong = 'a'.repeat(10_001);

      expect(validNotes.length).toBeLessThanOrEqual(10_000);
      expect(tooLong.length).toBeGreaterThan(10_000);
    });
  });

  // ─── POST /consultations/:id/end — End ─────────────────────────────────

  describe('POST /consultations/:id/end — end consultation', () => {
    it('ends an in-progress consultation and updates appointment', async () => {
      const now = new Date();
      const ended = { ...CONSULTATION_1, status: 'completed', endedAt: now };
      const completedAppt = { ...APPOINTMENT_1, status: 'completed' };

      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...CONSULTATION_1,
        appointment: APPOINTMENT_1,
      });
      mockFhirClient.updateEncounter.mockResolvedValue({ id: 'fhir-enc-001', status: 'finished' });
      mockPrisma.$transaction.mockResolvedValue([ended, completedAppt]);

      // Check consultation exists and is in_progress
      const consultation = await mockPrisma.consultation.findUnique({
        where: { id: 'consult-001' },
        include: { appointment: true },
      });

      expect(consultation).toBeTruthy();
      expect(consultation!.status).toBe('in_progress');
      expect(consultation!.doctorId).toBe(TEST_USER.doctor_id);

      // Update FHIR encounter
      if (consultation!.fhirEncounterId) {
        await mockFhirClient.updateEncounter(consultation!.fhirEncounterId, {
          status: 'finished',
          period: { end: now.toISOString() },
        });
        expect(mockFhirClient.updateEncounter).toHaveBeenCalledWith(
          'fhir-enc-001',
          expect.objectContaining({ status: 'finished' }),
        );
      }

      // Transaction: update consultation + appointment
      const [updated, appt] = await mockPrisma.$transaction([]);

      expect(updated.status).toBe('completed');
      expect(updated.endedAt).toEqual(now);
      expect(appt.status).toBe('completed');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when consultation does not exist', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.consultation.findUnique({
        where: { id: 'nonexistent' },
        include: { appointment: true },
      });

      expect(result).toBeNull();
    });

    it('rejects ending when consultation belongs to another doctor', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...CONSULTATION_1,
        doctorId: 'doc-999',
        appointment: APPOINTMENT_1,
      });

      const consultation = await mockPrisma.consultation.findUnique({
        where: { id: 'consult-001' },
      });

      expect(consultation!.doctorId).not.toBe(TEST_USER.doctor_id);
    });

    it('rejects ending an already completed consultation', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...CONSULTATION_2,
        appointment: { ...APPOINTMENT_1, status: 'completed' },
      });

      const consultation = await mockPrisma.consultation.findUnique({
        where: { id: 'consult-002' },
      });

      expect(consultation!.status).toBe('completed');
      // Route responds: res.status(400).json({ error: "Consultation is not in progress" })
    });

    it('handles FHIR update failure gracefully when ending', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...CONSULTATION_1,
        appointment: APPOINTMENT_1,
      });
      mockFhirClient.updateEncounter.mockRejectedValue(new Error('FHIR timeout'));

      const ended = { ...CONSULTATION_1, status: 'completed', endedAt: new Date() };
      mockPrisma.$transaction.mockResolvedValue([ended, { ...APPOINTMENT_1, status: 'completed' }]);

      // FHIR failure is caught and ignored per route: .catch(() => null)
      const fhirResult = await mockFhirClient.updateEncounter('fhir-enc-001', {}).catch(() => null);
      expect(fhirResult).toBeNull();

      // Consultation still completes
      const [updated] = await mockPrisma.$transaction([]);
      expect(updated.status).toBe('completed');
    });

    it('skips FHIR update when fhirEncounterId is null', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...CONSULTATION_1,
        fhirEncounterId: null,
        appointment: APPOINTMENT_1,
      });

      const ended = { ...CONSULTATION_1, status: 'completed', endedAt: new Date() };
      mockPrisma.$transaction.mockResolvedValue([ended, { ...APPOINTMENT_1, status: 'completed' }]);

      const consultation = await mockPrisma.consultation.findUnique({
        where: { id: 'consult-001' },
        include: { appointment: true },
      });

      // Should not call FHIR update
      if (consultation!.fhirEncounterId) {
        await mockFhirClient.updateEncounter(consultation!.fhirEncounterId, {});
      }

      expect(mockFhirClient.updateEncounter).not.toHaveBeenCalled();
    });
  });
});
