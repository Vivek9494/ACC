/**
 * APL knockout seeding & byes — read-only contracts (Phase 2).
 */

import type { QualificationType, QualifiedTeam } from './knockout-qualification';
import type {
  KnockoutQualificationNotApplicable,
  KnockoutQualificationNotConfigured,
  KnockoutQualificationNotReady,
} from './knockout-qualification';

export const KnockoutSeedingOrder = {
  /** GROUP_TOPPERs above WILDCARDs — matches Phase 1 output order (default). */
  TopperThenWildcard: 'TOPPER_THEN_WILDCARD',
  /** All N ranked flat by points → NRR regardless of qualification type. */
  FlatStandings: 'FLAT_STANDINGS',
} as const;

export type KnockoutSeedingOrder =
  (typeof KnockoutSeedingOrder)[keyof typeof KnockoutSeedingOrder];

export const KnockoutRound2SlotSide = {
  Home: 'HOME',
  Away: 'AWAY',
} as const;

export type KnockoutRound2SlotSide =
  (typeof KnockoutRound2SlotSide)[keyof typeof KnockoutRound2SlotSide];

/** Smallest power of two >= n (n >= 1). */
export function nextPowerOfTwo(n: number): number {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`nextPowerOfTwo requires a positive integer, got ${n}`);
  }
  let value = 1;
  while (value < n) {
    value <<= 1;
  }
  return value;
}

export interface KnockoutSeedAssignment {
  seed: number;
  teamId: string;
  teamName: string;
  qualificationType: QualificationType;
  hasBye: boolean;
  /** 1-based leaf position in the full bracketSize tree. */
  bracketSlot: number;
  /** Round 1 for play-in teams; round 2 for bye teams. */
  entersAtRound: 1 | 2;
}

export interface KnockoutRound1Match {
  /** 0-based index within the round-1 layer of the full bracketSize tree. */
  bracketPosition: number;
  higherSeed: number;
  lowerSeed: number;
  higherSeedTeamId: string;
  lowerSeedTeamId: string;
  /** Round-2 match slot this winner feeds (0-based). */
  feedsRound2Slot: number;
}

export interface KnockoutByeTeam {
  seed: number;
  teamId: string;
  teamName: string;
  bracketSlot: number;
  feedsRound2Slot: number;
  round2SlotSide: KnockoutRound2SlotSide;
}

export interface KnockoutSeedingResult {
  knockoutTeamCount: number;
  bracketSize: number;
  byeCount: number;
  seeds: KnockoutSeedAssignment[];
  round1Matches: KnockoutRound1Match[];
  byeTeams: KnockoutByeTeam[];
}

export type KnockoutSeedingReady = {
  status: 'READY';
  seeding: KnockoutSeedingResult;
};

export type KnockoutSeedingResponse =
  | KnockoutQualificationNotApplicable
  | KnockoutQualificationNotConfigured
  | KnockoutQualificationNotReady
  | KnockoutSeedingReady;

export type { QualifiedTeam };

export * from './knockout-seeding.compute';
export * from './knockout-manual-seed';
