import { vi, beforeAll } from "vitest";

// Mock Prisma client
vi.mock("../lib/prisma.js", () => {
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $transaction: vi.fn().mockImplementation((fns: unknown[]) => Promise.all(fns)),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    doctor: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    patient: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    appointment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    consultation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    prescription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: {}, _count: {} }),
    },
    paymentRecord: {
      create: vi.fn(),
    },
    aiInsight: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    clinic: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    clinicDoctor: {
      findFirst: vi.fn(),
    },
    otpCode: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    medicine: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    inventory: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    dispensing: {
      create: vi.fn(),
    },
    labOrder: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    labResult: {
      create: vi.fn(),
    },
    appointmentQueue: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    workingHours: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  return { prisma: mockPrisma };
});

// Mock FHIR client
vi.mock("../lib/fhirClient.js", () => ({
  fhirClient: {
    createPatient: vi.fn().mockResolvedValue({ id: "fhir-patient-1" }),
    createEncounter: vi.fn().mockResolvedValue({ id: "fhir-encounter-1" }),
    createMedicationRequest: vi.fn().mockResolvedValue({ id: "fhir-med-1" }),
    createServiceRequest: vi.fn().mockResolvedValue({ id: "fhir-sr-1" }),
    createDiagnosticReport: vi.fn().mockResolvedValue({ id: "fhir-dr-1" }),
    createCondition: vi.fn().mockResolvedValue({ id: "fhir-cond-1" }),
    updateEncounter: vi.fn().mockResolvedValue(null),
  },
}));

// Mock AI client
vi.mock("../lib/aiClient.js", () => ({
  aiClient: {
    checkDdi: vi.fn().mockResolvedValue([]),
    prescriptionAssist: vi.fn().mockResolvedValue({ suggestions: [], warnings: [], icd10Codes: [] }),
    suggestDiagnosis: vi.fn().mockResolvedValue({ differential: [], redFlags: [] }),
    interpretLabResults: vi.fn().mockResolvedValue({ plainLanguageSummary: "", abnormalFindings: [], suggestedFollowUp: [] }),
    longitudinalSummary: vi.fn().mockResolvedValue("summary"),
    evaluateClinicalAlert: vi.fn().mockResolvedValue({ hasAlert: false, severity: "low", message: "" }),
    documentExtract: vi.fn().mockResolvedValue({ extractedData: {}, summary: "" }),
    vectorSearch: vi.fn().mockResolvedValue([]),
    explainForPatient: vi.fn().mockResolvedValue("explanation"),
  },
}));

// Mock queues (fire-and-forget)
vi.mock("../lib/queues.js", () => {
  const mockQueue = { add: vi.fn().mockResolvedValue({}) };
  return {
    smsOtpQueue: mockQueue,
    smsReminderQueue: mockQueue,
    whatsappPrescriptionQueue: mockQueue,
    pushAlertQueue: mockQueue,
    emailReceiptQueue: mockQueue,
    documentProcessQueue: mockQueue,
    clinicalAlertQueue: mockQueue,
  };
});

// Mock socket server
vi.mock("../lib/socketServer.js", () => ({
  initSocketServer: vi.fn(),
  getSocketServer: vi.fn().mockReturnValue(null),
  emitToDoctor: vi.fn(),
}));

// Mock storage client
vi.mock("../lib/storageClient.js", () => ({
  storageClient: {
    getSignedUploadUrl: vi.fn().mockResolvedValue("https://storage.example.com/upload"),
    getSignedReadUrl: vi.fn().mockResolvedValue("https://storage.example.com/read"),
  },
}));

// Suppress pino logging during tests
beforeAll(() => {
  vi.mock("../lib/logger.js", () => {
    const noop = () => {};
    const mockLogger = {
      info: noop,
      error: noop,
      warn: noop,
      debug: noop,
      child: () => mockLogger,
    };
    return {
      logger: mockLogger,
      createLogger: () => mockLogger,
    };
  });
});
