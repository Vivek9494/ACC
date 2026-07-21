import { BallType, CitySelection, TournamentType } from './rbac';

export const KNOCKOUT_TEAM_COUNT_MESSAGES = {
  required: 'Select knockout team count',
  odd: 'Knockout team count must be an even number',
  belowGroupFloor: (min: number) =>
    `Must be at least ${min} to include all group toppers`,
  aboveTotalTeams: (max: number) => `Cannot exceed ${max} teams`,
  notApl: 'Knockout team count applies to APL tournaments only',
  prerequisites: 'Set groups and teams first',
  locked: 'Locked — delete the bracket to change knockout size',
} as const;

/** Smallest even integer >= n (n >= 1). */
export function evenCeil(n: number): number {
  if (n <= 0) {
    return 2;
  }
  return n % 2 === 0 ? n : n + 1;
}

export function isAplTournamentType(type: TournamentType): boolean {
  return type === TournamentType.APL;
}

/** Client-side create-form gate before the server persists type. */
export function resolvesToAplOnCreate(
  ballType: BallType | null,
  citySelection: CitySelection | null,
): boolean {
  return ballType === BallType.Tennis && citySelection === CitySelection.Apl;
}

export function canConfigureKnockoutTeamCount(
  groupCount: number,
  totalTeams: number,
): boolean {
  if (groupCount <= 0 || totalTeams <= 0) {
    return false;
  }
  return evenCeil(groupCount) <= totalTeams;
}

export interface KnockoutTeamCountOption {
  value: string;
  label: string;
}

export function buildKnockoutTeamCountOptions(
  groupCount: number,
  totalTeams: number,
): KnockoutTeamCountOption[] {
  if (!canConfigureKnockoutTeamCount(groupCount, totalTeams)) {
    return [];
  }
  const min = evenCeil(groupCount);
  const options: KnockoutTeamCountOption[] = [];
  for (let n = min; n <= totalTeams; n += 2) {
    options.push({ value: String(n), label: String(n) });
  }
  return options;
}

export function validateKnockoutTeamCount(
  value: number | null | undefined,
  params: {
    groupCount: number;
    totalTeams: number;
  },
): string | null {
  if (value == null) {
    return null;
  }

  if (!Number.isInteger(value) || value <= 0) {
    return KNOCKOUT_TEAM_COUNT_MESSAGES.required;
  }

  if (value % 2 !== 0) {
    return KNOCKOUT_TEAM_COUNT_MESSAGES.odd;
  }

  if (!canConfigureKnockoutTeamCount(params.groupCount, params.totalTeams)) {
    return KNOCKOUT_TEAM_COUNT_MESSAGES.prerequisites;
  }

  const min = evenCeil(params.groupCount);
  if (value < min) {
    return KNOCKOUT_TEAM_COUNT_MESSAGES.belowGroupFloor(min);
  }

  if (value > params.totalTeams) {
    return KNOCKOUT_TEAM_COUNT_MESSAGES.aboveTotalTeams(params.totalTeams);
  }

  return null;
}

/** @deprecated Use {@link tournamentHasKnockoutBracketFromFlag} with server-provided flag. */
export function tournamentHasKnockoutBracket(_tournamentId: string): boolean {
  return false;
}
