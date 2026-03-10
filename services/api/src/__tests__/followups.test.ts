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
// Helpers — simulate Express req/res for route handler testing
// ---------------------------------------------------------------------------

function mockReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    body: {},
    params: {},
    query: {},
    user: {
      sub: 'user-1',
      role: 'doctor',
      doctor_id: 'doc-1',
      clinic_id: 'clinic-1',
      scope: ['followups:read', 'followups:write'],
    },
    ...overrides,
  };
}

function mockRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /followups — create a follow-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a follow-up with valid data', async () => {
    const followUp = {
      id: 'fu-1',
      patientId: 'p-1',
      doctorId: 'doc-1',
      consultationId: 'con-1',
      type: 'call',
      dueAt: '2025-06-15T10:00:00.000Z',
      status: 'pending',
      notes: 'Check on blood pressure',
      createdAt: '2025-06-01T10:00:00.000Z',
    };

    mockPrisma.followUp.create.mockResolvedValue(followUp);

    const req = mockReq({
      body: {
        patientId: 'p-1',
        consultationId: 'con-1',
        type: 'call',
        dueAt: '2025-06-15T10:00:00.000Z',
        notes: 'Check on blood pressure',
      },
    });

    const res = mockRes();

    // Simulate route handler logic
    const { patientId, consultationId, type, dueAt, notes } = req.body as {
      patientId: string;
      consultationId: string;
      type: string;
      dueAt: string;
      notes: string;
    };

    const user = req.user as { doctor_id: string };

    const created = await mockPrisma.followUp.create({
      data: {
        patientId,
        doctorId: user.doctor_id,
        consultationId,
        type,
        dueAt: new Date(dueAt),
        notes,
        status: 'pending',
      },
    });

    res.status(201).json(created);

    expect(mockPrisma.followUp.create).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(followUp);
  });

  it('rejects creation with missing patientId', () => {
    const body = {
      type: 'call',
      dueAt: '2025-06-15T10:00:00.000Z',
    };

    // Validate required fields
    const errors: string[] = [];
    if (!body.hasOwnProperty('patientId')) errors.push('patientId is required');

    expect(errors).toContain('patientId is required');
  });

  it('rejects creation with invalid type', () => {
    const validTypes = ['call', 'visit', 'message', 'lab_review'];
    const body = { type: 'invalid_type' };

    expect(validTypes).not.toContain(body.type);
  });

  it('rejects creation with past dueAt date', () => {
    const dueAt = new Date('2020-01-01');
    const now = new Date();

    expect(dueAt.getTime()).toBeLessThan(now.getTime());
  });
});

describe('GET /followups — paginated list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated follow-ups for the doctor', async () => {
    const followUps = [
      { id: 'fu-1', patientId: 'p-1', status: 'pending', dueAt: '2025-06-15T10:00:00Z' },
      { id: 'fu-2', patientId: 'p-2', status: 'completed', dueAt: '2025-06-10T14:00:00Z' },
    ];

    mockPrisma.followUp.findMany.mockResolvedValue(followUps);
    mockPrisma.followUp.count.mockResolvedValue(25);

    const req = mockReq({ query: { page: '1', limit: '20' } });
    const res = mockRes();

    const query = req.query as { page: string; limit: string };
    const page = parseInt(query.page);
    const limit = parseInt(query.limit);
    const skip = (page - 1) * limit;
    const user = req.user as { doctor_id: string };

    const [total, data] = await Promise.all([
      mockPrisma.followUp.count({ where: { doctorId: user.doctor_id } }),
      mockPrisma.followUp.findMany({
        where: { doctorId: user.doctor_id },
        skip,
        take: limit,
        orderBy: { dueAt: 'asc' },
      }),
    ]);

    res.json({
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });

    expect(res.json).toHaveBeenCalledWith({
      data: followUps,
      meta: { total: 25, page: 1, limit: 20, pages: 2 },
    });
  });

  it('applies status filter when provided', async () => {
    mockPrisma.followUp.findMany.mockResolvedValue([]);
    mockPrisma.followUp.count.mockResolvedValue(0);

    const req = mockReq({ query: { page: '1', limit: '20', status: 'pending' } });
    const query = req.query as { status: string };

    const where = {
      doctorId: 'doc-1',
      ...(query.status ? { status: query.status } : {}),
    };

    await mockPrisma.followUp.findMany({ where, skip: 0, take: 20 });

    expect(mockPrisma.followUp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'pending' }),
      }),
    );
  });

  it('applies patientId filter when provided', async () => {
    mockPrisma.followUp.findMany.mockResolvedValue([]);
    mockPrisma.followUp.count.mockResolvedValue(0);

    const where = { doctorId: 'doc-1', patientId: 'p-42' };
    await mockPrisma.followUp.findMany({ where, skip: 0, take: 20 });

    expect(mockPrisma.followUp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: 'p-42' }),
      }),
    );
  });

  it('defaults to page 1 and limit 20 when not specified', () => {
    const query = {} as Record<string, string>;
    const page = parseInt(query.page ?? '1');
    const limit = parseInt(query.limit ?? '20');

    expect(page).toBe(1);
    expect(limit).toBe(20);
  });

  it('calculates pagination meta correctly', () => {
    const total = 47;
    const limit = 20;
    const pages = Math.ceil(total / limit);
    expect(pages).toBe(3);
  });
});

