import { type AuthUser, UserRole } from '@acc/types';
import { ForbiddenException } from '@nestjs/common';

/** Admin / Club Manager — same roles as bracket generation. */
export function assertCanManageKnockoutBracket(actor: AuthUser): void {
  if (actor.role !== UserRole.Admin && actor.role !== UserRole.ClubManager) {
    throw new ForbiddenException({
      message: 'Only Admin or Club Manager can manage the knockout bracket',
      error: 'KNOCKOUT_BRACKET_FORBIDDEN',
    });
  }
}
