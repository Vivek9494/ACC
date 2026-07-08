import type { Prisma } from '@prisma/client';

/** Active (non-soft-deleted) matches — use on list/detail/count/delete guards. */
export const activeMatchWhere = { isDeleted: false } as const satisfies Prisma.MatchWhereInput;