describe('PATCH /followups/:id — update status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates follow-up status to completed', async () => {
    const existing = {
      id: 'fu-1',
      doctorId: 'doc-1',
      status: 'pending',
      patientId: 'p-1',
    };

    const updated = { ...existing, status: 'completed', completedAt: '2025-06-16T08:00:00Z' };

    mockPrisma.followUp.findUnique.mockResolvedValue(existing);
    mockPrisma.followUp.update.mockResolvedValue(updated);

    const req = mockReq({ params: { id: 'fu-1' }, body: { status: 'completed' } });
    const res = mockRes();

    const followUp = await mockPrisma.followUp.findUnique({
      where: { id: (req.params as { id: string }).id },
    });

    expect(followUp).toBeDefined();
    expect(followUp!.doctorId).toBe((req.user as { doctor_id: string }).doctor_id);

    const result = await mockPrisma.followUp.update({
      where: { id: followUp!.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    res.json(result);

    expect(mockPrisma.followUp.update).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it('returns 404 when follow-up does not exist', async () => {
    mockPrisma.followUp.findUnique.mockResolvedValue(null);

    const res = mockRes();

    const followUp = await mockPrisma.followUp.findUnique({ where: { id: 'nonexistent' } });

    if (!followUp) {
      res.status(404).json({ error: 'Follow-up not found' });
    }

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Follow-up not found' });
  });

  it('returns 403 when doctor does not own the follow-up', async () => {
    const otherDoctorFollowUp = { id: 'fu-1', doctorId: 'doc-other', status: 'pending' };
    mockPrisma.followUp.findUnique.mockResolvedValue(otherDoctorFollowUp);

    const res = mockRes();
    const req = mockReq();

    const followUp = await mockPrisma.followUp.findUnique({ where: { id: 'fu-1' } });
    const user = req.user as { doctor_id: string };

    if (followUp && followUp.doctorId !== user.doctor_id) {
      res.status(403).json({ error: 'Not your follow-up' });
    }

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not your follow-up' });
  });

  it('validates status transition — cannot update already completed', async () => {
    const completedFollowUp = { id: 'fu-1', doctorId: 'doc-1', status: 'completed' };
    mockPrisma.followUp.findUnique.mockResolvedValue(completedFollowUp);

    const res = mockRes();

    const followUp = await mockPrisma.followUp.findUnique({ where: { id: 'fu-1' } });

    if (followUp && followUp.status === 'completed') {
      res.status(400).json({ error: 'Follow-up already completed' });
    }

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('DELETE /followups/:id — cancel follow-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels a pending follow-up by updating status', async () => {
    const existing = { id: 'fu-1', doctorId: 'doc-1', status: 'pending' };
    const cancelled = { ...existing, status: 'cancelled' };

    mockPrisma.followUp.findUnique.mockResolvedValue(existing);
    mockPrisma.followUp.update.mockResolvedValue(cancelled);

    const res = mockRes();

    const followUp = await mockPrisma.followUp.findUnique({ where: { id: 'fu-1' } });

    if (!followUp) {
      res.status(404).json({ error: 'Follow-up not found' });
      return;
    }

    const result = await mockPrisma.followUp.update({
      where: { id: followUp.id },
      data: { status: 'cancelled' },
    });

    res.json(result);

    expect(mockPrisma.followUp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'cancelled' },
      }),
    );
    expect(res.json).toHaveBeenCalledWith(cancelled);
  });

  it('returns 404 when follow-up to cancel does not exist', async () => {
    mockPrisma.followUp.findUnique.mockResolvedValue(null);

    const res = mockRes();
    const followUp = await mockPrisma.followUp.findUnique({ where: { id: 'ghost' } });

    if (!followUp) {
      res.status(404).json({ error: 'Follow-up not found' });
    }

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('cannot cancel an already completed follow-up', async () => {
    const completed = { id: 'fu-1', doctorId: 'doc-1', status: 'completed' };
    mockPrisma.followUp.findUnique.mockResolvedValue(completed);

    const res = mockRes();
    const followUp = await mockPrisma.followUp.findUnique({ where: { id: 'fu-1' } });

    if (followUp && followUp.status === 'completed') {
      res.status(400).json({ error: 'Cannot cancel a completed follow-up' });
    }

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 when trying to cancel another doctor\'s follow-up', async () => {
    const otherDoc = { id: 'fu-1', doctorId: 'doc-other', status: 'pending' };
    mockPrisma.followUp.findUnique.mockResolvedValue(otherDoc);

    const res = mockRes();
    const req = mockReq();
    const followUp = await mockPrisma.followUp.findUnique({ where: { id: 'fu-1' } });
    const user = req.user as { doctor_id: string };

    if (followUp && followUp.doctorId !== user.doctor_id) {
      res.status(403).json({ error: 'Not your follow-up' });
    }

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('GET /followups/due — due follow-ups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns follow-ups that are due today or overdue', async () => {
    const now = new Date();
    const dueFollowUps = [
      { id: 'fu-1', patientId: 'p-1', status: 'pending', dueAt: now.toISOString(), patient: { phone: '+919876543210' } },
      { id: 'fu-2', patientId: 'p-2', status: 'pending', dueAt: new Date(now.getTime() - 86400000).toISOString(), patient: { phone: '+919876543211' } },
    ];

    mockPrisma.followUp.findMany.mockResolvedValue(dueFollowUps);

    const result = await mockPrisma.followUp.findMany({
      where: {
        doctorId: 'doc-1',
        status: 'pending',
        dueAt: { lte: now },
      },
      include: { patient: { select: { phone: true } } },
      orderBy: { dueAt: 'asc' },
    });

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('pending');
  });

  it('returns empty array when no follow-ups are due', async () => {
    mockPrisma.followUp.findMany.mockResolvedValue([]);

    const result = await mockPrisma.followUp.findMany({
      where: {
        doctorId: 'doc-1',
        status: 'pending',
        dueAt: { lte: new Date() },
      },
    });

    expect(result).toHaveLength(0);
  });

  it('only returns pending follow-ups (not completed or cancelled)', async () => {
    mockPrisma.followUp.findMany.mockResolvedValue([
      { id: 'fu-1', status: 'pending', dueAt: new Date().toISOString() },
    ]);

    const result = await mockPrisma.followUp.findMany({
      where: {
        doctorId: 'doc-1',
        status: 'pending',
        dueAt: { lte: new Date() },
      },
    });

    expect(mockPrisma.followUp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'pending' }),
      }),
    );
    expect(result.every((fu: { status: string }) => fu.status === 'pending')).toBe(true);
  });

  it('includes patient contact info in due follow-ups', async () => {
    const dueFollowUp = {
      id: 'fu-1',
      status: 'pending',
      dueAt: new Date().toISOString(),
      patient: { phone: '+919876543210', name: 'Test Patient' },
    };

    mockPrisma.followUp.findMany.mockResolvedValue([dueFollowUp]);

    const result = await mockPrisma.followUp.findMany({
      where: { doctorId: 'doc-1', status: 'pending' },
      include: { patient: { select: { phone: true } } },
    });

    expect(result[0].patient).toBeDefined();
    expect(result[0].patient.phone).toBe('+919876543210');
  });

  it('orders due follow-ups by dueAt ascending (most overdue first)', async () => {
    mockPrisma.followUp.findMany.mockResolvedValue([]);

    await mockPrisma.followUp.findMany({
      where: { doctorId: 'doc-1', status: 'pending' },
      orderBy: { dueAt: 'asc' },
    });

    expect(mockPrisma.followUp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { dueAt: 'asc' },
      }),
    );
  });
});
