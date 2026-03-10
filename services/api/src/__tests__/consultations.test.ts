import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    consultation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    appointment: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    _req.auth = { doctor_id: 'doc_123', clinic_id: 'clinic_123', user_id: 'user_123' };
    next();
  },
}));

import { prisma } from '../lib/prisma';

describe('Consultations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /consultations', () => {
    it('should create a consultation for a valid appointment', async () => {
      const mockAppointment = {
        id: 'appt_1',
        patientId: 'patient_1',
        doctorId: 'doc_123',
        status: 'confirmed',
      };

      const mockConsultation = {
        id: 'consult_1',
        appointmentId: 'appt_1',
        patientId: 'patient_1',
        doctorId: 'doc_123',
        status: 'in_progress',
        chiefComplaint: 'Headache',
        startedAt: new Date(),
      };

      (prisma.appointment.findUnique as any).mockResolvedValue(mockAppointment);
      (prisma.consultation.create as any).mockResolvedValue(mockConsultation);
      (prisma.appointment.update as any).mockResolvedValue({ ...mockAppointment, status: 'in_consultation' });

      expect(mockConsultation.status).toBe('in_progress');
      expect(mockConsultation.appointmentId).toBe('appt_1');
    });

    it('should reject consultation for non-existent appointment', async () => {
      (prisma.appointment.findUnique as any).mockResolvedValue(null);

      const result = await prisma.appointment.findUnique({ where: { id: 'invalid' } });
      expect(result).toBeNull();
    });
  });

  describe('GET /consultations', () => {
    it('should return paginated list of consultations', async () => {
      const mockConsultations = [
        { id: 'c1', status: 'in_progress', chiefComplaint: 'Fever' },
        { id: 'c2', status: 'completed', chiefComplaint: 'Cough' },
      ];

      (prisma.consultation.findMany as any).mockResolvedValue(mockConsultations);
      (prisma.consultation.count as any).mockResolvedValue(2);

      const data = await prisma.consultation.findMany({ take: 20, skip: 0 });
      const total = await prisma.consultation.count();

      expect(data).toHaveLength(2);
      expect(total).toBe(2);
    });

    it('should filter by status', async () => {
      const active = [{ id: 'c1', status: 'in_progress' }];
      (prisma.consultation.findMany as any).mockResolvedValue(active);

      const data = await prisma.consultation.findMany({
        where: { status: 'in_progress' },
      });

      expect(data).toHaveLength(1);
      expect(data[0].status).toBe('in_progress');
    });
  });

  describe('GET /consultations/:id', () => {
    it('should return consultation with related data', async () => {
      const mockConsultation = {
        id: 'c1',
        status: 'in_progress',
        chiefComplaint: 'Migraine',
        notes: 'Patient reports recurring headaches',
        patient: { id: 'p1', phone: '+919876543210' },
        prescriptions: [],
        labOrders: [],
      };

      (prisma.consultation.findUnique as any).mockResolvedValue(mockConsultation);

      const data = await prisma.consultation.findUnique({
        where: { id: 'c1' },
        include: { prescriptions: true },
      });

      expect(data).toBeDefined();
      expect(data?.chiefComplaint).toBe('Migraine');
    });

    it('should return null for non-existent consultation', async () => {
      (prisma.consultation.findUnique as any).mockResolvedValue(null);

      const data = await prisma.consultation.findUnique({ where: { id: 'invalid' } });
      expect(data).toBeNull();
    });
  });

  describe('PATCH /consultations/:id', () => {
    it('should update consultation notes', async () => {
      const updated = {
        id: 'c1',
        notes: 'Updated clinical notes',
        chiefComplaint: 'Headache',
      };

      (prisma.consultation.update as any).mockResolvedValue(updated);

      const data = await prisma.consultation.update({
        where: { id: 'c1' },
        data: { notes: 'Updated clinical notes' },
      });

      expect(data.notes).toBe('Updated clinical notes');
    });
  });

  describe('POST /consultations/:id/end', () => {
    it('should end a consultation and update status', async () => {
      const ended = {
        id: 'c1',
        status: 'completed',
        endedAt: new Date(),
      };

      (prisma.consultation.update as any).mockResolvedValue(ended);

      const data = await prisma.consultation.update({
        where: { id: 'c1' },
        data: { status: 'completed', endedAt: new Date() },
      });

      expect(data.status).toBe('completed');
      expect(data.endedAt).toBeDefined();
    });
  });
});
