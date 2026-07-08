import type { Prisma } from '@prisma/client';

/** Active group-stage league fixtures — excludes knockout bracket rows. */
export const GROUP_STAGE_MATCH_WHERE = {
  isDeleted: false,
  groupId: { not: null },
  bracketId: null,
} as const satisfies Prisma.MatchWhereInput;

export function groupStageMatchesForTournament(
  tournamentId: string,
): Prisma.MatchWhereInput {
  return {
    tournamentId,
    ...GROUP_STAGE_MATCH_WHERE,
  };
}
