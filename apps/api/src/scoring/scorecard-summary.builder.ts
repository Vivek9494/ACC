import {
  computeEconomyRate,
  computeStrikeRate,
  DismissalType,
  formatOversTextFromLegalBalls,
  InningsCloseReason,
  InningsType,
  parseOversTextToLegalBalls,
  type BatterCard,
  type BowlerCard,
  type ExtrasBreakdown,
  type FallOfWicket,
  type InningsScorecard,
  type MatchResultView,
} from '@acc/types';
import type {
  DismissalType as PrismaDismissalType,
  InningsType as PrismaInningsType,
  ScorecardBatterSummary,
  ScorecardBowlerSummary,
  ScorecardFallOfWicket,
  ScorecardInningsSummary,
} from '@prisma/client';

export type ScorecardInningsSummaryWithFigures = ScorecardInningsSummary & {
  batters: ScorecardBatterSummary[];
  bowlers: ScorecardBowlerSummary[];
  fallOfWickets: ScorecardFallOfWicket[];
};

/** Input shape for building an innings card without Prisma row types (tests/fixtures). */
export interface ScorecardSummaryInningsInput {
  id: string;
  sequence: number;
  inningsType: InningsType | PrismaInningsType;
  battingTeamId: string | null;
  bowlingTeamId: string | null;
  battingIsExternal?: boolean;
  bowlingIsExternal?: boolean;
  runs: number;
  wickets: number;
  legalBalls: number;
  oversText: string;
  oversAllotted?: number | null;
  closed?: boolean;
  closeReason?: string | null;
  target?: number | null;
  extrasWides?: number;
  extrasNoBalls?: number;
  extrasByes?: number;
  extrasLegByes?: number;
  extrasPenalties?: number;
  extrasTotal?: number;
  batters: Array<{
    playerId: string;
    runs: number;
    balls: number;
    fours?: number;
    sixes?: number;
    isOut: boolean;
    dismissalType?: DismissalType | PrismaDismissalType | null;
    bowlerId?: string | null;
    fielderId?: string | null;
    fielder2Id?: string | null;
    retiredHurt?: boolean;
    isMankad?: boolean;
    sortOrder?: number;
  }>;
  bowlers: Array<{
    playerId: string;
    legalBalls: number;
    maidens?: number;
    runsConceded: number;
    wickets: number;
    wides?: number;
    noBalls?: number;
    fours?: number;
    sixes?: number;
    dotBalls?: number;
    sortOrder?: number;
  }>;
  fallOfWickets?: Array<{
    wicketNumber: number;
    playerId: string;
    teamRuns: number;
    oversText: string;
  }>;
}

function extrasFromSummary(row: ScorecardSummaryInningsInput): ExtrasBreakdown {
  const wides = row.extrasWides ?? 0;
  const noBalls = row.extrasNoBalls ?? 0;
  const byes = row.extrasByes ?? 0;
  const legByes = row.extrasLegByes ?? 0;
  const penalties = row.extrasPenalties ?? 0;
  const total =
    row.extrasTotal ?? wides + noBalls + byes + legByes + penalties;
  return { wides, noBalls, byes, legByes, penalties, total };
}

function toBatterCard(
  row: ScorecardSummaryInningsInput['batters'][number],
): BatterCard {
  return {
    playerId: row.playerId,
    runs: row.runs,
    balls: row.balls,
    ones: 0,
    twos: 0,
    threes: 0,
    fours: row.fours ?? 0,
    sixes: row.sixes ?? 0,
    strikeRate: computeStrikeRate(row.runs, row.balls) ?? 0,
    isOut: row.isOut,
    dismissalType: (row.dismissalType as DismissalType | null | undefined) ?? null,
    bowlerId: row.bowlerId ?? null,
    fielderId: row.fielderId ?? null,
    fielder2Id: row.fielder2Id ?? null,
    retiredHurt: row.retiredHurt ?? false,
    isMankad: row.isMankad ?? false,
  };
}

function toBowlerCard(
  row: ScorecardSummaryInningsInput['bowlers'][number],
): BowlerCard {
  const legalBalls = row.legalBalls;
  return {
    playerId: row.playerId,
    legalBalls,
    oversText: formatOversTextFromLegalBalls(legalBalls),
    runsConceded: row.runsConceded,
    wickets: row.wickets,
    maidens: row.maidens ?? 0,
    dotBalls: row.dotBalls ?? 0,
    wides: row.wides ?? 0,
    noBalls: row.noBalls ?? 0,
    fours: row.fours ?? 0,
    sixes: row.sixes ?? 0,
    economy: computeEconomyRate(row.runsConceded, legalBalls) ?? 0,
  };
}

function toFallOfWicket(
  row: NonNullable<ScorecardSummaryInningsInput['fallOfWickets']>[number],
): FallOfWicket {
  return {
    wicketNumber: row.wicketNumber,
    playerId: row.playerId,
    teamRuns: row.teamRuns,
    oversText: row.oversText,
  };
}

