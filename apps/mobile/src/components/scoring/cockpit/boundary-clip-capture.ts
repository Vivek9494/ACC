import {
  DeliveryType,
  type MatchDetail,
  type RecordDeliveryRequest,
  type ScorecardResponse,
} from '@acc/types';

import { attachDeliveryVideo, getScorecard } from '../../../lib/api';
import type { AscObsBridge, AscObsStatus } from '../../../types/asc-broadcast';
import { resolveBoundaryClipSavePayload } from './clip-storage-paths';

/** Delay after a capture-worthy tap before SaveReplayBuffer (lets the play finish in the clip). */
export const BOUNDARY_CLIP_SAVE_DELAY_MS = 3_000;

/** Body shape used by cockpit `record()` (version filled in at call time). */
export type AutoClipDeliveryBody = Omit<RecordDeliveryRequest, 'expectedVersion'>;

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
 * Capture-worthy once per successful record: 4/6 (incl. nb+4/nb+6), wicket,
 * Catch/Drop. Plain Nb and RetiredHurt do not trigger. Evaluating once per
 * record de-dups overlapping meanings on the same delivery (e.g. caught wicket).
 */
export function isAutoClipWorthy(body: AutoClipDeliveryBody): boolean {
  if (body.type === DeliveryType.CatchDrop) {
    return true;
  }
  if (body.type === DeliveryType.RetiredOut || body.type === DeliveryType.Mankad) {
    return true;
  }
  if (body.dismissal != null) {
    return true;
  }
  const runsBat = body.runsBat ?? 0;
  if (body.isBoundary && (runsBat === 4 || runsBat === 6)) {
    return true;
  }
  return false;
}

/**
 * DeliveryId for the ball just recorded — last timeline row with an id.
 * Append-only scorecard: the successful record is always the newest entry.
 */
export function findLatestAutoClipDeliveryId(card: ScorecardResponse): string | null {
  const innings = card.innings.at(-1);
  if (!innings) {
    return null;
  }
  for (let i = innings.timeline.length - 1; i >= 0; i -= 1) {
    const id = innings.timeline[i]?.deliveryId;
    if (id) {
      return id;
    }
  }
  return null;
}

/**
 * After a successful capture-worthy record: delay, save OBS replay buffer, relocate
 * into nested match/team folder, attach path. No-ops when the OBS bridge is absent.
 */
export function scheduleBoundaryClipCapture(opts: {
  matchId: string;
  match: Pick<MatchDetail, 'startTime' | 'matchDate'> | null | undefined;
  /** Scorecard immediately after the recorded delivery (for over/ball/team). */
  card: ScorecardResponse;
  inningsId: string;
  deliveryId: string;
  /** Scorecard version after the event was recorded (optimistic concurrency). */
  getExpectedVersion: () => number;
  /** Apply attach response so Ball By Ball upgrades to Play without waiting. */
  onAttached?: (card: ScorecardResponse) => void;
  delayMs?: number;
}): void {
  const bridge = getObsBridge();
  if (!bridge) {
    return;
  }

  const delayMs = opts.delayMs ?? BOUNDARY_CLIP_SAVE_DELAY_MS;
  const { matchId, match, card, inningsId, deliveryId, getExpectedVersion, onAttached } =
    opts;

  const savePayload = resolveBoundaryClipSavePayload({
    matchId,
    match,
    card,
    deliveryId,
  });
  if (!savePayload) {
    return;
  }

  window.setTimeout(() => {
    void (async () => {
      try {
        const { videoPath } = await bridge.saveBoundaryClip(savePayload);
        let attached: ScorecardResponse;
        try {
          attached = await attachDeliveryVideo(matchId, inningsId, deliveryId, {
            videoPath,
            expectedVersion: getExpectedVersion(),
          });
        } catch {
          // Concurrent scoring may bump version during the 3s delay — retry once.
          const fresh = await getScorecard(matchId);
          attached = await attachDeliveryVideo(matchId, inningsId, deliveryId, {
            videoPath,
            expectedVersion: fresh.version,
          });
        }
        onAttached?.(attached);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[auto-clip] capture failed for delivery ${deliveryId} — no Play button:`,
          message,
        );
      }
    })();
  }, delayMs);
}
