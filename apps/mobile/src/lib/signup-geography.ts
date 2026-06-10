import type { CenterSummary, ProvinceSummary } from '@acc/types';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE_URL, describeApiError, getCenters, getProvinces } from './api';
import {
  GEOGRAPHY_CACHE_TTL_MS,
  isGeographyFresh,
  readStoredGeography,
  writeStoredGeography,
} from './geography-cache';

let provinceCache: { data: ProvinceSummary[]; at: number } | null = null;
const centerCache = new Map<string, { data: CenterSummary[]; at: number }>();
let hydratePromise: Promise<void> | null = null;

export type GeographyErrorType = 'network' | 'empty';

export interface GeographyFieldState {
  items: ProvinceSummary[] | CenterSummary[];
  loading: boolean;
  errorType: GeographyErrorType | null;
  errorMessage: string | null;
  retry: () => void;
}

function isMemoryFresh(at: number): boolean {
  return Date.now() - at < GEOGRAPHY_CACHE_TTL_MS;
}

function applyStoredToMemory(stored: {
  provinces: ProvinceSummary[];
  centersByProvinceId: Record<string, CenterSummary[]>;
  fetchedAt: number;
}): void {
  provinceCache = { data: stored.provinces, at: stored.fetchedAt };
  for (const [provinceId, centers] of Object.entries(stored.centersByProvinceId)) {
    centerCache.set(provinceId, { data: centers, at: stored.fetchedAt });
  }
}

async function persistGeography(): Promise<void> {
  if (!provinceCache) {
    return;
  }
  const centersByProvinceId: Record<string, CenterSummary[]> = {};
  for (const [provinceId, entry] of centerCache.entries()) {
    centersByProvinceId[provinceId] = entry.data;
  }
  await writeStoredGeography({
    provinces: provinceCache.data,
    centersByProvinceId,
    fetchedAt: provinceCache.at,
  });
}

async function ensureHydratedFromDisk(): Promise<void> {
  if (hydratePromise) {
    return hydratePromise;
  }
  hydratePromise = (async () => {
    if (provinceCache) {
      return;
    }
    const stored = await readStoredGeography();
    if (stored) {
      applyStoredToMemory(stored);
    }
  })();
  return hydratePromise;
}

async function fetchProvincesFromNetwork(force: boolean): Promise<ProvinceSummary[]> {
  if (!force && provinceCache && isMemoryFresh(provinceCache.at)) {
    return provinceCache.data;
  }
  const data = await getProvinces();
  provinceCache = { data, at: Date.now() };
  await persistGeography();
  return data;
}

async function fetchCentersFromNetwork(provinceId: string, force: boolean): Promise<CenterSummary[]> {
  const cached = centerCache.get(provinceId);
  if (!force && cached && isMemoryFresh(cached.at)) {
    return cached.data;
  }
  const data = await getCenters(provinceId);
  centerCache.set(provinceId, { data, at: Date.now() });
  await persistGeography();
  return data;
}

function networkMessage(resource: 'provinces' | 'centers', err: unknown): string {
  const detail = describeApiError(err);
  if (/timed out|timeout|failed to connect|network request failed|could not connect/i.test(detail)) {
    return `Couldn't reach the API at ${API_BASE_URL}. Run pnpm dev:api and use the same Wi‑Fi as this phone. Test in Safari: ${API_BASE_URL}/health`;
  }
  return `Couldn't load ${resource}. Check your connection and that the API is running.`;
}

function emptyMessage(resource: 'provinces' | 'centers'): string {
  return resource === 'provinces'
    ? 'No provinces available'
    : 'No centers available in this province';
}

/**
 * Loads signup Province/Center lists with disk + memory cache and retry.
 * Avoids hitting the API on every signup visit when cached data is still fresh.
 */
