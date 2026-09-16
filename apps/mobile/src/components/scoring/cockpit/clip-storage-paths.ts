/**
 * Match-folder stamp + clip rename context for ASC Broadcast nested storage.
 * Stamp must be stable per match (schedule datetime — never Date.now()).
 */

import type { MatchDetail, ScorecardResponse } from '@acc/types';

/** Payload Electron needs to relocate an OBS replay into the nested tree. */
export type BoundaryClipSavePayload = {
  deliveryId: string;
  matchId: string;
  /** YYYYMMDD-HHMMSS from match startTime / matchDate. */
  matchFolderStamp: string;
  battingTeamId: string | null;
  overNumber: number | null;
  ballNumber: number | null;
  sequence: number | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Stable folder datetime: prefer startTime, else matchDate (UTC components).
 * Format YYYYMMDD-HHMMSS — filesystem-safe, no colons.
 */
export function formatMatchFolderStamp(
  match: Pick<MatchDetail, 'startTime' | 'matchDate'> | null | undefined,
): string {
  const start = match?.startTime?.trim() || null;
  const dateOnly = match?.matchDate?.trim() || null;

  if (start) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) {
      return (
        `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
        `-${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`
      );
    }
  }

  if (dateOnly) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOnly);
    if (m) {
      return `${m[1]}${m[2]}${m[3]}-000000`;
    }
    const d = new Date(dateOnly);
    if (!Number.isNaN(d.getTime())) {
      return (
        `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
        `-000000`
      );
    }
  }

  return '00000000-000000';
}

/** Resolve rename context for the delivery just attached to a clip. */
export function resolveBoundaryClipSavePayload(opts: {
  matchId: string;
  match: Pick<MatchDetail, 'startTime' | 'matchDate'> | null | undefined;
  card: ScorecardResponse;
  deliveryId: string;
}): BoundaryClipSavePayload | null {
  const deliveryId = opts.deliveryId.trim();
  const matchId = opts.matchId.trim();
  if (!deliveryId || !matchId) {
    return null;
  }

  for (const innings of opts.card.innings) {
    for (const entry of innings.timeline) {
      if (entry.deliveryId !== deliveryId) {
        continue;
      }
      return {
        deliveryId,
        matchId,
        matchFolderStamp: formatMatchFolderStamp(opts.match),
        battingTeamId: innings.battingTeamId?.trim() || null,
        overNumber: entry.overNumber,
        ballNumber: entry.ballNumber,
        sequence: entry.sequence,
      };
    }
  }

  // Delivery not found on timeline — still save under match/external with seq fallback.
  const live = opts.card.innings.at(-1);
  return {
    deliveryId,
    matchId,
    matchFolderStamp: formatMatchFolderStamp(opts.match),
    battingTeamId: live?.battingTeamId?.trim() || null,
    overNumber: null,
    ballNumber: null,
    sequence: null,
  };
}
