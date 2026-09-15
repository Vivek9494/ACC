import type { ScorecardResponse } from '@acc/types';

import { attachDeliveryVideo, getScorecard } from '../../../lib/api';
import type { AscObsBridge, AscObsStatus } from '../../../types/asc-broadcast';

/** Delay after a boundary tap before SaveReplayBuffer (lets the shot finish in the clip). */
export const BOUNDARY_CLIP_SAVE_DELAY_MS = 3_000;

function getObsBridge(): AscObsBridge | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const obs = window.ascBroadcast?.obs;
  if (typeof obs?.saveBoundaryClip !== 'function') {
    return undefined;
  }
  return obs;
}

/** True only inside ASC Broadcast Electron with boundary-clip IPC. */
export function canCaptureBoundaryClips(): boolean {
  return getObsBridge() != null;
}

/** True when the bridge can play a delivery clip on air via OBS. */
export function canPlayBoundaryClips(): boolean {
  const obs = getObsBridge();
  return typeof obs?.playDeliveryClip === 'function';
}

/** Shared Replay-scene lock: Instant Replay (saving/playing) or boundary Play. */
export function isOnAirReplayBusy(status: AscObsStatus | null | undefined): boolean {
  if (!status) {
    return false;
  }
  if (status.isReplaying) {
    return true;
  }
  const phase = status.instantReplayPhase || 'idle';
  return phase !== 'idle';
}

/**
 * Find the deliveryId for the most recent boundary (4/6) on the active innings.
 * Prefer matching runsBat when known.
 */
export function findLatestBoundaryDeliveryId(
  card: ScorecardResponse,
  runsBat?: number,
): string | null {
  const innings = card.innings.at(-1);
  if (!innings) {
    return null;
  }
  for (let i = innings.timeline.length - 1; i >= 0; i -= 1) {
    const entry = innings.timeline[i];
    if (!entry?.isBoundary || !entry.deliveryId) {
      continue;
    }
    if (runsBat != null && entry.runsBat != null && entry.runsBat !== runsBat) {
      continue;
    }
    return entry.deliveryId;
  }
  return null;
}

/**
 * After a successful boundary record: delay, save OBS replay buffer, attach path.
 * No-ops when the OBS bridge is absent (plain Chrome). Failures are warned only —
 * the ball stays "Marked".
 */
export function scheduleBoundaryClipCapture(opts: {
  matchId: string;
  inningsId: string;
  deliveryId: string;
  /** Scorecard version after the boundary was recorded (optimistic concurrency). */
  getExpectedVersion: () => number;
  delayMs?: number;
}): void {
  const bridge = getObsBridge();
  if (!bridge) {
    return;
  }

  const delayMs = opts.delayMs ?? BOUNDARY_CLIP_SAVE_DELAY_MS;
  const { matchId, inningsId, deliveryId, getExpectedVersion } = opts;

  window.setTimeout(() => {
    void (async () => {
      try {
        const { videoPath } = await bridge.saveBoundaryClip(deliveryId);
        try {
          await attachDeliveryVideo(matchId, inningsId, deliveryId, {
            videoPath,
            expectedVersion: getExpectedVersion(),
          });
        } catch {
          // Concurrent scoring may bump version during the 3s delay — retry once.
          const fresh = await getScorecard(matchId);
          await attachDeliveryVideo(matchId, inningsId, deliveryId, {
            videoPath,
            expectedVersion: fresh.version,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[boundary-clip] capture failed for delivery ${deliveryId} — ball stays Marked:`,
          message,
        );
      }
    })();
  }, delayMs);
}
