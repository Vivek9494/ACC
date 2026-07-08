import { MatchSide } from './match';
import { QualificationType, type QualifiedTeam } from './knockout-qualification';
import { computeKnockoutSeeding } from './knockout-seeding.compute';
import {
  buildKnockoutBracketPlan,
  type PlannedKnockoutMatch,
} from './knockout-bracket-plan';
import {
  KnockoutManualSeedOrderError,
  validateManualSeedOrder,
} from './knockout-manual-seed';

/** Sentinel teamId used to derive the fillable bracket skeleton (seed 1..N). */
const SEED_SENTINEL_PREFIX = '__manual_seed__:';

function seedSentinelTeamId(seed: number): string {
  return `${SEED_SENTINEL_PREFIX}${seed}`;
}

function parseSeedSentinel(teamId: string | null): number | null {
  if (teamId == null || !teamId.startsWith(SEED_SENTINEL_PREFIX)) {
    return null;
  }
  const seed = Number.parseInt(teamId.slice(SEED_SENTINEL_PREFIX.length), 10);
  return Number.isInteger(seed) ? seed : null;
}

function seedSentinelTeams(knockoutTeamCount: number): QualifiedTeam[] {
  return Array.from({ length: knockoutTeamCount }, (_, index) => {
    const seed = index + 1;
    return {
      teamId: seedSentinelTeamId(seed),
      teamName: `Seed ${seed}`,
      qualificationType: QualificationType.GroupTopper,
      groupId: `__manual_group__:${seed}`,
      groupRank: 1,
      points: knockoutTeamCount - index,
      netRunRate: 0,
    } satisfies QualifiedTeam;
  });
}

export const KnockoutManualSlotKind = {
  /** Interactive — the CM taps to place a qualified team into this seed. */
  Seed: 'SEED',
  /** Display-only — a winner from an earlier match feeds here. */
  WinnerOf: 'WINNER_OF',
} as const;

export type KnockoutManualSlotKind =
  (typeof KnockoutManualSlotKind)[keyof typeof KnockoutManualSlotKind];

export interface KnockoutManualSlot {
  kind: KnockoutManualSlotKind;
  side: MatchSide;
  /** 1-based seed this slot represents — only when kind is SEED. */
  seed: number | null;
  /** True when the seed receives a bye (enters directly at its later round). */
  isBye: boolean;
  /** e.g. "Winner of Pre Quarter Final · Match 2" — only when kind is WINNER_OF. */
  feederLabel: string | null;
}

export interface KnockoutManualMatch {
  key: string;
  bracketRoundIndex: number;
  bracketPosition: number;
  roundLabel: string;
  homeSlot: KnockoutManualSlot;
  awaySlot: KnockoutManualSlot;
  /** True when at least one slot is a fillable SEED slot. */
  hasFillableSlot: boolean;
}

export interface KnockoutManualRound {
  bracketRoundIndex: number;
  roundLabel: string;
  matches: KnockoutManualMatch[];
  /** True when any match in this round has a fillable SEED slot. */
  hasFillableSlot: boolean;
}

export interface KnockoutManualBracketLayout {
  knockoutTeamCount: number;
  bracketSize: number;
  byeCount: number;
  /** Total interactive SEED slots — always equals knockoutTeamCount. */
  fillableSlotCount: number;
  /** Ordered earliest round first (left→right); Final last. */
  rounds: KnockoutManualRound[];
  /** Seeds that receive a bye (enter at their later round), ascending. */
  byeSeeds: number[];
}

function matchKey(roundIndex: number, position: number): string {
  return `${roundIndex}:${position}`;
}

function feederKey(matchId: string, slot: MatchSide): string {
  return `${matchId}:${slot}`;
}

function buildFeederLabelMap(
  plan: readonly PlannedKnockoutMatch[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of plan) {
    if (match.nextMatchKey == null || match.nextMatchSlot == null) {
      continue;
    }
    const label = `Winner of ${match.bracketRoundLabel} · Match ${match.bracketPosition + 1}`;
    map.set(feederKey(match.nextMatchKey, match.nextMatchSlot), label);
  }
  return map;
}

