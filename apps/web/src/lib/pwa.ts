// CliniqAI PWA utilities

/**
 * Register the CliniqAI service worker and handle updates.
 */
export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('CliniqAI SW registered:', reg.scope);

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available - notify user
                dispatchPWAEvent('sw-update-available', { registration: reg });
              }
            });
          });
        })
        .catch((err) => console.error('SW registration failed:', err));

      // Listen for sync completion messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, payload } = event.data || {};
        if (type === 'SYNC_COMPLETE') {
          dispatchPWAEvent('sync-complete', payload);
        }
        if (type === 'CACHE_STATUS') {
          dispatchPWAEvent('cache-status', payload);
        }
      });
    });
  }
}

/**
 * Check if the app is currently installed as a PWA.
 */
export function isPWAInstalled(): boolean {
  // Check display-mode media query (works for standalone / fullscreen)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // iOS Safari: navigator.standalone
  if ((navigator as any).standalone === true) {
    return true;
  }

  // Check if running in a TWA (Trusted Web Activity on Android)
  if (document.referrer.startsWith('android-app://')) {
    return true;
  }

  return false;
}

/**
 * Request notification permission from the user.
 * Returns true if permission was granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('Notification permission was previously denied');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Queue a request for background sync when offline.
 * The service worker will replay it once connectivity is restored.
 */
export async function queueOfflineRequest(entry: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}): Promise<void> {
  const sw = navigator.serviceWorker?.controller;
  if (sw) {
    sw.postMessage({ type: 'QUEUE_OFFLINE_REQUEST', payload: entry });
  }
}

/**
 * Prompt the waiting service worker to skip waiting and take over.
 */
export function applyServiceWorkerUpdate(): void {
  const sw = navigator.serviceWorker?.controller;
  if (sw) {
    sw.postMessage({ type: 'SKIP_WAITING' });
  }
  // Reload once the new SW takes over
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

/**
 * Check current online/offline status and listen for changes.
 */
export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function dispatchPWAEvent(name: string, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(`cliniqai:${name}`, { detail }));
}
