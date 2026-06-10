import type { CenterSummary, ProvinceSummary } from '@acc/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@acc/signup-geography-v1';

/** Provinces/centers change rarely; cache on disk to avoid API calls every signup visit. */
export const GEOGRAPHY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface StoredGeography {
  provinces: ProvinceSummary[];
  centersByProvinceId: Record<string, CenterSummary[]>;
  fetchedAt: number;
}

export function isGeographyFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < GEOGRAPHY_CACHE_TTL_MS;
}

export async function readStoredGeography(): Promise<StoredGeography | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredGeography(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeStoredGeography(data: StoredGeography): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isStoredGeography(value: unknown): value is StoredGeography {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.provinces) &&
    typeof record.centersByProvinceId === 'object' &&
    record.centersByProvinceId !== null &&
    typeof record.fetchedAt === 'number'
  );
}
