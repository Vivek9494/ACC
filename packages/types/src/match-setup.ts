import { MatchType, MATCH_TYPE_LABELS } from './match';
import { MatchSchedulingFormat } from './match-scheduling-format';

/** Select options for per-match overs at setup (§6.1). */
export const MATCH_OVERS_PER_INNINGS_OPTIONS = [
  { value: 5, label: '5 Overs' },
  { value: 6, label: '6 Overs' },
  { value: 8, label: '8 Overs' },
  { value: 10, label: '10 Overs' },
  { value: 12, label: '12 Overs' },
  { value: 15, label: '15 Overs' },
  { value: 20, label: '20 Overs (T20)' },
  { value: 50, label: '50 Overs (ODI)' },
] as const;

export type MatchOversPerInnings = (typeof MATCH_OVERS_PER_INNINGS_OPTIONS)[number]['value'];

/** Common max-overs-per-bowler presets keyed by innings length. */
export const MATCH_MAX_OVERS_PER_BOWLER_OPTIONS: Record<number, readonly number[]> = {
  5: [1, 2],
  6: [2, 3],
  8: [2, 4],
  10: [2, 3, 5],
  12: [2, 3, 4],
  15: [3, 5],
  20: [4, 5],
  50: [10, 12],
};

export function maxOversPerBowlerOptionsForInnings(oversPerInnings: number): number[] {
  const preset = MATCH_MAX_OVERS_PER_BOWLER_OPTIONS[oversPerInnings];
  if (preset) {
    return [...preset];
  }
  const sensibleMax = Math.max(1, Math.floor(oversPerInnings / 2));
  return [sensibleMax];
}

export function validateMaxOversPerBowler(
  oversPerInnings: number,
  maxOversPerBowler: number,
): string | null {
  if (!Number.isInteger(maxOversPerBowler) || maxOversPerBowler < 1) {
    return 'Overs per bowler must be at least 1';
  }
  if (maxOversPerBowler > oversPerInnings) {
    return 'Overs per bowler cannot exceed total overs';
  }
  return null;
}

/** Powerplay options 0…total overs inclusive (0 = none). */
export function powerplayOversOptionsForInnings(oversPerInnings: number): number[] {
  const total = Math.max(0, Math.floor(oversPerInnings));
  return Array.from({ length: total + 1 }, (_, index) => index);
}

export function validatePowerplayOvers(
  oversPerInnings: number,
  powerplayOvers: number,
): string | null {
  if (!Number.isInteger(powerplayOvers) || powerplayOvers < 0) {
    return 'Powerplay overs must be 0 or greater';
  }
  if (powerplayOvers > oversPerInnings) {
    return 'Powerplay overs cannot exceed total overs';
  }
  return null;
}

export function validateBattingPowerplayOvers(
  oversPerInnings: number,
  battingPowerplayOvers: number,
): string | null {
  if (!Number.isInteger(battingPowerplayOvers) || battingPowerplayOvers < 0) {
    return 'Batting powerplay overs must be 0 or greater';
  }
  if (battingPowerplayOvers > oversPerInnings) {
    return 'Batting powerplay overs cannot exceed total overs';
  }
  return null;
}

/** Reset a powerplay selection when total overs shrinks below the current value. */
export function clampPowerplaySelection(
  value: number | null,
  oversPerInnings: number | null,
): number | null {
  if (value == null || oversPerInnings == null) {
    return value;
  }
  return value > oversPerInnings ? null : value;
}

export const MATCH_SETUP_FORM_MESSAGES = {
  teamA: { required: 'Team A is required' },
  teamB: { required: 'Team B is required' },
  externalOpponentName: { required: 'Enter Team B name' },
  teamsDistinct: { duplicate: 'Team A and Team B must be different teams' },
  duplicatePairing: {
    duplicate: 'These teams are already scheduled to play in this round robin.',
  },
  group: { required: 'Group is required for group-stage fixtures' },
  ground: { required: 'Ground location is required' },
  coordinates: { required: 'Select a location from the map or search results' },
  overs: { required: 'Overs is required' },
  oversPerBowler: { required: 'Overs per bowler is required' },
  powerplayOvers: { exceedsTotal: 'Powerplay overs cannot exceed total overs' },
  battingPowerplayOvers: { exceedsTotal: 'Batting powerplay overs cannot exceed total overs' },
  matchDate: {
    required: 'Match date is required',
    invalid: 'Match date must be one of the tournament match days',
  },
  matchTime: { required: 'Match time is required' },
  matchType: { required: 'Match type is required' },
} as const;

/** Shared Match Type dropdown options (all scheduling variants). */
export const MATCH_TYPE_SELECT_OPTIONS = Object.values(MatchType).map((value) => ({
  value,
  label: MATCH_TYPE_LABELS[value],
}));

/**
 * Initial Match Type when opening match setup.
 * Manual: none (organizer must choose).
 * Round robin: league fixture (changeable — e.g. a final after the table).
 * Group stage: league fixture for intra-group games; knockout bracket scheduling
 * is not a separate flow yet, so organizers pick knockout types manually when
 * scheduling bracket matches (defaults stay League Match).
 */
export function defaultMatchTypeForSchedulingFormat(
  format: MatchSchedulingFormat,
): MatchType | null {
  if (format === MatchSchedulingFormat.Manual) {
    return null;
  }
  if (
    format === MatchSchedulingFormat.RoundRobin ||
    format === MatchSchedulingFormat.GroupStageKnockout
  ) {
    return MatchType.LeagueMatch;
  }
  return null;
}

/** One team's points preview for the round-robin match-setup info card. */
export interface RoundRobinStandingPreview {
  teamId: string;
  teamName: string;
  points: number;
}

/** Context for the round-robin Match Setup screen (match count + standings + pairings). */
export interface RoundRobinMatchSetupContext {
  scheduledMatchCount: number;
  nextMatchNumber: number;
  standings: RoundRobinStandingPreview[];
  /** Sorted `teamId:teamId` keys for fixtures already scheduled in this round robin. */
  existingPairKeys: string[];
}

/** Order-independent key for a two-team fixture (duplicate-pairing guard). */
export function normalizeTeamPairKey(teamAId: string, teamBId: string): string {
  return [teamAId, teamBId].sort().join(':');
}
