import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============= App Store =============

interface AppState {
  // Current context
  currentPatientId: string | null;
  currentConsultationId: string | null;

  // Queue
  queue: QueueItem[];
  queueLoading: boolean;

  // Notifications
  notifications: Notification[];
  unreadCount: number;

  // UI preferences
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';

  // Actions
  setCurrentPatient: (id: string | null) => void;
  setCurrentConsultation: (id: string | null) => void;
  setQueue: (items: QueueItem[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

interface QueueItem {
  id: string;
  tokenNumber: number;
  patientName: string;
  patientId: string;
  type: 'walk-in' | 'scheduled' | 'telemedicine';
  status: 'waiting' | 'in-consultation' | 'completed';
  scheduledAt?: string;
  waitTime?: number;
}

interface Notification {
  id: string;
  type: 'appointment' | 'lab_result' | 'ai_insight' | 'alert' | 'system';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  actionUrl?: string;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentPatientId: null,
      currentConsultationId: null,
      queue: [],
      queueLoading: false,
      notifications: [],
      unreadCount: 0,
      sidebarCollapsed: false,
      theme: 'light',

      // Actions
      setCurrentPatient: (id) => set({ currentPatientId: id }),
      setCurrentConsultation: (id) => set({ currentConsultationId: id }),

      setQueue: (items) => set({ queue: items, queueLoading: false }),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50),
          unreadCount: state.unreadCount + 1,
        })),

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
          unreadCount: Math.max(0, state.unreadCount - 1),
        })),

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'cliniqai-app-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);

// ============= Real-time Connection Store =============

interface RealtimeState {
  connected: boolean;
  lastEvent: string | null;
  setConnected: (connected: boolean) => void;
  setLastEvent: (event: string) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connected: false,
  lastEvent: null,
  setConnected: (connected) => set({ connected }),
  setLastEvent: (event) => set({ lastEvent: event }),
}));
