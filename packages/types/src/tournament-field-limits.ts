import { PLAYING_XI_SIZE } from './match';

/** Sensible bounds for Add Tournament §6.1 numeric fields. */
export const TOURNAMENT_FIELD_LIMITS = {
  numberOfTeams: { min: 2, max: 30 },
  playersPerTeam: { max: 30 },
  substitutesAllowed: { min: 0, max: 11 },
} as const;

/** §9.7 default when the form loads. */
export const DEFAULT_SUBSTITUTES_ALLOWED = 2;

/** Playing XI size is fixed at 11 per spec; squad size is configured separately. */
export const DEFAULT_PLAYERS_PER_TEAM = 28;

export function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

/** Bounds for overs per innings at match setup (scoring engine dependency). */
export const MATCH_OVERS_PER_INNINGS_LIMITS = { min: 1, max: 50 } as const;

export function validateOversPerInnings(value: string): string | null {
  if (!value.trim()) {
    return 'Overs per innings is required';
  }
  const num = parsePositiveInt(value);
  if (num === null) {
    return 'Enter a valid number of overs';
  }
  const { min, max } = MATCH_OVERS_PER_INNINGS_LIMITS;
  if (num < min || num > max) {
    return `Overs per innings must be between ${min} and ${max}`;
  }
  return null;
}

export function validateNumberOfTeams(value: string | null): string | null {
  if (!value || !value.trim()) {
    return 'Please select the number of teams';
  }
  const num = parsePositiveInt(value);
  if (num === null) {
    return 'Please select the number of teams';
  }
  const { min, max } = TOURNAMENT_FIELD_LIMITS.numberOfTeams;
  if (num < min || num > max) {
    return `Number of teams must be between ${min} and ${max}`;
  }
  return null;
}

export function validatePlayersPerTeam(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const num = parsePositiveInt(value);
  if (num === null) {
    return 'Players per team must be a number';
  }
  if (num > TOURNAMENT_FIELD_LIMITS.playersPerTeam.max) {
    return `Maximum ${TOURNAMENT_FIELD_LIMITS.playersPerTeam.max} players per team`;
  }
  return null;
}

export function validateSubstitutesAllowed(value: string): string | null {
  if (!value.trim()) {
    return 'Substitutes allowed is required';
  }
  const num = parsePositiveInt(value);
  if (num === null) {
    return 'Enter a valid substitute count';
  }
  const { min, max } = TOURNAMENT_FIELD_LIMITS.substitutesAllowed;
  if (num < min || num > max) {
    return `Substitutes allowed must be between ${min} and ${max}`;
  }
  return null;
}

/** Squad must fit Playing XI + substitutes. */
export function validateSquadCapacity(
  playersPerTeam: number,
  substitutesAllowed: number,
): string | null {
  if (playersPerTeam < PLAYING_XI_SIZE + substitutesAllowed) {
    return `Players per team must be at least ${PLAYING_XI_SIZE} (Playing XI) plus substitutes allowed`;
  }
  return null;
}
