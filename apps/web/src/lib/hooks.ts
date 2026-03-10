"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  patients,
  appointments,
  consultations,
  billing,
  insights,
  pharmacy,
  type PatientListResponse,
  type Patient,
  type AppointmentListResponse,
  type AiInsight,
} from "@/lib/api";

// ─── In-memory cache ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 30_000; // 30 seconds

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function invalidateCache(key: string): void {
  cache.delete(key);
}

// ─── Generic SWR-like hook ──────────────────────────────────────────────────

type Fetcher<T> = () => Promise<T>;

interface UseSWRReturn<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  mutate: (data?: T | Promise<T>) => Promise<void>;
}

export function useSWR<T>(
  key: string | null,
  fetcher: Fetcher<T>
): UseSWRReturn<T> {
  const [data, setData] = useState<T | undefined>(() =>
    key ? getCached<T>(key) : undefined
  );
  const [error, setError] = useState<Error | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(!data);
  const keyRef = useRef(key);
  const fetcherRef = useRef(fetcher);

  // Keep refs in sync
  keyRef.current = key;
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async () => {
    const currentKey = keyRef.current;
    if (!currentKey) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await fetcherRef.current();
      // Only update if the key hasn't changed during the fetch
      if (keyRef.current === currentKey) {
        setData(result);
        setCache(currentKey, result);
        setLoading(false);
      }
    } catch (err) {
      if (keyRef.current === currentKey) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!key) {
      setData(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }

    const cached = getCached<T>(key);
    if (cached) {
      setData(cached);
      setLoading(false);
    }

    fetchData();
  }, [key, fetchData]);

  const mutate = useCallback(
    async (newData?: T | Promise<T>) => {
      const currentKey = keyRef.current;
      if (!currentKey) return;

      if (newData !== undefined) {
        const resolved = await newData;
        setData(resolved);
        setCache(currentKey, resolved);
      } else {
        // Refetch
        invalidateCache(currentKey);
        await fetchData();
      }
    },
    [fetchData]
  );

  return { data, error, loading, mutate };
}

// ─── Domain hooks ───────────────────────────────────────────────────────────

export function usePatients(params?: {
  search?: string;
  tag?: string;
  page?: number;
  limit?: number;
}) {
  const key = params
    ? `patients:${JSON.stringify(params)}`
    : "patients:{}";

  return useSWR<PatientListResponse>(key, () => patients.list(params));
}

export function usePatient(id: string | null) {
  const key = id ? `patient:${id}` : null;

  return useSWR<Patient & { fhir?: Record<string, unknown> }>(
    key,
    () => patients.get(id!)
  );
}

export function useAppointments(params?: {
  date?: string;
  from?: string;
  to?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const key = params
    ? `appointments:${JSON.stringify(params)}`
    : "appointments:{}";

  return useSWR<AppointmentListResponse>(key, () =>
    appointments.list(params)
  );
}

export function useConsultation(id: string | null) {
  const key = id ? `consultation:${id}` : null;

  return useSWR(key, () => consultations.get(id!));
}

export function useRevenue(params?: { from?: string; to?: string }) {
  const key = params
    ? `revenue:${JSON.stringify(params)}`
    : "revenue:{}";

  return useSWR(key, () => billing.revenue(params));
}

export function useDailyRevenue(days = 30) {
  const key = `dailyRevenue:${days}`;

  return useSWR<{ days: Record<string, number> }>(key, () =>
    billing.dailyRevenue(days)
  );
}

export function useInsights(params: {
  patientId?: string;
  type?: string;
  pending?: boolean;
  page?: number;
  limit?: number;
}) {
  const key = `insights:${JSON.stringify(params)}`;

  return useSWR<{
    data: AiInsight[];
    meta: { total: number; page: number; limit: number; pages: number };
  }>(key, () => insights.list(params));
}

export function useMedicines(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  const key = params
    ? `medicines:${JSON.stringify(params)}`
    : "medicines:{}";

  return useSWR(key, () => pharmacy.listMedicines(params));
}
