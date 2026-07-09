import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** Active (non-soft-deleted) matches — use on list/detail/count/mutation guards. */
export const activeMatchWhere = { isDeleted: false } as const satisfies Prisma.MatchWhereInput;

export type MatchNotFoundError = 'NOT_FOUND' | 'MATCH_NOT_FOUND';

export function matchNotFoundException(
  error: MatchNotFoundError = 'MATCH_NOT_FOUND',
): NotFoundException {
  return new NotFoundException({ message: 'Match not found', error });
}

/** Rejects null or soft-deleted matches (cancelled fixtures). */
export function assertActiveMatch<T extends { isDeleted: boolean }>(
  match: T | null,
  error: MatchNotFoundError = 'MATCH_NOT_FOUND',
): T {
  if (!match || match.isDeleted) {
    throw matchNotFoundException(error);
  }
  return match;
}

/** `findFirst` filter for a single active match by primary key. */
export function activeMatchFirstWhere(matchId: string): Prisma.MatchWhereInput {
  return { id: matchId, ...activeMatchWhere };
}
