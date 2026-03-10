// CliniqAI Service Worker
const CACHE_VERSION = 'cliniqai-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const OFFLINE_URL = '/offline.html';

// App shell routes to precache
const APP_SHELL = [
  '/dashboard',
  '/login',
  OFFLINE_URL,
];

// Static asset patterns to cache
const STATIC_ASSET_PATTERNS = [
  /\.js$/,
  /\.css$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.svg$/,
  /\.ico$/,
  /\.woff2?$/,
  /\.ttf$/,
];

// API patterns for network-first caching
const API_PATTERNS = [
  /\/api\//,
];

// Background sync queue name
const SYNC_QUEUE = 'cliniqai-offline-queue';

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[CliniqAI SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[CliniqAI SW] Precaching app shell');
      return cache.addAll(APP_SHELL);
    })
  );
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  console.log('[CliniqAI SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('cliniqai-') && name !== STATIC_CACHE && name !== DATA_CACHE)
          .map((name) => {
            console.log('[CliniqAI SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ─── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST/PUT/DELETE go through background sync)
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests: Network-first strategy
  if (API_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets: Cache-first strategy
  if (STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Navigation requests: Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
    return;
  }

  // Default: Network-first
  event.respondWith(networkFirstStrategy(request));
});

// ─── Strategies ─────────────────────────────────────────────────────────────

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[CliniqAI SW] Cache-first fetch failed:', error);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DATA_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function navigationStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Try returning cached version of the page
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Fall back to offline page
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) {
      return offlinePage;
    }
    return new Response('Offline', { status: 503 });
  }
}

// ─── Background Sync ────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_QUEUE) {
    console.log('[CliniqAI SW] Processing background sync queue');
    event.waitUntil(processOfflineQueue());
  }
});

async function processOfflineQueue() {
  try {
    const cache = await caches.open(DATA_CACHE);
    const queueData = await cache.match('/__offline_queue');

    if (!queueData) return;

    const queue = await queueData.json();
    const remaining = [];

    for (const entry of queue) {
      try {
        const response = await fetch(entry.url, {
          method: entry.method,
          headers: entry.headers,
          body: entry.body ? JSON.stringify(entry.body) : undefined,
        });

        if (!response.ok) {
          remaining.push(entry);
        } else {
          console.log('[CliniqAI SW] Synced offline entry:', entry.url);
        }
      } catch (error) {
        remaining.push(entry);
      }
    }

    if (remaining.length > 0) {
      await cache.put(
        '/__offline_queue',
        new Response(JSON.stringify(remaining), { headers: { 'Content-Type': 'application/json' } })
      );
    } else {
      await cache.delete('/__offline_queue');
    }

    // Notify clients that sync completed
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        remaining: remaining.length,
      });
    });
  } catch (error) {
    console.error('[CliniqAI SW] Background sync failed:', error);
  }
}

// ─── Message handling ───────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'QUEUE_OFFLINE_REQUEST':
      queueOfflineRequest(payload);
      break;

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_CACHE_STATUS':
      getCacheStatus().then((status) => {
        event.source.postMessage({ type: 'CACHE_STATUS', payload: status });
      });
      break;
  }
});

async function queueOfflineRequest(entry) {
  try {
    const cache = await caches.open(DATA_CACHE);
    const existingData = await cache.match('/__offline_queue');
    const queue = existingData ? await existingData.json() : [];

    queue.push({
      ...entry,
      queuedAt: new Date().toISOString(),
    });

    await cache.put(
      '/__offline_queue',
      new Response(JSON.stringify(queue), { headers: { 'Content-Type': 'application/json' } })
    );

    // Request background sync if available
    if (self.registration && self.registration.sync) {
      await self.registration.sync.register(SYNC_QUEUE);
    }

    console.log('[CliniqAI SW] Queued offline request:', entry.url);
  } catch (error) {
    console.error('[CliniqAI SW] Failed to queue offline request:', error);
  }
}

async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    status[name] = keys.length;
  }
  return status;
}