function normalizeCloseReason(
  value: string | null | undefined,
): InningsCloseReason | null {
  if (!value) {
    return null;
  }
  const allowed = Object.values(InningsCloseReason) as string[];
  return allowed.includes(value) ? (value as InningsCloseReason) : null;
}

/** Build one {@link InningsScorecard} from summary figures (no Delivery fold). */
export function buildInningsScorecardFromSummary(
  row: ScorecardSummaryInningsInput,
): InningsScorecard {
  const legalBalls =
    row.legalBalls > 0 ? row.legalBalls : parseOversTextToLegalBalls(row.oversText);
  const oversText =
    row.oversText.trim().length > 0
      ? row.oversText
      : formatOversTextFromLegalBalls(legalBalls);

  const batters = [...row.batters]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(toBatterCard);
  const bowlers = [...row.bowlers]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(toBowlerCard);
  const fallOfWickets = [...(row.fallOfWickets ?? [])]
    .sort((a, b) => a.wicketNumber - b.wicketNumber)
    .map(toFallOfWicket);

  return {
    inningsId: row.id,
    sequence: row.sequence,
    inningsType: row.inningsType as InningsType,
    battingTeamId: row.battingTeamId,
    bowlingTeamId: row.bowlingTeamId,
    runs: row.runs,
    wickets: row.wickets,
    legalBalls,
    oversText,
    oversAllotted: row.oversAllotted ?? null,
    extras: extrasFromSummary(row),
    batters,
    bowlers,
    fallOfWickets,
    recentOvers: [],
    timeline: [],
    partnership: null,
    partnerships: [],
    currentStrikerId: null,
    currentNonStrikerId: null,
    currentBowlerId: null,
    freeHitNext: false,
    closed: row.closed ?? true,
    closeReason: normalizeCloseReason(row.closeReason),
    target: row.target ?? null,
    droppedCatches: [],
    droppedCatchEvents: [],
    battingIsExternal: row.battingIsExternal ?? false,
    bowlingIsExternal: row.bowlingIsExternal ?? false,
  };
}

export function prismaSummaryToInput(
  row: ScorecardInningsSummaryWithFigures,
): ScorecardSummaryInningsInput {
  return {
    id: row.id,
    sequence: row.sequence,
    inningsType: row.inningsType,
    battingTeamId: row.battingTeamId,
    bowlingTeamId: row.bowlingTeamId,
    battingIsExternal: row.battingIsExternal,
    bowlingIsExternal: row.bowlingIsExternal,
    runs: row.runs,
    wickets: row.wickets,
    legalBalls: row.legalBalls,
    oversText: row.oversText,
    oversAllotted: row.oversAllotted,
    closed: row.closed,
    closeReason: row.closeReason,
    target: row.target,
    extrasWides: row.extrasWides,
    extrasNoBalls: row.extrasNoBalls,
    extrasByes: row.extrasByes,
    extrasLegByes: row.extrasLegByes,
    extrasPenalties: row.extrasPenalties,
    extrasTotal: row.extrasTotal,
    batters: row.batters.map((batter) => ({
      playerId: batter.playerId,
      runs: batter.runs,
      balls: batter.balls,
      fours: batter.fours,
      sixes: batter.sixes,
      isOut: batter.isOut,
      dismissalType: batter.dismissalType,
      bowlerId: batter.bowlerId,
      fielderId: batter.fielderId,
      fielder2Id: batter.fielder2Id,
      retiredHurt: batter.retiredHurt,
      isMankad: batter.isMankad,
      sortOrder: batter.sortOrder,
    })),
    bowlers: row.bowlers.map((bowler) => ({
      playerId: bowler.playerId,
      legalBalls: bowler.legalBalls,
      maidens: bowler.maidens,
      runsConceded: bowler.runsConceded,
      wickets: bowler.wickets,
      wides: bowler.wides,
      noBalls: bowler.noBalls,
      fours: bowler.fours,
      sixes: bowler.sixes,
      dotBalls: bowler.dotBalls,
      sortOrder: bowler.sortOrder,
    })),
    fallOfWickets: row.fallOfWickets.map((fow) => ({
      wicketNumber: fow.wicketNumber,
      playerId: fow.playerId,
      teamRuns: fow.teamRuns,
      oversText: fow.oversText,
    })),
  };
}

/**
 * Prefer persisted Match outcome fields over derived margins when the Admin
 * explicitly set a winner / no-result / note on a scorecard-only backfill.
 */
export function mergeScorecardOnlyResult(
  derived: MatchResultView,
  match: {
    winningTeamId: string | null;
    isNoResult: boolean;
    resultNote: string | null;
  },
): MatchResultView {
  return {
    ...derived,
    isNoResult: match.isNoResult || derived.isNoResult,
    winningTeamId: match.winningTeamId ?? derived.winningTeamId,
    decided: match.isNoResult || match.winningTeamId != null || derived.decided,
    note: match.resultNote ?? derived.note,
  };
}
