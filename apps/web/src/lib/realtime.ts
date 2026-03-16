import { useEffect, useRef } from 'react';
import { useAppStore, useRealtimeStore } from './store';

// Socket.io-like event system using Server-Sent Events (SSE)
// (Works without additional dependencies - native browser API)

class RealtimeClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  connect() {
    if (this.eventSource) this.disconnect();

    const url = `${this.baseUrl}/events/stream?token=${encodeURIComponent(this.token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      useRealtimeStore.getState().setConnected(true);
    };

    this.eventSource.onerror = () => {
      useRealtimeStore.getState().setConnected(false);
      this.eventSource?.close();

      // Reconnect with backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };

    // Event handlers
    this.eventSource.addEventListener('queue_update', (event) => {
      const data = JSON.parse(event.data);
      useAppStore.getState().setQueue(data.queue);
      useRealtimeStore.getState().setLastEvent('queue_update');
    });

    this.eventSource.addEventListener('appointment_update', (event) => {
      const data = JSON.parse(event.data);
      useAppStore.getState().addNotification({
        id: `apt-${Date.now()}`,
        type: 'appointment',
        title: 'Appointment Update',
        message: data.message,
        read: false,
        timestamp: new Date().toISOString(),
        actionUrl: `/dashboard/appointments/${data.appointmentId}`,
      });
    });

    this.eventSource.addEventListener('lab_result', (event) => {
      const data = JSON.parse(event.data);
      useAppStore.getState().addNotification({
        id: `lab-${Date.now()}`,
        type: 'lab_result',
        title: 'Lab Results Ready',
        message: `${data.testName} results for ${data.patientName}`,
        read: false,
        timestamp: new Date().toISOString(),
        actionUrl: `/dashboard/patients/${data.patientId}`,
      });
    });

    this.eventSource.addEventListener('ai_insight', (event) => {
      const data = JSON.parse(event.data);
      useAppStore.getState().addNotification({
        id: `ai-${Date.now()}`,
        type: 'ai_insight',
        title: 'AI Insight',
        message: data.message,
        read: false,
        timestamp: new Date().toISOString(),
        actionUrl: data.actionUrl,
      });
    });

    this.eventSource.addEventListener('clinical_alert', (event) => {
      const data = JSON.parse(event.data);
      useAppStore.getState().addNotification({
        id: `alert-${Date.now()}`,
        type: 'alert',
        title: `Clinical Alert: ${data.severity}`,
        message: data.message,
        read: false,
        timestamp: new Date().toISOString(),
        actionUrl: `/dashboard/patients/${data.patientId}`,
      });
    });
  }

  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
    useRealtimeStore.getState().setConnected(false);
  }
}

let client: RealtimeClient | null = null;

export function useRealtime(token: string | null) {
  const clientRef = useRef<RealtimeClient | null>(null);

  useEffect(() => {
    if (!token) return;

    // Use relative /api path in browser (Vercel rewrites to Railway API)
    const baseUrl = typeof window !== "undefined"
      ? "/api"
      : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api';
    clientRef.current = new RealtimeClient(baseUrl, token);
    clientRef.current.connect();
    client = clientRef.current;

    return () => {
      clientRef.current?.disconnect();
      client = null;
    };
  }, [token]);
}

export function getRealtimeClient() {
  return client;
}
