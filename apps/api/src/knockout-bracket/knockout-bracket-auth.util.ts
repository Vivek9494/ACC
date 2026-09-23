import { type AuthUser, UserRole } from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

/** Tournament fields required to decide knockout manage permission. */
export interface KnockoutBracketOwnerRef {
  createdByUserId: string;
}

/**
 * Admin, or the Club Manager who created/owns this tournament.
 * Other Club Managers are denied (H4).
 */
export function assertCanManageKnockoutBracket(
  actor: AuthUser,
  tournament: KnockoutBracketOwnerRef,
): void {
  if (actor.role === UserRole.Admin) {
    return;
  }
  if (
    actor.role === UserRole.ClubManager &&
    tournament.createdByUserId === actor.id
  ) {
    return;
  }
  throw new ForbiddenException({
    message: 'Only Admin or the organizing Club Manager can manage the knockout bracket',
    error: 'KNOCKOUT_BRACKET_FORBIDDEN',
  });
}
