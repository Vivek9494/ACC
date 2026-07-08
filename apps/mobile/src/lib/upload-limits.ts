import type { UploadLimits } from '@acc/types';
import { defaultUploadLimits } from '@acc/types';

import { getUploadLimits as fetchUploadLimits } from './api';

let cached: UploadLimits | null = null;
let inflight: Promise<UploadLimits> | null = null;

/** Fetch upload limits from the server (cached until invalidated). */
export async function getUploadLimits(): Promise<UploadLimits> {
  if (cached) {
    return cached;
  }
  if (!inflight) {
    inflight = fetchUploadLimits()
      .then((limits) => {
        cached = limits;
        return limits;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Clear cache after admin updates settings or on explicit refresh. */
export function invalidateUploadLimitsCache(): void {
  cached = null;
  inflight = null;
}

export function videoUploadMaxBytes(limits: UploadLimits = defaultUploadLimits()): number {
  return limits.videoUploadMaxMb * 1024 * 1024;
}

export function imageUploadMaxBytes(limits: UploadLimits = defaultUploadLimits()): number {
  return limits.imageUploadMaxMb * 1024 * 1024;
}