function buildSlot(
  teamId: string | null,
  side: MatchSide,
  match: PlannedKnockoutMatch,
  byeSeedSet: ReadonlySet<number>,
  feeders: Map<string, string>,
): KnockoutManualSlot {
  const seed = parseSeedSentinel(teamId);
  if (seed != null) {
    return {
      kind: KnockoutManualSlotKind.Seed,
      side,
      seed,
      isBye: byeSeedSet.has(seed),
      feederLabel: null,
    };
  }
  return {
    kind: KnockoutManualSlotKind.WinnerOf,
    side,
    seed: null,
    isBye: false,
    feederLabel:
      feeders.get(feederKey(matchKey(match.bracketRoundIndex, match.bracketPosition), side)) ??
      'Winner TBD',
  };
}

/**
 * Builds the fillable bracket skeleton for a knockout of `knockoutTeamCount`
 * teams. Reuses Phase 2 seeding + Phase 3 plan with sentinel seed teams, so the
 * tree the CM fills is identical to what generation produces. SEED slots are
 * interactive (tap to place a team); WINNER_OF slots are display-only.
 */
export function buildKnockoutManualBracketLayout(
  knockoutTeamCount: number,
): KnockoutManualBracketLayout {
  const seeding = computeKnockoutSeeding({
    qualifiedTeams: seedSentinelTeams(knockoutTeamCount),
  });
  const plan = buildKnockoutBracketPlan(seeding);

  const byeSeeds = seeding.seeds
    .filter((seed) => seed.hasBye)
    .map((seed) => seed.seed)
    .sort((a, b) => a - b);
  const byeSeedSet = new Set(byeSeeds);
  const feeders = buildFeederLabelMap(plan);

  const roundMap = new Map<number, KnockoutManualMatch[]>();
  for (const match of plan) {
    const homeSlot = buildSlot(match.homeTeamId, MatchSide.TeamA, match, byeSeedSet, feeders);
    const awaySlot = buildSlot(match.awayTeamId, MatchSide.TeamB, match, byeSeedSet, feeders);
    const hasFillableSlot =
      homeSlot.kind === KnockoutManualSlotKind.Seed ||
      awaySlot.kind === KnockoutManualSlotKind.Seed;

    const entry: KnockoutManualMatch = {
      key: matchKey(match.bracketRoundIndex, match.bracketPosition),
      bracketRoundIndex: match.bracketRoundIndex,
      bracketPosition: match.bracketPosition,
      roundLabel: match.bracketRoundLabel,
      homeSlot,
      awaySlot,
      hasFillableSlot,
    };
    const bucket = roundMap.get(match.bracketRoundIndex) ?? [];
    bucket.push(entry);
    roundMap.set(match.bracketRoundIndex, bucket);
  }

  const rounds: KnockoutManualRound[] = [...roundMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([bracketRoundIndex, matches]) => {
      const sorted = [...matches].sort((a, b) => a.bracketPosition - b.bracketPosition);
      return {
        bracketRoundIndex,
        roundLabel: sorted[0]?.roundLabel ?? `Round ${bracketRoundIndex + 1}`,
        matches: sorted,
        hasFillableSlot: sorted.some((match) => match.hasFillableSlot),
      };
    });

  return {
    knockoutTeamCount,
    bracketSize: seeding.bracketSize,
    byeCount: seeding.byeCount,
    fillableSlotCount: knockoutTeamCount,
    rounds,
    byeSeeds,
  };
}

/**
 * Converts a seed→teamId placement map (from tap-to-fill) into the ordered
 * `teamIds` seed list the generate endpoint expects (index 0 = seed 1).
 * Throws {@link KnockoutManualSeedOrderError} if any seed is unplaced or the
 * placement is not exactly the qualified set.
 */
export function buildTeamIdsFromManualPlacements(
  qualifiedTeams: readonly QualifiedTeam[],
  placementsBySeed: ReadonlyMap<number, string>,
): string[] {
  const knockoutTeamCount = qualifiedTeams.length;
  const teamIds: string[] = [];
  for (let seed = 1; seed <= knockoutTeamCount; seed += 1) {
    const teamId = placementsBySeed.get(seed);
    if (teamId == null) {
      throw new KnockoutManualSeedOrderError(
        'Every bracket slot must be filled before generating',
      );
    }
    teamIds.push(teamId);
  }
  validateManualSeedOrder(qualifiedTeams, teamIds);
  return teamIds;
}
