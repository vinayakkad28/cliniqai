import { vi } from 'vitest';

// Mock Prisma
vi.mock('../src/lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    patient: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    appointment: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    consultation: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    prescription: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    invoice: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    medicine: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    aiInsight: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    otpCode: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    refreshToken: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn((fn: any) => fn({
      patient: { create: vi.fn(), update: vi.fn() },
      prescription: { create: vi.fn() },
      invoice: { create: vi.fn(), update: vi.fn() },
    })),
  },
}));

// Mock queues
vi.mock('../src/lib/queues', () => ({
  smsOtpQueue: { add: vi.fn() },
  smsReminderQueue: { add: vi.fn() },
  whatsappPrescriptionQueue: { add: vi.fn() },
  pushAlertQueue: { add: vi.fn() },
  emailReceiptQueue: { add: vi.fn() },
  documentProcessQueue: { add: vi.fn() },
  clinicalAlertQueue: { add: vi.fn() },
}));

// Mock external clients
vi.mock('../src/lib/aiClient', () => ({
  default: {
    checkDdi: vi.fn().mockResolvedValue({ alerts: [], checked_pairs: 0 }),
    prescriptionAssist: vi.fn().mockResolvedValue({ suggestions: [], warnings: [] }),
    suggestDiagnosis: vi.fn().mockResolvedValue({ differential: [], red_flags: [] }),
    interpretLabResults: vi.fn().mockResolvedValue({ plain_language_summary: 'Normal results' }),
    longitudinalSummary: vi.fn().mockResolvedValue({ summary: 'Patient is healthy' }),
    evaluateClinicalAlert: vi.fn().mockResolvedValue({ hasAlert: false }),
    documentExtract: vi.fn().mockResolvedValue({ extractedData: {}, summary: '' }),
    vectorSearch: vi.fn().mockResolvedValue({ results: [] }),
    explainForPatient: vi.fn().mockResolvedValue({ explanation: '' }),
  },
}));

vi.mock('../src/lib/fhirClient', () => ({
  default: {
    createPatient: vi.fn().mockResolvedValue({ id: 'fhir-patient-1' }),
    getPatient: vi.fn().mockResolvedValue({ id: 'fhir-patient-1', name: [{ given: ['Test'], family: 'Patient' }] }),
    updatePatient: vi.fn().mockResolvedValue({ id: 'fhir-patient-1' }),
    createEncounter: vi.fn().mockResolvedValue({ id: 'fhir-encounter-1' }),
    createMedicationRequest: vi.fn().mockResolvedValue({ id: 'fhir-medrx-1' }),
    createServiceRequest: vi.fn().mockResolvedValue({ id: 'fhir-sr-1' }),
    createDiagnosticReport: vi.fn().mockResolvedValue({ id: 'fhir-dr-1' }),
    createCondition: vi.fn().mockResolvedValue({ id: 'fhir-condition-1' }),
  },
}));

vi.mock('../src/lib/storageClient', () => ({
  getSignedUploadUrl: vi.fn().mockResolvedValue({ url: 'https://mock-upload.test/url', key: 'mock-key' }),
  getSignedReadUrl: vi.fn().mockResolvedValue('https://mock-read.test/url'),
  deleteGcsFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/lib/msg91', () => ({
  sendOtpSms: vi.fn().mockResolvedValue({ type: 'success' }),
  sendSms: vi.fn().mockResolvedValue({ type: 'success' }),
}));

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-tests-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-tests';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.NODE_ENV = 'test';
