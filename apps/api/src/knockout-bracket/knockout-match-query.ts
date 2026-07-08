import type { Prisma } from '@prisma/client';

/** Active (non-soft-deleted) matches only — default scope for schedules and bracket ops. */
export const ACTIVE_MATCH_WHERE = { isDeleted: false } as const satisfies Prisma.MatchWhereInput;

/** Active knockout bracket matches — excludes soft-deleted ghost rows after bracket delete. */
export const ACTIVE_KNOCKOUT_MATCH_WHERE = {
  ...ACTIVE_MATCH_WHERE,
  bracketId: { not: null },
} as const satisfies Prisma.MatchWhereInput;

export function activeKnockoutMatchesForBracket(
  bracketId: string,
): Prisma.MatchWhereInput {
  return {
    bracketId,
    ...ACTIVE_MATCH_WHERE,
  };
}

export function activeKnockoutMatchesForTournament(
  tournamentId: string,
): Prisma.MatchWhereInput {
  return {
    tournamentId,
    ...ACTIVE_KNOCKOUT_MATCH_WHERE,
  };
}
