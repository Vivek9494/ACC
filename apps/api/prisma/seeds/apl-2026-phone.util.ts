import { createHash } from 'node:crypto';

import { normalizeCanadianMobile } from '@acc/types';

import type { Apl2026SeedPlayer } from './apl-2026.types';

/** Normalize export phone values to E.164 (+1 + 10-digit NANP). */
export function normalizeSeedPhone(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === '') {
    return null;
  }
  try {
    return normalizeCanadianMobile(raw.trim());
  } catch {
    return null;
  }
}

/**
 * Deterministic NANP fiction-range sentinel for null-phone export players.
 * Uses 555-010-XXXX (12-char E.164) so login accepts the last 10 digits.
 */
export function sentinelPhoneFromSourceId(sourceId: string): string {
  const digest = createHash('sha256').update(`apl2026:${sourceId}`).digest();
  const numeric = digest.readUInt32BE(0) % 10_000;
  return normalizeCanadianMobile(`555010${String(numeric).padStart(4, '0')}`);
}

/** Canonical mobile for a normalized seed player row. */
export function resolvePlayerMobile(player: Apl2026SeedPlayer): string {
  if (player.phoneIsSentinel) {
    return sentinelPhoneFromSourceId(player.sourceId);
  }
  const normalized = normalizeSeedPhone(player.phone);
  if (!normalized) {
    throw new Error(`Invalid phone for seed player ${player.sourceId} (${player.name})`);
  }
  return normalized;
}

/** Best-effort repair for legacy seed rows stored before phone normalization. */
export function tryRepairLegacyMobile(stored: string): string | null {
  if (stored.length === 12 && stored.startsWith('+1')) {
    return stored;
  }
  const digits = stored.replace(/\D/g, '');
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    try {
      return normalizeCanadianMobile(digits);
    } catch {
      return null;
    }
  }
  return null;
}