export function useSignupGeography(selectedProvinceId: string | null): {
  provinces: ProvinceSummary[];
  centers: CenterSummary[];
  provinceField: GeographyFieldState;
  centerField: GeographyFieldState;
} {
  const [provinces, setProvinces] = useState<ProvinceSummary[]>([]);
  const [centers, setCenters] = useState<CenterSummary[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [provincesErrorType, setProvincesErrorType] = useState<GeographyErrorType | null>(null);
  const [centersErrorType, setCentersErrorType] = useState<GeographyErrorType | null>(null);
  const [provincesFetchError, setProvincesFetchError] = useState<unknown>(null);
  const [centersFetchError, setCentersFetchError] = useState<unknown>(null);
  const hydratedRef = useRef(false);

  const loadProvinces = useCallback(async (force = false) => {
    await ensureHydratedFromDisk();

    if (!force && provinceCache && isMemoryFresh(provinceCache.at)) {
      setProvinces(provinceCache.data);
      setProvincesErrorType(provinceCache.data.length === 0 ? 'empty' : null);
      setLoadingProvinces(false);
      return;
    }

    setLoadingProvinces(true);
    setProvincesErrorType(null);
    setProvincesFetchError(null);
    try {
      const list = await fetchProvincesFromNetwork(force);
      setProvinces(list);
      if (list.length === 0) {
        setProvincesErrorType('empty');
      }
    } catch (err: unknown) {
      console.error('Failed to load provinces for signup', {
        apiUrl: API_BASE_URL,
        error: describeApiError(err),
      });
      setProvincesFetchError(err);
      setProvincesErrorType('network');
      if (provinceCache?.data.length) {
        setProvinces(provinceCache.data);
      }
    } finally {
      setLoadingProvinces(false);
    }
  }, []);

  const loadCenters = useCallback(async (provinceId: string, force = false) => {
    await ensureHydratedFromDisk();

    const cached = centerCache.get(provinceId);
    if (!force && cached && isMemoryFresh(cached.at)) {
      setCenters(cached.data);
      setCentersErrorType(cached.data.length === 0 ? 'empty' : null);
      setLoadingCenters(false);
      return;
    }

    setLoadingCenters(true);
    setCentersErrorType(null);
    setCentersFetchError(null);
    try {
      const list = await fetchCentersFromNetwork(provinceId, force);
      setCenters(list);
      if (list.length === 0) {
        setCentersErrorType('empty');
      }
    } catch (err: unknown) {
      console.error('Failed to load centers for signup', {
        apiUrl: API_BASE_URL,
        error: describeApiError(err),
      });
      setCentersFetchError(err);
      setCentersErrorType('network');
      if (cached?.data.length) {
        setCenters(cached.data);
      } else {
        setCenters([]);
      }
    } finally {
      setLoadingCenters(false);
    }
  }, []);

  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }
    hydratedRef.current = true;
    void (async () => {
      await ensureHydratedFromDisk();
      if (provinceCache) {
        setProvinces(provinceCache.data);
        setLoadingProvinces(false);
        if (!isGeographyFresh(provinceCache.at)) {
          void loadProvinces(false);
        }
      } else {
        void loadProvinces(false);
      }
    })();
  }, [loadProvinces]);

  useFocusEffect(
    useCallback(() => {
      if (provincesErrorType === 'network') {
        void loadProvinces(false);
      }
    }, [loadProvinces, provincesErrorType]),
  );

  useEffect(() => {
    if (!selectedProvinceId) {
      setCenters([]);
      setCentersErrorType(null);
      setLoadingCenters(false);
      return;
    }
    void loadCenters(selectedProvinceId, false);
  }, [selectedProvinceId, loadCenters]);

  const provincesErrorMessage =
    provincesErrorType === 'network'
      ? networkMessage('provinces', provincesFetchError)
      : provincesErrorType === 'empty'
        ? emptyMessage('provinces')
        : null;

  const centersErrorMessage =
    centersErrorType === 'network'
      ? networkMessage('centers', centersFetchError)
      : centersErrorType === 'empty'
        ? emptyMessage('centers')
        : null;

  return {
    provinces,
    centers,
    provinceField: {
      items: provinces,
      loading: loadingProvinces,
      errorType: provincesErrorType,
      errorMessage: provincesErrorMessage,
      retry: () => {
        void loadProvinces(true);
      },
    },
    centerField: {
      items: centers,
      loading: loadingCenters,
      errorType: centersErrorType,
      errorMessage: centersErrorMessage,
      retry: () => {
        if (selectedProvinceId) {
          void loadCenters(selectedProvinceId, true);
        }
      },
    },
  };
}
