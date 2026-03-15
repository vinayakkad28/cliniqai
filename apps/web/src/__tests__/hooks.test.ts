import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Simple in-memory SWR-like cache for testing purposes
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5_000; // 5 seconds

interface SWRResult<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => Promise<void>;
}

/**
 * Minimal useSWR-style hook simulation for unit testing.
 * In production, the app uses the `api` client from `@/lib/api` which wraps
 * fetch with auth headers. Here we test the underlying fetch/cache patterns.
 */
async function useSWR<T>(url: string, fetcher?: (url: string) => Promise<T>): Promise<SWRResult<T>> {
  const fetchFn = fetcher ?? (async (u: string) => {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json() as Promise<T>;
  });

  // Check cache
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { data: cached.data as T, error: undefined, isLoading: false, mutate: async () => { cache.delete(url); } };
  }

  try {
    const data = await fetchFn(url);
    cache.set(url, { data, timestamp: Date.now() });
    return { data, error: undefined, isLoading: false, mutate: async () => { cache.delete(url); } };
  } catch (err) {
    return { data: undefined, error: err as Error, isLoading: false, mutate: async () => { cache.delete(url); } };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSWR — data fetching hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  afterEach(() => {
    cache.clear();
  });

  it('returns loading state initially before fetch resolves', async () => {
    // Simulate a fetch that hangs (never resolves immediately)
    let resolveFetch: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    mockFetch.mockReturnValueOnce(pending);

    // Start the fetch but don't await it — check intermediate state
    const promise = useSWR('/api/patients');

    // The promise is pending because fetch hasn't resolved
    const raceResult = await Promise.race([
      promise.then(() => 'resolved'),
      new Promise((r) => setTimeout(() => r('pending'), 10)),
    ]);
    // The hook should still be waiting for fetch
    expect(raceResult).toBe('pending');

    // Now resolve it
    resolveFetch!(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const result = await promise;
    expect(result.data).toEqual({ data: [] });
    expect(result.isLoading).toBe(false);
  });

  it('returns data after fetch resolves successfully', async () => {
    const mockPatients = {
      data: [
        { id: 'p-1', phone: '+919876543210', createdAt: '2025-01-01' },
        { id: 'p-2', phone: '+919876543211', createdAt: '2025-01-02' },
      ],
      meta: { total: 2, page: 1, limit: 20, pages: 1 },
    };

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockPatients), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const result = await useSWR('/api/patients');

    expect(result.data).toEqual(mockPatients);
    expect(result.error).toBeUndefined();
    expect(result.isLoading).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith('/api/patients');
  });

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    }));

    const result = await useSWR('/api/patients');

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('401');
    expect(result.isLoading).toBe(false);
  });

  it('handles network errors', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await useSWR('/api/appointments');

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.message).toBe('Failed to fetch');
  });

  it('uses cache on subsequent calls within TTL', async () => {
    const mockData = { data: [{ id: 'appt-1', status: 'scheduled' }] };

    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockData), { status: 200 }));

    // First call — hits the network
    const first = await useSWR('/api/appointments');
    expect(first.data).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call — should use cache, no additional fetch
    const second = await useSWR('/api/appointments');
    expect(second.data).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
  });

  it('does not use cache for different URLs', async () => {
    const patientsData = { data: [{ id: 'p-1' }] };
    const apptsData = { data: [{ id: 'a-1' }] };

    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(patientsData), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(apptsData), { status: 200 }));

    const patients = await useSWR('/api/patients');
    const appts = await useSWR('/api/appointments');

    expect(patients.data).toEqual(patientsData);
    expect(appts.data).toEqual(apptsData);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('mutate refetches data by clearing cache', async () => {
    const initialData = { data: [{ id: 'p-1', phone: '+911111111111' }] };
    const updatedData = { data: [{ id: 'p-1', phone: '+911111111111' }, { id: 'p-2', phone: '+912222222222' }] };

    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(initialData), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(updatedData), { status: 200 }));

    // First fetch
    const first = await useSWR('/api/patients');
    expect(first.data).toEqual(initialData);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Mutate (clear cache)
    await first.mutate();

    // Second fetch — should hit network again since cache was cleared
    const second = await useSWR('/api/patients');
    expect(second.data).toEqual(updatedData);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('supports custom fetcher functions', async () => {
    const customFetcher = vi.fn().mockResolvedValue({ custom: true });

    const result = await useSWR('/api/custom', customFetcher);

    expect(result.data).toEqual({ custom: true });
    expect(customFetcher).toHaveBeenCalledWith('/api/custom');
    expect(mockFetch).not.toHaveBeenCalled(); // Global fetch should NOT be called
  });

  it('handles 500 server errors', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
    }));

    const result = await useSWR('/api/consultations');

    expect(result.data).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('500');
  });

  it('handles empty response body', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(null), { status: 200 }));

    const result = await useSWR('/api/empty');
    expect(result.data).toBeNull();
    expect(result.error).toBeUndefined();
  });

  it('caches different endpoints independently', async () => {
    const consultationsData = { data: [], meta: { total: 0 } };
    const billingData = { totalRevenue: 5000, invoiceCount: 10 };

    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify(consultationsData), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(billingData), { status: 200 }));

    await useSWR('/api/consultations');
    await useSWR('/api/billing/revenue');

    // Both should be cached
    expect(cache.size).toBe(2);
    expect(cache.has('/api/consultations')).toBe(true);
    expect(cache.has('/api/billing/revenue')).toBe(true);
  });
});
