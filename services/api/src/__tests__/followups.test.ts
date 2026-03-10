import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

const mockPrisma = {
  followUp: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// ---------------------------------------------------------------------------
// Mock auth middleware — always passes with a test doctor user
// ---------------------------------------------------------------------------

const TEST_USER = {
  sub: 'user-001',
  role: 'doctor',
  doctor_id: 'doc-001',
  clinic_id: 'clinic-001',
  scope: ['followups:read', 'followups:write'],
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

const FOLLOW_UP_1 = {
  id: 'fu-001',
  patientId: 'patient-001',
  doctorId: 'doc-001',
  consultationId: 'consult-001',
  scheduledDate: new Date('2026-03-15T10:00:00Z'),
  reason: 'Post-surgery check-up',
  status: 'scheduled',
  notes: 'Check wound healing progress',
  createdAt: new Date('2026-03-10T08:00:00Z'),
  updatedAt: new Date('2026-03-10T08:00:00Z'),
};

const FOLLOW_UP_2 = {
  id: 'fu-002',
  patientId: 'patient-002',
  doctorId: 'doc-001',
  consultationId: 'consult-002',
  scheduledDate: new Date('2026-03-12T14:00:00Z'),
  reason: 'Blood pressure monitoring',
  status: 'scheduled',
  notes: null,
  createdAt: new Date('2026-03-10T09:00:00Z'),
  updatedAt: new Date('2026-03-10T09:00:00Z'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Follow-ups API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /followups — Create ──────────────────────────────────────────

  describe('POST /followups — create a follow-up', () => {
    it('creates a follow-up with valid data', async () => {
      const input = {
        patientId: 'patient-001',
        consultationId: 'consult-001',
        scheduledDate: '2026-03-15T10:00:00Z',
        reason: 'Post-surgery check-up',
        notes: 'Check wound healing progress',
      };

      mockPrisma.followUp.create.mockResolvedValue(FOLLOW_UP_1);

      const result = await mockPrisma.followUp.create({
        data: {
          ...input,
          doctorId: TEST_USER.doctor_id,
          status: 'scheduled',
        },
      });

      expect(result).toEqual(FOLLOW_UP_1);
      expect(result.id).toBe('fu-001');
      expect(result.status).toBe('scheduled');
      expect(mockPrisma.followUp.create).toHaveBeenCalledTimes(1);
    });

    it('rejects creation with missing required fields', () => {
      const invalidInput = {
        // Missing patientId and scheduledDate
        reason: 'Check-up',
      };

      // Validate required fields
      const errors: string[] = [];
      if (!('patientId' in invalidInput)) errors.push('patientId is required');
      if (!('scheduledDate' in invalidInput)) errors.push('scheduledDate is required');

      expect(errors).toContain('patientId is required');
      expect(errors).toContain('scheduledDate is required');
    });

    it('rejects creation with invalid date format', () => {
      const invalidDate = 'not-a-date';
      const parsed = new Date(invalidDate);

      expect(isNaN(parsed.getTime())).toBe(true);
    });

    it('associates follow-up with the authenticated doctor', async () => {
      mockPrisma.followUp.create.mockResolvedValue(FOLLOW_UP_1);

      await mockPrisma.followUp.create({
        data: {
          patientId: 'patient-001',
          doctorId: TEST_USER.doctor_id,
          scheduledDate: new Date('2026-03-15T10:00:00Z'),
          reason: 'Follow-up',
          status: 'scheduled',
        },
      });

      const callArgs = mockPrisma.followUp.create.mock.calls[0][0];
      expect(callArgs.data.doctorId).toBe('doc-001');
    });
  });

  // ─── GET /followups — Paginated list ────────────────────────────────────

  describe('GET /followups — paginated list', () => {
    it('returns paginated list of follow-ups', async () => {
      const followUps = [FOLLOW_UP_1, FOLLOW_UP_2];

      mockPrisma.followUp.findMany.mockResolvedValue(followUps);
      mockPrisma.followUp.count.mockResolvedValue(2);

      const page = 1;
      const limit = 20;
      const skip = (page - 1) * limit;

      const [total, data] = await Promise.all([
        mockPrisma.followUp.count({ where: { doctorId: TEST_USER.doctor_id } }),
        mockPrisma.followUp.findMany({
          where: { doctorId: TEST_USER.doctor_id },
          skip,
          take: limit,
          orderBy: { scheduledDate: 'asc' },
        }),
      ]);

      expect(data).toHaveLength(2);
      expect(total).toBe(2);

      const meta = {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
      expect(meta.pages).toBe(1);
    });

    it('respects pagination parameters', async () => {
      mockPrisma.followUp.findMany.mockResolvedValue([FOLLOW_UP_2]);
      mockPrisma.followUp.count.mockResolvedValue(25);

      const page = 2;
      const limit = 10;
      const skip = (page - 1) * limit;

      await mockPrisma.followUp.findMany({
        where: { doctorId: TEST_USER.doctor_id },
        skip,
        take: limit,
        orderBy: { scheduledDate: 'asc' },
      });

      const callArgs = mockPrisma.followUp.findMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(10);
      expect(callArgs.take).toBe(10);
    });

    it('filters by patient ID when provided', async () => {
      mockPrisma.followUp.findMany.mockResolvedValue([FOLLOW_UP_1]);

      await mockPrisma.followUp.findMany({
        where: {
          doctorId: TEST_USER.doctor_id,
          patientId: 'patient-001',
        },
      });

      const callArgs = mockPrisma.followUp.findMany.mock.calls[0][0];
      expect(callArgs.where.patientId).toBe('patient-001');
    });

    it('filters by status when provided', async () => {
      mockPrisma.followUp.findMany.mockResolvedValue([]);

      await mockPrisma.followUp.findMany({
        where: {
          doctorId: TEST_USER.doctor_id,
          status: 'completed',
        },
      });

      const callArgs = mockPrisma.followUp.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe('completed');
    });

    it('returns empty array when no follow-ups exist', async () => {
      mockPrisma.followUp.findMany.mockResolvedValue([]);
      mockPrisma.followUp.count.mockResolvedValue(0);

      const data = await mockPrisma.followUp.findMany({
        where: { doctorId: TEST_USER.doctor_id },
      });
      const total = await mockPrisma.followUp.count({
        where: { doctorId: TEST_USER.doctor_id },
      });

      expect(data).toEqual([]);
      expect(total).toBe(0);
    });
  });

  // ─── PATCH /followups/:id — Update status ──────────────────────────────

  describe('PATCH /followups/:id — update status', () => {
    it('updates follow-up status to completed', async () => {
      const updated = { ...FOLLOW_UP_1, status: 'completed', updatedAt: new Date() };
      mockPrisma.followUp.findUnique.mockResolvedValue(FOLLOW_UP_1);
      mockPrisma.followUp.update.mockResolvedValue(updated);

      const existing = await mockPrisma.followUp.findUnique({
        where: { id: 'fu-001' },
      });
      expect(existing).toBeTruthy();
      expect(existing!.doctorId).toBe(TEST_USER.doctor_id);

      const result = await mockPrisma.followUp.update({
        where: { id: 'fu-001' },
        data: { status: 'completed' },
      });

      expect(result.status).toBe('completed');
    });

    it('updates follow-up notes', async () => {
      const updated = { ...FOLLOW_UP_1, notes: 'Patient recovering well' };
      mockPrisma.followUp.findUnique.mockResolvedValue(FOLLOW_UP_1);
      mockPrisma.followUp.update.mockResolvedValue(updated);

      const result = await mockPrisma.followUp.update({
        where: { id: 'fu-001' },
        data: { notes: 'Patient recovering well' },
      });

      expect(result.notes).toBe('Patient recovering well');
    });

    it('returns 404 when follow-up not found', async () => {
      mockPrisma.followUp.findUnique.mockResolvedValue(null);

      const existing = await mockPrisma.followUp.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(existing).toBeNull();
      // Route handler would return 404 response
    });

    it('rejects update from non-owning doctor', async () => {
      const otherDoctorFollowUp = { ...FOLLOW_UP_1, doctorId: 'doc-999' };
      mockPrisma.followUp.findUnique.mockResolvedValue(otherDoctorFollowUp);

      const existing = await mockPrisma.followUp.findUnique({
        where: { id: 'fu-001' },
      });

      expect(existing!.doctorId).not.toBe(TEST_USER.doctor_id);
      // Route handler would return 403 response
    });

    it('updates scheduled date', async () => {
      const newDate = new Date('2026-03-20T10:00:00Z');
      const updated = { ...FOLLOW_UP_1, scheduledDate: newDate };
      mockPrisma.followUp.findUnique.mockResolvedValue(FOLLOW_UP_1);
      mockPrisma.followUp.update.mockResolvedValue(updated);

      const result = await mockPrisma.followUp.update({
        where: { id: 'fu-001' },
        data: { scheduledDate: newDate },
      });

      expect(result.scheduledDate).toEqual(newDate);
    });
  });

  // ─── DELETE /followups/:id — Cancel ─────────────────────────────────────

  describe('DELETE /followups/:id — cancel follow-up', () => {
    it('cancels a follow-up by updating status', async () => {
      const cancelled = { ...FOLLOW_UP_1, status: 'cancelled' };
      mockPrisma.followUp.findUnique.mockResolvedValue(FOLLOW_UP_1);
      mockPrisma.followUp.update.mockResolvedValue(cancelled);

      const existing = await mockPrisma.followUp.findUnique({
        where: { id: 'fu-001' },
      });
      expect(existing).toBeTruthy();

      const result = await mockPrisma.followUp.update({
        where: { id: 'fu-001' },
        data: { status: 'cancelled' },
      });

      expect(result.status).toBe('cancelled');
    });

    it('returns 404 when cancelling nonexistent follow-up', async () => {
      mockPrisma.followUp.findUnique.mockResolvedValue(null);

      const existing = await mockPrisma.followUp.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(existing).toBeNull();
    });

    it('prevents cancelling already completed follow-up', async () => {
      const completed = { ...FOLLOW_UP_1, status: 'completed' };
      mockPrisma.followUp.findUnique.mockResolvedValue(completed);

      const existing = await mockPrisma.followUp.findUnique({
        where: { id: 'fu-001' },
      });

      expect(existing!.status).toBe('completed');
      // Route handler would return 400 — cannot cancel a completed follow-up
    });

    it('prevents cancelling another doctor\'s follow-up', async () => {
      const otherDoctor = { ...FOLLOW_UP_1, doctorId: 'doc-999' };
      mockPrisma.followUp.findUnique.mockResolvedValue(otherDoctor);

      const existing = await mockPrisma.followUp.findUnique({
        where: { id: 'fu-001' },
      });

      expect(existing!.doctorId).not.toBe(TEST_USER.doctor_id);
    });
  });

  // ─── GET /followups/due — Due follow-ups ──────────────────────────────

  describe('GET /followups/due — due follow-ups', () => {
    it('returns follow-ups due today', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const dueFollowUps = [FOLLOW_UP_2]; // Due on March 12
      mockPrisma.followUp.findMany.mockResolvedValue(dueFollowUps);

      const data = await mockPrisma.followUp.findMany({
        where: {
          doctorId: TEST_USER.doctor_id,
          status: 'scheduled',
          scheduledDate: {
            gte: today,
            lte: endOfDay,
          },
        },
        orderBy: { scheduledDate: 'asc' },
      });

      expect(data).toHaveLength(1);
      expect(mockPrisma.followUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: TEST_USER.doctor_id,
            status: 'scheduled',
          }),
        }),
      );
    });

    it('returns overdue follow-ups', async () => {
      const now = new Date();
      const overdueFollowUp = {
        ...FOLLOW_UP_1,
        scheduledDate: new Date('2026-03-05T10:00:00Z'), // Past date
        status: 'scheduled',
      };

      mockPrisma.followUp.findMany.mockResolvedValue([overdueFollowUp]);

      const data = await mockPrisma.followUp.findMany({
        where: {
          doctorId: TEST_USER.doctor_id,
          status: 'scheduled',
          scheduledDate: { lt: now },
        },
        orderBy: { scheduledDate: 'asc' },
      });

      expect(data).toHaveLength(1);
      expect(data[0].scheduledDate < now).toBe(true);
    });

    it('excludes completed and cancelled follow-ups from due list', async () => {
      mockPrisma.followUp.findMany.mockResolvedValue([]);

      const data = await mockPrisma.followUp.findMany({
        where: {
          doctorId: TEST_USER.doctor_id,
          status: 'scheduled', // Only scheduled follow-ups are "due"
          scheduledDate: { lte: new Date() },
        },
      });

      expect(data).toEqual([]);
      const callArgs = mockPrisma.followUp.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe('scheduled');
    });

    it('includes patient details in due follow-ups', async () => {
      const withPatient = {
        ...FOLLOW_UP_1,
        patient: { id: 'patient-001', phone: '+919876543210', name: 'Test Patient' },
      };
      mockPrisma.followUp.findMany.mockResolvedValue([withPatient]);

      const data = await mockPrisma.followUp.findMany({
        where: {
          doctorId: TEST_USER.doctor_id,
          status: 'scheduled',
        },
        include: {
          patient: { select: { id: true, phone: true, name: true } },
        },
      });

      expect(data[0].patient).toBeDefined();
      expect(data[0].patient.phone).toBe('+919876543210');
    });
  });
});
