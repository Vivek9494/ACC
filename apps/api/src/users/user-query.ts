import type { Prisma } from '@prisma/client';

/** Admin directory — includes inactive accounts, excludes soft-deleted. */
export const adminDirectoryUserWhere = {
  deletedAt: null,
} satisfies Prisma.UserWhereInput;

/** Users who may log in and appear in selectable player/user pickers. */
export const selectableUserWhere = {
  deletedAt: null,
  isActive: true,
} satisfies Prisma.UserWhereInput;
