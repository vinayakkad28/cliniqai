/** Socket.io event constants and typed payloads */

export const SOCKET_EVENTS = {
  APPOINTMENT_QUEUE_UPDATED: "appointment:queue:updated",
  APPOINTMENT_STATUS_CHANGED: "appointment:status:changed",
  CONSULTATION_STATUS_CHANGED: "consultation:status:changed",
  ALERT_CLINICAL: "alert:clinical",
  DOCUMENT_PROCESSING_STATUS: "document:processing:status",
} as const;

export interface AppointmentQueuePayload {
  appointmentId: string;
  status: string;
  tokenNumber?: number;
  patientId: string;
}

export interface AppointmentStatusPayload {
  appointmentId: string;
  oldStatus: string;
  newStatus: string;
  patientId: string;
}

export interface ConsultationStatusPayload {
  consultationId: string;
  status: string;
  patientId: string;
}

export interface ClinicalAlertPayload {
  alertId: string;
  patientId: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
}

export interface DocumentProcessingPayload {
  documentId: string;
  status: "started" | "extracting" | "embedding" | "complete" | "failed";
  progress?: number;
}
