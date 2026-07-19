import { BallType } from '@acc/types';
import { NotFoundException } from '@nestjs/common';
import type { Prisma, Tournament } from '@prisma/client';

/** Exclude soft-deleted tournaments from user-facing list/detail/count queries. */
export const activeTournamentWhere = {
  isDeleted: false,
} as const satisfies Prisma.TournamentWhereInput;

/** Nest an active-tournament constraint on match (or other) queries. */
export const activeTournamentRelationWhere = {
  tournament: activeTournamentWhere,
} as const satisfies Prisma.MatchWhereInput;

/**
 * Guest-facing match queries — same rule as {@link TournamentsService.list} with
 * a null viewer: Tennis only; Leather is never returned to unauthenticated users.
 */
export const guestVisibleTournamentRelationWhere = {
  tournament: {
    isDeleted: false,
    ballType: BallType.Tennis,
  },
} as const satisfies Prisma.MatchWhereInput;

export function withActiveTournamentWhere(
  where: Prisma.TournamentWhereInput = {},
): Prisma.TournamentWhereInput {
  return { AND: [where, activeTournamentWhere] };
}

type ActiveTournamentRow = Pick<Tournament, 'isDeleted'>;

/** Treats soft-deleted (or missing) tournaments as not found for public/detail paths. */
export function assertTournamentActive(
  tournament: ActiveTournamentRow | null,
): asserts tournament is ActiveTournamentRow & { isDeleted: false } {
  if (!tournament || tournament.isDeleted) {
    throw new NotFoundException({ message: 'Tournament not found', error: 'NOT_FOUND' });
  }
}
